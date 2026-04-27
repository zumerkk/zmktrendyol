import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { CreateRivalTargetDto } from "./dto/create-target.dto";
import { UpdateRivalTargetDto } from "./dto/update-target.dto";
import { TrendyolScraperService } from "./scrape/trendyol-scraper.service";
import { AlertsEngine } from "./engine/alerts.engine";
import { DecisionEngine } from "./engine/decision.engine";
import { DiffEngine } from "./engine/diff.engine";

@Injectable()
export class RivalsService {
  constructor(
    private prisma: PrismaService,
    private scraper: TrendyolScraperService,
    private alerts: AlertsEngine,
    private decisions: DecisionEngine,
    private diffs: DiffEngine,
  ) {}

  async listTargets(tenantId: string) {
    return this.prisma.rivalWatchTarget.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async createTarget(tenantId: string, dto: CreateRivalTargetDto) {
    const url = dto.url.trim();
    if (!url.includes("trendyol.com")) {
      throw new BadRequestException("Only Trendyol URLs are supported in v1.1");
    }

    return this.prisma.rivalWatchTarget.create({
      data: {
        tenantId,
        url,
        brand: dto.brand,
        ourProductId: dto.ourProductId,
        targetMinPrice: dto.targetMinPrice as any,
        scanIntervalMinutes: dto.scanIntervalMinutes ?? 15,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateTarget(tenantId: string, id: string, dto: UpdateRivalTargetDto) {
    await this.assertOwned(tenantId, id);
    return this.prisma.rivalWatchTarget.update({
      where: { id },
      data: {
        ourProductId: dto.ourProductId,
        targetMinPrice: dto.targetMinPrice as any,
        scanIntervalMinutes: dto.scanIntervalMinutes,
        isActive: dto.isActive,
      },
    });
  }

  async deleteTarget(tenantId: string, id: string) {
    await this.assertOwned(tenantId, id);
    await this.prisma.rivalWatchTarget.delete({ where: { id } });
    return { success: true };
  }

  async getTarget(tenantId: string, id: string) {
    const t = await this.prisma.rivalWatchTarget.findFirst({ where: { id, tenantId } });
    if (!t) throw new NotFoundException("Target not found");
    return t;
  }

  async getLatestSummary(tenantId: string, id: string) {
    await this.assertOwned(tenantId, id);
    const [target, latestScan, alerts, decision] = await Promise.all([
      this.prisma.rivalWatchTarget.findUnique({ where: { id } }),
      this.prisma.rivalScan.findFirst({
        where: { tenantId, targetId: id },
        orderBy: { fetchedAt: "desc" },
        include: { variants: true },
      }),
      this.prisma.rivalAlert.findMany({
        where: { tenantId, targetId: id, isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      this.prisma.rivalDecision.findFirst({
        where: { tenantId, targetId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { target, latestScan, alerts, decision };
  }

  async searchOurProducts(tenantId: string, query: string) {
    const q = query.trim();
    if (!q) return [];
    return this.prisma.product.findMany({
      where: { tenantId, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, barcode: true, costPrice: true },
      take: 20,
    });
  }

  async scanTargetNow(tenantId: string, id: string) {
    const target = await this.getTarget(tenantId, id);
    const snapshot = await this.scraper.scrape(target.url);

    const prev = await this.prisma.rivalScan.findFirst({
      where: { tenantId, targetId: id },
      orderBy: { fetchedAt: "desc" },
      include: { variants: true },
    });

    const scan = await this.prisma.rivalScan.create({
      data: {
        tenantId,
        targetId: id,
        status: snapshot.variants.length ? "success" : "failed",
        pageTitle: snapshot.pageTitle || null,
        lowestPrice: snapshot.lowestPrice as any,
        highestPrice: snapshot.highestPrice as any,
        rawSignals: snapshot.rawSignals,
        variants: {
          create: snapshot.variants.map((v) => ({
            variantKey: v.variantKey,
            listPrice: (v.listPrice ?? null) as any,
            salePrice: (v.salePrice ?? null) as any,
            stockSignal: v.stockSignal,
            stockConfidence: v.stockConfidence,
            availabilityText: v.availabilityText || null,
          })),
        },
      },
      include: { variants: true },
    });

    await this.prisma.rivalWatchTarget.update({
      where: { id },
      data: {
        title: snapshot.title || target.title,
        brand: snapshot.brand || target.brand,
        merchantId: snapshot.merchantId || target.merchantId,
        boutiqueId: snapshot.boutiqueId || target.boutiqueId,
        lastScanAt: new Date(),
      },
    });

    const events = prev
      ? this.diffs.diffVariants(
          prev.variants as any,
          scan.variants.map((v) => ({
            variantKey: v.variantKey,
            salePrice: v.salePrice ? Number(v.salePrice) : null,
            stockSignal: v.stockSignal,
          })),
        )
      : [];

    if (events.length) {
      await this.prisma.rivalChangeEvent.createMany({
        data: events.map((e) => ({
          tenantId,
          targetId: id,
          type: e.type,
          payload: e as any,
        })),
      });
    }

    const variantPrices = scan.variants
      .map((v) => ({ variantKey: v.variantKey, price: v.salePrice ? Number(v.salePrice) : NaN }))
      .filter((x) => Number.isFinite(x.price));

    const min = variantPrices.length
      ? Math.min(...variantPrices.map((x) => x.price))
      : scan.lowestPrice
        ? Number(scan.lowestPrice)
        : null;
    const max = variantPrices.length
      ? Math.max(...variantPrices.map((x) => x.price))
      : scan.highestPrice
        ? Number(scan.highestPrice)
        : null;
    const spread = min != null && max != null ? (max - min) / Math.max(min, 1) : null;

    const closures = events.filter((e) => e.type === "variant_closed").map((e: any) => e.variantKey);
    const openings = events.filter((e) => e.type === "variant_opened").map((e: any) => e.variantKey);

    const alertsOut = this.alerts.evaluate({
      targetMinPrice: target.targetMinPrice ? Number(target.targetMinPrice) : null,
      lowestPrice: min,
      variantPrices,
      variantClosures: closures,
      variantOpenings: openings,
      basketSignal: !!snapshot.basketSignal,
    });

    const active = await this.prisma.rivalAlert.findMany({
      where: { tenantId, targetId: id, isActive: true },
      select: { id: true, type: true },
    });
    const newAlertTypes = new Set(alertsOut.map((a) => a.type));
    const existingActiveTypes = new Set(active.map((a) => a.type));

    // Artık tetiklenmeyen eski alarmları kapat
    const toClose = active.filter((a) => !newAlertTypes.has(a.type));
    if (toClose.length) {
      await this.prisma.rivalAlert.updateMany({
        where: { id: { in: toClose.map((a) => a.id) } },
        data: { isActive: false },
      });
    }

    // Sadece henüz aktif olmayan yeni alarm tiplerini oluştur (duplikasyonu önle)
    const newAlerts = alertsOut.filter((a) => !existingActiveTypes.has(a.type));
    if (newAlerts.length) {
      await this.prisma.rivalAlert.createMany({
        data: newAlerts.map((a) => ({
          tenantId,
          targetId: id,
          severity: a.severity,
          type: a.type,
          message: a.message,
          payload: a.payload || undefined,
          isActive: true,
        })),
      });
    }

    const decision = this.decisions.decide({
      targetMinPrice: target.targetMinPrice ? Number(target.targetMinPrice) : null,
      lowestPrice: min,
      variantSpread: spread,
      closuresCount: closures.length,
      openingsCount: openings.length,
      basketSignal: !!snapshot.basketSignal,
    });
    await this.prisma.rivalDecision.create({
      data: {
        tenantId,
        targetId: id,
        decision: decision.decision,
        score: decision.score,
        reasons: decision.reasons as any,
      },
    });

    return { scanId: scan.id, decision };
  }

  async getProfitSummaryForTarget(tenantId: string, targetId: string) {
    const target = await this.getTarget(tenantId, targetId);
    if (!target.ourProductId) return { mapped: false };

    const product = await this.prisma.product.findFirst({
      where: { id: target.ourProductId, tenantId },
      select: {
        id: true,
        title: true,
        costPrice: true,
        commissionRate: true,
        shippingCost: true,
        packagingCost: true,
      },
    });
    if (!product) return { mapped: false };

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 30);

    const sumForRange = async (from: Date) => {
      const items = await this.prisma.orderItem.findMany({
        where: { productId: product.id, order: { tenantId, orderDate: { gte: from } } },
        select: { quantity: true, unitPrice: true },
      });

      const qty = items.reduce((s, i) => s + i.quantity, 0);
      const revenue = items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);

      const costUnit = product.costPrice ? Number(product.costPrice) : 0;
      const commissionRate = product.commissionRate ? Number(product.commissionRate) / 100 : 0;
      const ship = product.shippingCost ? Number(product.shippingCost) : 0;
      const pack = product.packagingCost ? Number(product.packagingCost) : 0;

      const cost = qty * costUnit;
      const commission = items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity * commissionRate, 0);
      const logistics = qty * (ship + pack);
      const profit = revenue - cost - commission - logistics;
      const margin = revenue > 0 ? profit / revenue : 0;
      return { qty, revenue, cost, commission, logistics, profit, margin };
    };

    return {
      mapped: true,
      product: { id: product.id, title: product.title },
      day: await sumForRange(startOfDay),
      week: await sumForRange(startOfWeek),
      month: await sumForRange(startOfMonth),
      calculatedAt: new Date().toISOString(),
    };
  }

  /** Son 30 tarama gecmisi — fiyat trendi */
  async getScanHistory(tenantId: string, targetId: string) {
    await this.assertOwned(tenantId, targetId);
    const scans = await this.prisma.rivalScan.findMany({
      where: { tenantId, targetId },
      orderBy: { fetchedAt: "desc" },
      take: 30,
      include: { variants: true },
    });
    return scans.map((s) => ({
      id: s.id,
      status: s.status,
      lowestPrice: s.lowestPrice ? Number(s.lowestPrice) : null,
      highestPrice: s.highestPrice ? Number(s.highestPrice) : null,
      variantCount: s.variants.length,
      variants: s.variants.map((v) => ({
        key: v.variantKey,
        salePrice: v.salePrice ? Number(v.salePrice) : null,
        listPrice: v.listPrice ? Number(v.listPrice) : null,
        stockSignal: v.stockSignal,
        stockConfidence: v.stockConfidence,
      })),
      rawSignals: s.rawSignals,
      fetchedAt: s.fetchedAt?.toISOString(),
    }));
  }

  /** Degisiklik olaylari timeline */
  async getChangeEvents(tenantId: string, targetId: string) {
    await this.assertOwned(tenantId, targetId);
    return this.prisma.rivalChangeEvent.findMany({
      where: { tenantId, targetId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /** Tum alarmlar (aktif + gecmis son 50) */
  async getAllAlerts(tenantId: string, targetId: string) {
    await this.assertOwned(tenantId, targetId);
    return this.prisma.rivalAlert.findMany({
      where: { tenantId, targetId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  }

  /** AI tabanlı rakip analiz yorumu */
  async getAiAnalysis(tenantId: string, targetId: string) {
    await this.assertOwned(tenantId, targetId);

    const target = await this.prisma.rivalWatchTarget.findUnique({ where: { id: targetId } });
    const scans = await this.prisma.rivalScan.findMany({
      where: { tenantId, targetId },
      orderBy: { fetchedAt: "desc" },
      take: 10,
      include: { variants: true },
    });
    const alerts = await this.prisma.rivalAlert.findMany({
      where: { tenantId, targetId, isActive: true },
    });
    const decisions = await this.prisma.rivalDecision.findMany({
      where: { tenantId, targetId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Fiyat trendi analizi
    const prices = scans
      .filter((s) => s.lowestPrice)
      .map((s) => ({ price: Number(s.lowestPrice), date: s.fetchedAt }));

    const insights: string[] = [];
    const recommendations: string[] = [];

    if (prices.length >= 2) {
      const latest = prices[0].price;
      const previous = prices[1].price;
      const diff = latest - previous;
      const pct = ((diff / previous) * 100).toFixed(1);

      if (diff > 0) {
        insights.push(`Fiyat son taramada %${pct} yukseldi (${previous} -> ${latest} TL)`);
        recommendations.push("Rakip fiyat artisi firsati — bizim fiyatimizi da gozden gecirin");
      } else if (diff < 0) {
        insights.push(`Fiyat son taramada %${Math.abs(Number(pct))} dustu (${previous} -> ${latest} TL)`);
        recommendations.push("DIKKAT: Rakip fiyat indirdi — rekabetci kalmak icin fiyat guncelleme dusunun");
      } else {
        insights.push("Fiyat degismedi — rakip stabil fiyat politikasi izliyor");
      }
    }

    if (prices.length >= 3) {
      const avg = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
      const min = Math.min(...prices.map((p) => p.price));
      const max = Math.max(...prices.map((p) => p.price));
      insights.push(`Son ${prices.length} taramada fiyat araligi: ${min} - ${max} TL (ort: ${avg.toFixed(0)} TL)`);

      const volatility = ((max - min) / avg) * 100;
      if (volatility > 15) {
        insights.push(`Yuksek fiyat volatilitesi (%${volatility.toFixed(0)}) — Rakip agresif fiyat stratejisi uyguluyor`);
        recommendations.push("Dinamik fiyatlama ile rakibi takip edin");
      } else {
        insights.push(`Dusuk volatilite (%${volatility.toFixed(0)}) — Rakip sabit fiyat politikasi`);
      }
    }

    // Stok analizi
    const latestScan = scans[0];
    if (latestScan) {
      const oos = latestScan.variants.filter((v) => v.stockSignal === "out_of_stock");
      if (oos.length > 0) {
        insights.push(`${oos.length} varyant stokta yok — FIRSAT: Bu bedenlerde reklam artirin`);
        recommendations.push(`${oos.map((v) => v.variantKey).join(", ")} bedenlerinde OOS avantaji`);
      }
    }

    // Kampanya analizi
    const basketScans = scans.filter((s) => (s.rawSignals as any)?.basketSignal);
    if (basketScans.length > 0) {
      const pct = ((basketScans.length / scans.length) * 100).toFixed(0);
      insights.push(`Taramalarin %${pct}'unda "Sepette gor" kampanyasi aktif`);
      recommendations.push("Rakip agresif kampanya uyguluyor — Zeus Ads ile prime saatlerde kontra verin");
    }

    // Alarm ozeti
    if (alerts.length > 0) {
      insights.push(`${alerts.length} aktif alarm mevcut`);
    }

    // Genel skor
    let riskScore = 50;
    if (prices.length >= 2) {
      const trend = prices[0].price - prices[prices.length - 1].price;
      if (trend < 0) riskScore += 20; // fiyat dusuyor = risk
      if (trend > 0) riskScore -= 10; // fiyat artiyor = firsat
    }
    if (alerts.filter((a) => a.severity === "critical").length > 0) riskScore += 15;
    riskScore = Math.max(0, Math.min(100, riskScore));

    return {
      targetTitle: target?.title || "Bilinmeyen Urun",
      scanCount: scans.length,
      riskScore,
      riskLevel: riskScore >= 70 ? "YUKSEK" : riskScore >= 40 ? "ORTA" : "DUSUK",
      insights,
      recommendations,
      priceHistory: prices.slice(0, 10),
      lastDecision: decisions[0] || null,
      generatedAt: new Date().toISOString(),
    };
  }

  private async assertOwned(tenantId: string, id: string) {
    const exists = await this.prisma.rivalWatchTarget.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Target not found");
  }
}


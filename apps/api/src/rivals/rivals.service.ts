import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRivalTargetDto } from './dto/create-target.dto';
import { UpdateRivalTargetDto } from './dto/update-target.dto';
import { TrendyolScraperService } from './scrape/trendyol-scraper.service';
import { AlertsEngine } from './engine/alerts.engine';
import { DecisionEngine } from './engine/decision.engine';
import { DiffEngine } from './engine/diff.engine';

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
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createTarget(tenantId: string, dto: CreateRivalTargetDto) {
    const url = dto.url.trim();
    if (!url.includes('trendyol.com')) throw new BadRequestException('Only Trendyol URLs are supported in v1.1');

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
    if (!t) throw new NotFoundException('Target not found');
    return t;
  }

  async getLatestSummary(tenantId: string, id: string) {
    await this.assertOwned(tenantId, id);
    const [target, latestScan, alerts, decision] = await Promise.all([
      this.prisma.rivalWatchTarget.findUnique({ where: { id } }),
      this.prisma.rivalScan.findFirst({
        where: { tenantId, targetId: id },
        orderBy: { fetchedAt: 'desc' },
        include: { variants: true },
      }),
      this.prisma.rivalAlert.findMany({
        where: { tenantId, targetId: id, isActive: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.rivalDecision.findFirst({
        where: { tenantId, targetId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { target, latestScan, alerts, decision };
  }

  async searchOurProducts(tenantId: string, query: string) {
    const q = query.trim();
    if (!q) return [];
    return this.prisma.product.findMany({
      where: { tenantId, title: { contains: q, mode: 'insensitive' } },
      select: { id: true, title: true, barcode: true, costPrice: true },
      take: 20,
    });
  }

  async scanTargetNow(tenantId: string, id: string) {
    const target = await this.getTarget(tenantId, id);
    const snapshot = await this.scraper.scrape(target.url);

    const prev = await this.prisma.rivalScan.findFirst({
      where: { tenantId, targetId: id },
      orderBy: { fetchedAt: 'desc' },
      include: { variants: true },
    });

    const scan = await this.prisma.rivalScan.create({
      data: {
        tenantId,
        targetId: id,
        status: snapshot.variants.length ? 'success' : 'failed',
        pageTitle: snapshot.pageTitle || null,
        lowestPrice: snapshot.lowestPrice as any,
        highestPrice: snapshot.highestPrice as any,
        rawSignals: snapshot.rawSignals,
        variants: {
          create: snapshot.variants.map((v) => ({
            variantKey: v.variantKey,
            listPrice: v.listPrice as any,
            salePrice: v.salePrice as any,
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
      ? this.diffs.diffVariants(prev.variants, scan.variants.map((v) => ({
          variantKey: v.variantKey,
          salePrice: v.salePrice ? Number(v.salePrice) : null,
          stockSignal: v.stockSignal,
        })))
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
    const min = variantPrices.length ? Math.min(...variantPrices.map((x) => x.price)) : (scan.lowestPrice ? Number(scan.lowestPrice) : null);
    const max = variantPrices.length ? Math.max(...variantPrices.map((x) => x.price)) : (scan.highestPrice ? Number(scan.highestPrice) : null);
    const spread = min && max ? (max - min) / Math.max(min, 1) : null;

    const closures = events.filter((e) => e.type === 'variant_closed').map((e: any) => e.variantKey);
    const openings = events.filter((e) => e.type === 'variant_opened').map((e: any) => e.variantKey);

    const alertsOut = this.alerts.evaluate({
      targetMinPrice: target.targetMinPrice ? Number(target.targetMinPrice) : null,
      lowestPrice: min,
      variantPrices,
      variantClosures: closures,
      variantOpenings: openings,
      basketSignal: !!snapshot.basketSignal,
    });

    const active = await this.prisma.rivalAlert.findMany({ where: { tenantId, targetId: id, isActive: true } });
    const activeTypes = new Set(alertsOut.map((a) => a.type));
    const toClose = active.filter((a) => !activeTypes.has(a.type));
    if (toClose.length) {
      await this.prisma.rivalAlert.updateMany({
        where: { id: { in: toClose.map((a) => a.id) } },
        data: { isActive: false },
      });
    }
    if (alertsOut.length) {
      await this.prisma.rivalAlert.createMany({
        data: alertsOut.map((a) => ({
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
      select: { id: true, title: true, costPrice: true, commissionRate: true, shippingCost: true, packagingCost: true },
    });
    if (!product) return { mapped: false };

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now); startOfMonth.setDate(now.getDate() - 30);

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
      const commission = items.reduce((s, i) => s + (Number(i.unitPrice) * i.quantity * commissionRate), 0);
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

  private async assertOwned(tenantId: string, id: string) {
    const exists = await this.prisma.rivalWatchTarget.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Target not found');
  }
}

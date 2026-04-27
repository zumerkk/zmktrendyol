import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { ScraperEngineService } from "../scraper/scraper-engine.service";

/**
 * BuyboxService — Buybox Takibi & Uyarı Sistemi
 *
 * 30 dakikada bir Buybox durumunu kontrol eder.
 * Buybox kaybedildiğinde AlertEvent tetikler.
 * Rakip fiyat değişikliklerini anlık tespit eder.
 *
 * ⚠️ Kaynak: public (ürün sayfasından genel erişime açık veri)
 */
@Injectable()
export class BuyboxService {
  private readonly logger = new Logger(BuyboxService.name);

  constructor(
    private prisma: PrismaService,
    private scraperEngine: ScraperEngineService,
  ) {}

  /**
   * CRON: 30 dakikada bir buybox kontrolü
   */
  @Cron("*/30 * * * *")
  async checkBuyboxStatus() {
    const trackedProducts = await this.prisma.competitorProduct.findMany({
      where: {
        // Only check products where we want buybox monitoring
        buyboxSnapshots: { some: {} },
      },
      select: { id: true, trendyolUrl: true, tenantId: true },
    });

    this.logger.log(
      `Checking buybox for ${trackedProducts.length} products...`,
    );

    for (const product of trackedProducts) {
      try {
        await this.checkAndRecord(
          product.id,
          product.trendyolUrl,
          product.tenantId,
        );
      } catch (error: any) {
        this.logger.error(
          `Buybox check failed for ${product.trendyolUrl}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Record a buybox snapshot
   * Called by scraper or extension when visiting a product page
   */
  async recordSnapshot(
    competitorProductId: string,
    data: {
      buyboxHolder?: string;
      buyboxPrice?: number;
      totalSellers?: number;
      ourPosition?: number;
      isOurBuybox?: boolean;
      sellersData?: any;
    },
  ) {
    const snapshot = await this.prisma.buyboxSnapshot.create({
      data: {
        competitorProductId,
        buyboxHolder: data.buyboxHolder,
        buyboxPrice: data.buyboxPrice,
        totalSellers: data.totalSellers,
        ourPosition: data.ourPosition,
        isOurBuybox: data.isOurBuybox ?? false,
        sellersData: data.sellersData || undefined,
      },
    });

    // Check if we lost the buybox
    const previousSnapshot = await this.prisma.buyboxSnapshot.findFirst({
      where: {
        competitorProductId,
        id: { not: snapshot.id },
      },
      orderBy: { time: "desc" },
    });

    if (previousSnapshot?.isOurBuybox && !data.isOurBuybox) {
      await this.triggerBuyboxLostAlert(competitorProductId, data);
    }

    // Check if competitor undercut us
    if (
      previousSnapshot?.buyboxPrice &&
      data.buyboxPrice &&
      data.buyboxPrice < Number(previousSnapshot.buyboxPrice)
    ) {
      const priceDrop = Number(previousSnapshot.buyboxPrice) - data.buyboxPrice;
      this.logger.warn(
        `💸 Buybox price dropped by ${priceDrop.toFixed(2)} TL on ${competitorProductId}`,
      );
    }

    return snapshot;
  }

  /**
   * Get buybox history for a product
   */
  async getBuyboxHistory(competitorProductId: string, hours = 168) {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const snapshots = await this.prisma.buyboxSnapshot.findMany({
      where: {
        competitorProductId,
        time: { gte: startDate },
      },
      orderBy: { time: "asc" },
    });

    // Calculate buybox ownership stats
    const totalSnapshots = snapshots.length;
    const oursCount = snapshots.filter((s) => s.isOurBuybox).length;
    const ownershipRate =
      totalSnapshots > 0 ? (oursCount / totalSnapshots) * 100 : 0;

    return {
      snapshots: snapshots.map((s) => ({
        time: s.time,
        holder: s.buyboxHolder,
        price: s.buyboxPrice,
        totalSellers: s.totalSellers,
        ourPosition: s.ourPosition,
        isOurs: s.isOurBuybox,
      })),
      stats: {
        totalChecks: totalSnapshots,
        ourBuyboxCount: oursCount,
        ownershipRate: Math.round(ownershipRate * 100) / 100,
      },
      source: "public" as const,
      disclaimer: "Buybox verileri kamuya açık ürün sayfasından alınmıştır.",
    };
  }

  /**
   * Get current buybox status for all tracked products of a tenant
   */
  async getCurrentBuyboxStatus(tenantId: string) {
    const products = await this.prisma.competitorProduct.findMany({
      where: { tenantId },
      include: {
        buyboxSnapshots: {
          orderBy: { time: "desc" },
          take: 1,
        },
      },
    });

    return products
      .filter((p) => p.buyboxSnapshots.length > 0)
      .map((p) => ({
        competitorProductId: p.id,
        title: p.title,
        url: p.trendyolUrl,
        currentBuybox: {
          holder: p.buyboxSnapshots[0].buyboxHolder,
          price: p.buyboxSnapshots[0].buyboxPrice,
          isOurs: p.buyboxSnapshots[0].isOurBuybox,
          totalSellers: p.buyboxSnapshots[0].totalSellers,
          lastChecked: p.buyboxSnapshots[0].time,
        },
        source: "public" as const,
      }));
  }

  /**
   * Enable buybox monitoring for a product
   * Creates initial snapshot entry to mark it as monitored
   */
  async enableMonitoring(competitorProductId: string) {
    // Check if already monitoring
    const existing = await this.prisma.buyboxSnapshot.findFirst({
      where: { competitorProductId },
    });

    if (existing) {
      return { status: "already_monitoring", competitorProductId };
    }

    // Create initial snapshot
    await this.prisma.buyboxSnapshot.create({
      data: {
        competitorProductId,
        isOurBuybox: false,
      },
    });

    return { status: "monitoring_enabled", competitorProductId };
  }

  /**
   * Check and record buybox — called by cron
   */
  private async checkAndRecord(
    competitorProductId: string,
    productUrl: string,
    _tenantId: string,
  ) {
    try {
      // Actually scrape the product page for buybox data
      const scrapeData = await this.scraperEngine.scrapeProductPage(productUrl);

      if (!scrapeData || !scrapeData.source) {
        this.logger.debug(`No scrape data returned for: ${productUrl}`);
        return;
      }

      // Determine buybox holder & our position
      const buyboxSellers = scrapeData.buyboxSellers || [];
      const buyboxHolder = scrapeData.sellerName || buyboxSellers[0]?.name;
      const buyboxPrice = scrapeData.price || buyboxSellers[0]?.price;

      // Check if we own the buybox (match by seller connection)
      const competitorProduct = await this.prisma.competitorProduct.findUnique({
        where: { id: competitorProductId },
        include: { tenant: { include: { sellerConnections: { take: 1 } } } },
      });

      const ourSellerId = competitorProduct?.tenant?.sellerConnections?.[0]?.sellerId;
      const isOurBuybox = ourSellerId
        ? buyboxHolder?.toLowerCase().includes(ourSellerId.toLowerCase()) || false
        : false;

      // Find our position among sellers
      let ourPosition: number | undefined;
      if (buyboxSellers.length > 0) {
        const idx = buyboxSellers.findIndex((s) =>
          ourSellerId ? s.name?.toLowerCase().includes(ourSellerId.toLowerCase()) : false,
        );
        ourPosition = idx >= 0 ? idx + 1 : buyboxSellers.length + 1;
      }

      // Record the buybox snapshot
      await this.recordSnapshot(competitorProductId, {
        buyboxHolder,
        buyboxPrice,
        totalSellers: buyboxSellers.length || 1,
        ourPosition,
        isOurBuybox,
        sellersData: buyboxSellers.length > 0 ? buyboxSellers : undefined,
      });

      this.logger.log(
        `✅ Buybox scraped: ${productUrl} — Holder: ${buyboxHolder}, Price: ${buyboxPrice}`,
      );
    } catch (error: any) {
      this.logger.error(`Buybox scrape failed for ${productUrl}: ${error.message}`);
    }
  }

  /**
   * Trigger alert when we lose the buybox
   */
  private async triggerBuyboxLostAlert(
    competitorProductId: string,
    buyboxData: { buyboxHolder?: string; buyboxPrice?: number },
  ) {
    const product = await this.prisma.competitorProduct.findUnique({
      where: { id: competitorProductId },
    });

    if (!product) return;

    // Find alert rule for buybox
    const alertRule = await this.prisma.alertRule.findFirst({
      where: {
        tenantId: product.tenantId,
        type: "buybox_lost",
        isActive: true,
      },
    });

    if (!alertRule) return;

    await this.prisma.alertEvent.create({
      data: {
        ruleId: alertRule.id,
        message: `🚨 Buybox kaybedildi! "${product.title}" — Yeni sahip: ${buyboxData.buyboxHolder || "Bilinmiyor"}, Fiyat: ${buyboxData.buyboxPrice || "-"} TL`,
        severity: "critical",
      },
    });

    this.logger.warn(
      `🚨 BUYBOX LOST: ${product.title} — New holder: ${buyboxData.buyboxHolder}`,
    );
  }
}

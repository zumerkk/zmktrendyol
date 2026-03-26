import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * CompetitorTrackerService
 * Tracks competitor products using publicly available signals.
 *
 * ⚠️ IMPORTANT: All competitor data is labeled with source type.
 * "public" = kamuya açık sayfa verisi
 * "estimate" = model tahmini (kesin veri değil, güven aralığı zorunlu)
 */
@Injectable()
export class TrackerService {
  private readonly logger = new Logger(TrackerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Add a competitor product to track
   */
  async addCompetitor(
    tenantId: string,
    dto: { url: string; title?: string; brand?: string; category?: string },
  ) {
    return this.prisma.competitorProduct.create({
      data: {
        tenantId,
        trendyolUrl: dto.url,
        title: dto.title,
        brand: dto.brand,
        category: dto.category,
      },
    });
  }

  /**
   * Get tracked competitors
   */
  async getCompetitors(tenantId: string) {
    const competitors = await this.prisma.competitorProduct.findMany({
      where: { tenantId },
      include: {
        snapshots: {
          orderBy: { time: "desc" },
          take: 1,
        },
      },
      orderBy: { trackedSince: "desc" },
    });

    return competitors.map((c) => ({
      ...c,
      latestSnapshot: c.snapshots[0]
        ? {
            price: { value: c.snapshots[0].price, source: "public" as const },
            rating: { value: c.snapshots[0].rating, source: "public" as const },
            reviewCount: {
              value: c.snapshots[0].reviewCount,
              source: "public" as const,
            },
            inStock: {
              value: c.snapshots[0].inStock,
              source: "public" as const,
            },
            deliveryInfo: {
              value: c.snapshots[0].deliveryInfo,
              source: "public" as const,
            },
          }
        : null,
    }));
  }

  /**
   * Record a competitor snapshot (public signal)
   * Called by external signal collector or manual input
   */
  async recordSnapshot(
    competitorProductId: string,
    data: {
      price?: number;
      rating?: number;
      reviewCount?: number;
      inStock?: boolean;
      deliveryInfo?: string;
    },
  ) {
    return this.prisma.competitorSnapshot.create({
      data: {
        competitorProductId,
        price: data.price,
        rating: data.rating,
        reviewCount: data.reviewCount,
        inStock: data.inStock,
        deliveryInfo: data.deliveryInfo,
      },
    });
  }

  /**
   * Get competitor price history
   * Kaynak: Kamuya açık sinyal
   */
  async getCompetitorPriceHistory(competitorProductId: string, months = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const snapshots = await this.prisma.competitorSnapshot.findMany({
      where: {
        competitorProductId,
        time: { gte: startDate },
      },
      orderBy: { time: "asc" },
    });

    return {
      data: snapshots,
      source: "public" as const,
      disclaimer:
        "Bu veriler kamuya açık sayfa sinyallerinden toplanmıştır. Kesin satış verisi değildir.",
    };
  }

  /**
   * Estimate competitor sales based on review delta
   * ⚠️ This is a ROUGH ESTIMATE — always labeled as "estimate" with confidence range
   *
   * Method: review_count_delta × category_conversion_factor
   * This is a very approximate heuristic
   */
  async estimateSales(competitorProductId: string) {
    const snapshots = await this.prisma.competitorSnapshot.findMany({
      where: { competitorProductId },
      orderBy: { time: "asc" },
      take: 30, // last 30 snapshots
    });

    if (snapshots.length < 2) {
      return {
        estimate: null,
        source: "estimate" as const,
        confidence: 0,
        disclaimer:
          "Yeterli veri birikimi yok. Bu bir TAHMİNDİR, kesin satış verisi değildir.",
      };
    }

    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    const reviewDelta =
      (lastSnapshot.reviewCount || 0) - (firstSnapshot.reviewCount || 0);
    const daysDiff = Math.max(
      1,
      (lastSnapshot.time.getTime() - firstSnapshot.time.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Heuristic: ~5-15% of buyers leave reviews (industry average)
    // We use 10% as middle estimate, give min-max range
    const dailyReviewRate = reviewDelta / daysDiff;
    const estimatedDailySalesMin = Math.round(dailyReviewRate / 0.15);
    const estimatedDailySalesMax = Math.round(dailyReviewRate / 0.05);
    const estimatedDailySalesMid = Math.round(dailyReviewRate / 0.1);

    return {
      estimate: {
        dailySales: {
          min: estimatedDailySalesMin,
          mid: estimatedDailySalesMid,
          max: estimatedDailySalesMax,
        },
        monthlySales: {
          min: estimatedDailySalesMin * 30,
          mid: estimatedDailySalesMid * 30,
          max: estimatedDailySalesMax * 30,
        },
        reviewDelta,
        periodDays: Math.round(daysDiff),
      },
      source: "estimate" as const,
      confidence: 25, // Low confidence — this is a rough heuristic
      disclaimer:
        "⚠️ TAHMİN: Bu değerler yorum artış hızından türetilmiş yaklaşık tahminlerdir. Kesin satış verisi DEĞİLDİR. Güven oranı düşüktür.",
    };
  }

  /**
   * Remove a tracked competitor
   */
  async removeCompetitor(tenantId: string, competitorId: string) {
    // First delete snapshots
    await this.prisma.competitorSnapshot.deleteMany({
      where: { competitorProductId: competitorId },
    });
    return this.prisma.competitorProduct.delete({
      where: { id: competitorId },
    });
  }
}

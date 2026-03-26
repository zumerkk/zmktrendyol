import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * MarketIntelligenceService — Pazar Zekası
 *
 * Scraping verilerinden pazar trendleri çıkarır.
 * ML modeli: yorum artışı + sıralama + fiyat hareketi → satış tahmini.
 * Tüm veriler source: 'estimate' ile etiketlenir.
 *
 * ⚠️ Tüm çıktılar TAHMİNDİR. Kesin satış verisi yoktur.
 */
@Injectable()
export class MarketIntelligenceService {
  private readonly logger = new Logger(MarketIntelligenceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Estimate competitor sales using multi-signal model
   *
   * Signals:
   * 1. Review delta (yorum artışı)
   * 2. Search ranking change (sıralama değişimi)
   * 3. Price movements (fiyat hareketleri)
   * 4. Stock delta (stok değişimi — if probe data available)
   *
   * Confidence increases with more signals available.
   */
  async estimateCompetitorSales(competitorProductId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Signal 1: Review delta
    const snapshots = await this.prisma.competitorSnapshot.findMany({
      where: {
        competitorProductId,
        time: { gte: startDate },
      },
      orderBy: { time: "asc" },
    });

    let reviewBasedEstimate = null;
    let priceBasedSignal = null;
    let confidence = 0;
    const signals: string[] = [];

    if (snapshots.length >= 2) {
      const first = snapshots[0];
      const last = snapshots[snapshots.length - 1];

      // Review-based estimation
      const reviewDelta = (last.reviewCount || 0) - (first.reviewCount || 0);
      if (reviewDelta > 0) {
        const dailyReviewRate = reviewDelta / days;
        // Turkish e-commerce: ~5-12% of buyers leave reviews
        reviewBasedEstimate = {
          min: Math.round(dailyReviewRate / 0.12) * days,
          mid: Math.round(dailyReviewRate / 0.08) * days,
          max: Math.round(dailyReviewRate / 0.05) * days,
          dailyReviewRate: Math.round(dailyReviewRate * 100) / 100,
        };
        confidence += 30;
        signals.push("review_delta");
      }

      // Price signal
      const prices = snapshots
        .filter((s) => s.price !== null)
        .map((s) => Number(s.price));
      if (prices.length >= 2) {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const priceChange = prices[prices.length - 1] - prices[0];
        priceBasedSignal = {
          avgPrice: Math.round(avgPrice * 100) / 100,
          priceChange: Math.round(priceChange * 100) / 100,
          priceDirection:
            priceChange > 0 ? "up" : priceChange < 0 ? "down" : "stable",
        };
        confidence += 15;
        signals.push("price_movement");
      }

      // In-stock signal
      const stockSignals = snapshots.filter((s) => s.inStock !== null);
      if (stockSignals.length > 0) {
        const outOfStockCount = stockSignals.filter((s) => !s.inStock).length;
        if (outOfStockCount > 0) {
          confidence += 10;
          signals.push("stock_change");
        }
      }

      // Rating signal
      const ratings = snapshots
        .filter((s) => s.rating !== null)
        .map((s) => Number(s.rating));
      if (ratings.length >= 2) {
        confidence += 5;
        signals.push("rating_trend");
      }
    }

    // Signal 2: Stock probe data (if available)
    const stockProbe = await this.prisma.stockProbe.findFirst({
      where: { competitorProductId },
      include: {
        results: {
          where: {
            time: { gte: startDate },
            deltaFromPrev: { not: null },
          },
          orderBy: { time: "asc" },
        },
      },
    });

    let stockBasedEstimate = null;
    if (stockProbe && stockProbe.results.length > 0) {
      const salesDeltas = stockProbe.results.filter(
        (r) => (r.deltaFromPrev || 0) < 0,
      );
      const totalStockSales = salesDeltas.reduce(
        (sum, r) => sum + Math.abs(r.deltaFromPrev || 0),
        0,
      );

      stockBasedEstimate = {
        totalSales: totalStockSales,
        dataPoints: stockProbe.results.length,
      };
      confidence += 40; // Stock probe is the most reliable signal
      signals.push("stock_probe");
    }

    // Combine estimates
    let combinedEstimate = null;
    if (stockBasedEstimate) {
      // Stock probe is most reliable — use it as primary
      combinedEstimate = {
        totalSales: stockBasedEstimate.totalSales,
        dailyAvg: Math.round(stockBasedEstimate.totalSales / days),
        method: "stock_probe_primary",
      };
    } else if (reviewBasedEstimate) {
      combinedEstimate = {
        totalSales: reviewBasedEstimate.mid,
        dailyAvg: Math.round(reviewBasedEstimate.mid / days),
        range: {
          min: reviewBasedEstimate.min,
          max: reviewBasedEstimate.max,
        },
        method: "review_delta_primary",
      };
    }

    // Cap confidence at 95
    confidence = Math.min(confidence, 95);

    // Revenue estimate
    const avgPrice =
      snapshots.length > 0
        ? snapshots
            .filter((s) => s.price)
            .reduce((sum, s) => sum + Number(s.price || 0), 0) /
          snapshots.filter((s) => s.price).length
        : null;

    return {
      estimate: combinedEstimate,
      revenueEstimate:
        combinedEstimate && avgPrice
          ? {
              totalRevenue: Math.round(combinedEstimate.totalSales * avgPrice),
              dailyRevenue: Math.round(
                (combinedEstimate.totalSales * avgPrice) / days,
              ),
              avgPrice: Math.round(avgPrice * 100) / 100,
            }
          : null,
      signals,
      signalDetails: {
        reviewBased: reviewBasedEstimate,
        stockBased: stockBasedEstimate,
        priceSignal: priceBasedSignal,
      },
      source: "estimate" as const,
      confidence,
      periodDays: days,
      disclaimer:
        "⚠️ TAHMİN: Bu veriler çoklu sinyal analizi ile oluşturulmuş yaklaşık tahminlerdir. Kesin satış verisi DEĞİLDİR.",
    };
  }

  /**
   * Get market trends for a category
   */
  async getMarketTrends(tenantId: string, categoryId?: number) {
    const where: any = { tenantId };
    if (categoryId) where.categoryId = categoryId;

    const snapshots = await this.prisma.marketSnapshot.findMany({
      where,
      orderBy: { time: "desc" },
      take: 30,
    });

    return {
      snapshots: snapshots.map((s) => ({
        id: s.id,
        type: s.type,
        categoryId: s.categoryId,
        time: s.time,
        data: s.data,
        source: s.source,
      })),
      source: "scrape" as const,
    };
  }

  /**
   * Save a market snapshot
   */
  async saveMarketSnapshot(
    tenantId: string,
    data: {
      categoryId?: number;
      type: "best_sellers" | "trending" | "price_distribution";
      data: any;
      source?: string;
    },
  ) {
    return this.prisma.marketSnapshot.create({
      data: {
        tenantId,
        categoryId: data.categoryId,
        type: data.type,
        data: data.data,
        source: data.source || "scrape",
      },
    });
  }

  /**
   * Track seller/store performance over time
   */
  async trackSellerPerformance(tenantId: string, sellerUrl: string) {
    // Get scrape results for this seller
    const target = await this.prisma.scrapeTarget.findFirst({
      where: {
        tenantId,
        url: sellerUrl,
        type: "seller_page",
      },
      include: {
        results: {
          where: { status: "success" },
          orderBy: { time: "desc" },
          take: 30,
        },
      },
    });

    if (!target || target.results.length === 0) {
      return {
        data: null,
        message:
          "Bu satıcı için henüz veri toplanmamış. Önce scrape hedefi ekleyin.",
      };
    }

    return {
      sellerUrl,
      dataPoints: target.results.length,
      history: target.results.map((r) => ({
        time: r.time,
        data: r.data,
      })),
      source: "scrape" as const,
    };
  }
}

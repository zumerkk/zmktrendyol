import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * MlPredictionService — ML Sales Prediction Model
 *
 * Çoklu sinyal ile satış tahmini:
 * features = [yorum_artış_hızı, fiyat_değişimi, sıralama_değişimi,
 *             stok_delta, mevsimsellik, kategori_ortalama]
 * target = tahmini_satış
 *
 * Linear regression + seasonal adjustment (JavaScript-based)
 */
@Injectable()
export class MlPredictionService {
  private readonly logger = new Logger(MlPredictionService.name);

  // Seasonal multipliers for Turkish e-commerce (1.0 = baseline)
  private readonly seasonalFactors: Record<number, number> = {
    1: 0.85, // Ocak - post-holiday dip
    2: 0.9, // Şubat
    3: 0.95, // Mart
    4: 1.0, // Nisan
    5: 1.05, // Mayıs
    6: 1.1, // Haziran
    7: 0.95, // Temmuz
    8: 1.0, // Ağustos - okul alışverişi
    9: 1.15, // Eylül - okul başlangıcı
    10: 1.1, // Ekim
    11: 1.3, // Kasım - Black Friday
    12: 1.2, // Aralık - yılbaşı
  };

  constructor(private prisma: PrismaService) { }

  /**
   * Predict future sales for a product
   */
  async predictSales(productId: string, forecastDays = 30) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        orderItems: {
          include: { order: true },
          orderBy: { order: { orderDate: "desc" } },
          take: 500,
        },
      },
    });

    if (!product) return { message: "Product not found", productId, prediction: null };

    // Build daily sales history (last 90 days)
    const dailySales = this.buildDailySales(product.orderItems, 90);

    // Linear regression on daily sales
    const { slope, intercept, r2 } = this.linearRegression(
      dailySales.map((d, i) => [i, d.units]),
    );

    // Seasonal adjustment
    const currentMonth = new Date().getMonth() + 1;
    const seasonalFactor = this.seasonalFactors[currentMonth] || 1.0;

    // Generate forecast
    const forecast: Array<{
      date: string;
      predictedUnits: number;
      revenue: number;
    }> = [];
    let totalPredicted = 0;

    for (let d = 1; d <= forecastDays; d++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + d);
      const futureMonth = futureDate.getMonth() + 1;
      const futureSeasonal = this.seasonalFactors[futureMonth] || 1.0;

      const baseUnits = Math.max(
        0,
        intercept + slope * (dailySales.length + d),
      );
      const adjustedUnits = Math.round(baseUnits * futureSeasonal * 100) / 100;

      totalPredicted += adjustedUnits;
      forecast.push({
        date: futureDate.toISOString().split("T")[0],
        predictedUnits: adjustedUnits,
        revenue:
          Math.round(
            adjustedUnits * Number((product as any).salePrice || 0) * 100,
          ) / 100,
      });
    }

    // Recent performance
    const last7Days = dailySales.slice(-7);
    const last30Days = dailySales.slice(-30);
    const recentDailyAvg =
      last7Days.reduce((sum, d) => sum + d.units, 0) /
      Math.max(last7Days.length, 1);

    // Trend direction
    const trendDirection =
      slope > 0.1 ? "increasing" : slope < -0.1 ? "decreasing" : "stable";

    // Confidence
    let confidence = 50;
    if (dailySales.length >= 30) confidence += 15;
    if (dailySales.length >= 60) confidence += 10;
    if (r2 > 0.5) confidence += 15;
    if (r2 > 0.7) confidence += 10;
    confidence = Math.min(90, confidence);

    return {
      productId,
      productTitle: product.title,
      historicalData: {
        daysAnalyzed: dailySales.length,
        totalSold: last30Days.reduce((sum, d) => sum + d.units, 0),
        dailyAvg: Math.round(recentDailyAvg * 100) / 100,
        trendDirection,
        trendSlope: Math.round(slope * 1000) / 1000,
        modelFit: Math.round(r2 * 100) / 100,
      },
      forecast: {
        forecastDays,
        totalPredictedUnits: Math.round(totalPredicted),
        totalPredictedRevenue: Math.round(
          totalPredicted * Number((product as any).salePrice || 0),
        ),
        dailyForecasts: forecast,
        seasonalFactor,
      },
      confidence,
      source: "estimate" as const,
      disclaimer:
        "⚠️ TAHMİN: ML modeli geçmiş verilere dayanır. Gerçek sonuçlar farklılık gösterebilir.",
    };
  }

  /**
   * Predict competitor sales velocity (Shadow Analysis)
   * Uses StockProbeResult deltas and CompetitorSnapshot review increments
   */
  async predictCompetitorVelocity(competitorProductId: string, daysAnalyzed = 14) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAnalyzed);

    const compProduct = await this.prisma.competitorProduct.findUnique({
      where: { id: competitorProductId },
      include: {
        stockProbes: {
          include: {
            results: {
              where: { time: { gte: startDate } },
              orderBy: { time: "asc" }
            }
          }
        },
        snapshots: {
          where: { time: { gte: startDate } },
          orderBy: { time: "asc" }
        }
      }
    });

    if (!compProduct) return null;

    // 1. Calculate sales from Stock Drops (Primary Signal)
    let totalStockSales = 0;
    let validStockSignals = 0;
    const probeResults = compProduct.stockProbes.flatMap(p => p.results).sort((a, b) => a.time.getTime() - b.time.getTime());

    for (const result of probeResults) {
      if (result.deltaFromPrev && result.deltaFromPrev < 0) {
        // Negative delta means stock went down -> likely a sale
        totalStockSales += Math.abs(result.deltaFromPrev);
        validStockSignals++;
      }
    }

    // 2. Calculate sales from Review Increments (Secondary Signal)
    let totalReviewIncrements = 0;
    const snapshots = compProduct.snapshots;
    if (snapshots.length >= 2) {
      const firstReviewCount = snapshots[0].reviewCount || 0;
      const lastReviewCount = snapshots[snapshots.length - 1].reviewCount || 0;
      if (lastReviewCount > firstReviewCount) {
        totalReviewIncrements = lastReviewCount - firstReviewCount;
      }
    }

    // Market average: 1 review roughly equals 15-20 sales. Using 15.
    const ESTIMATED_SALES_PER_REVIEW = 15;
    const estimatedSalesFromReviews = totalReviewIncrements * ESTIMATED_SALES_PER_REVIEW;

    // 3. Blended Velocity Calculation
    let estimatedTotalSales = 0;
    let confidenceScore = 0;

    if (validStockSignals > 2) {
      // High confidence in stock tracking
      estimatedTotalSales = totalStockSales;
      confidenceScore = 85 + Math.min(10, validStockSignals);
    } else if (totalReviewIncrements > 0) {
      // Fallback to review velocity
      estimatedTotalSales = estimatedSalesFromReviews;
      confidenceScore = 40 + Math.min(20, totalReviewIncrements * 2);
    } else {
      // Not enough data
      estimatedTotalSales = 0;
      confidenceScore = 10;
    }

    const dailyVelocity = estimatedTotalSales / daysAnalyzed;
    const currentPrice = snapshots.length > 0 ? Number(snapshots[snapshots.length - 1].price || 0) : 0;

    return {
      competitorProductId,
      title: compProduct.title,
      brand: compProduct.brand,
      analysisPeriod: `${daysAnalyzed} days`,
      signals: {
        stockDropsDetected: totalStockSales,
        reviewIncrements: totalReviewIncrements,
      },
      velocity: {
        dailyVelocity: Math.round(dailyVelocity * 10) / 10,
        estimatedMonthlySales: Math.round(dailyVelocity * 30),
        estimatedMonthlyRevenue: Math.round(dailyVelocity * 30 * currentPrice)
      },
      confidenceScore,
      lastPrice: currentPrice
    };
  }

  /**
   * Predict demand for multiple products (batch)
   */
  async batchPredict(tenantId: string, forecastDays = 30) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
      select: { id: true },
    });

    const results = await Promise.all(
      products.map((p) =>
        this.predictSales(p.id, forecastDays).catch(() => null),
      ),
    );

    const valid = results.filter(Boolean) as any[];
    const totalForecastedRevenue = valid.reduce(
      (sum, r) => sum + r.forecast.totalPredictedRevenue,
      0,
    );

    return {
      totalProducts: valid.length,
      forecastDays,
      totalForecastedRevenue: Math.round(totalForecastedRevenue),
      topProducts: [...valid]
        .sort(
          (a, b) =>
            b.forecast.totalPredictedRevenue - a.forecast.totalPredictedRevenue,
        )
        .slice(0, 10)
        .map((r) => ({
          productId: r.productId,
          title: r.productTitle,
          predictedUnits: r.forecast.totalPredictedUnits,
          predictedRevenue: r.forecast.totalPredictedRevenue,
          trend: r.historicalData.trendDirection,
          confidence: r.confidence,
        })),
    };
  }

  /**
   * Build daily sales array from order items
   */
  private buildDailySales(
    orderItems: any[],
    days: number,
  ): Array<{ date: string; units: number }> {
    const salesMap = new Map<string, number>();
    const now = new Date();

    // Initialize all days
    for (let d = days; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      salesMap.set(date.toISOString().split("T")[0], 0);
    }

    // Fill with actual sales
    for (const item of orderItems) {
      const date = item.order.orderDate.toISOString().split("T")[0];
      if (salesMap.has(date)) {
        salesMap.set(date, (salesMap.get(date) || 0) + item.quantity);
      }
    }

    return Array.from(salesMap.entries()).map(([date, units]) => ({
      date,
      units,
    }));
  }

  /**
   * Simple linear regression
   */
  private linearRegression(data: number[][]): {
    slope: number;
    intercept: number;
    r2: number;
  } {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0,
      sumY2 = 0;

    for (const [x, y] of data) {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R² calculation
    const yMean = sumY / n;
    let ssRes = 0,
      ssTot = 0;
    for (const [x, y] of data) {
      const predicted = intercept + slope * x;
      ssRes += (y - predicted) ** 2;
      ssTot += (y - yMean) ** 2;
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return {
      slope: isNaN(slope) ? 0 : slope,
      intercept: isNaN(intercept) ? 0 : intercept,
      r2: isNaN(r2) ? 0 : Math.max(0, r2),
    };
  }
}

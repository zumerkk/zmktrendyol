import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * CashFlowForecastService — Nakit Akışı Tahmini
 *
 * Trendyol ödeme takvimini kullanarak gelecekteki nakit akışını tahmin eder.
 * - Günlük/haftalık/aylık gelir tahmini
 * - Gider projeksiyonu (reklam, kargo, COGS, komisyon)
 * - Net nakit pozisyonu
 * - Likidite erken uyarı
 */
@Injectable()
export class CashFlowForecastService {
  private readonly logger = new Logger(CashFlowForecastService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Full cash flow projection for a tenant
   */
  async getCashFlowForecast(tenantId: string, days = 90) {
    // Historical income from orders
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const orders = await this.prisma.order.findMany({
      where: { tenantId, orderDate: { gte: threeMonthsAgo } },
      include: { items: true },
      orderBy: { orderDate: "asc" },
    });

    // Calculate daily revenue
    const dailyRevenue = new Map<string, number>();
    for (const order of orders) {
      const date = order.orderDate.toISOString().split("T")[0];
      const revenue = order.items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      );
      dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + revenue);
    }

    // Average daily metrics
    const revenueValues = Array.from(dailyRevenue.values());
    const avgDailyRevenue =
      revenueValues.length > 0
        ? revenueValues.reduce((s, v) => s + v, 0) / revenueValues.length
        : 0;

    // Get active products for cost estimation
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
    });

    // Estimate daily costs
    const avgCommissionRate =
      products.length > 0
        ? products.reduce((s, p) => s + Number(p.commissionRate || 15), 0) /
          products.length /
          100
        : 0.15;

    const avgShippingCost = 15; // ₺15 avg kargo
    const dailyOrders = orders.length > 0 ? orders.length / 90 : 0;

    const dailyCosts = {
      commission: avgDailyRevenue * avgCommissionRate,
      shipping: dailyOrders * avgShippingCost,
      cogs: avgDailyRevenue * 0.35, // Estimated COGS ratio
      ads: 0, // Will be fetched
    };

    // Ad spend
    const adMetrics = await this.prisma.adDailyMetric.findMany({
      where: {
        campaign: { tenantId },
        date: { gte: threeMonthsAgo },
      },
    });
    const totalAdSpend = adMetrics.reduce(
      (s, m) => s + Number(m.spend),
      0,
    );
    dailyCosts.ads = adMetrics.length > 0 ? totalAdSpend / 90 : 0;

    const totalDailyCost =
      dailyCosts.commission +
      dailyCosts.shipping +
      dailyCosts.cogs +
      dailyCosts.ads;

    const dailyNetCash = avgDailyRevenue - totalDailyCost;

    // Generate forecast
    const forecast: Array<{
      date: string;
      revenue: number;
      costs: number;
      netCash: number;
      cumulative: number;
    }> = [];

    let cumulative = 0;
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + i);

      // Day of week factor (weekends lower)
      const dayOfWeek = futureDate.getDay();
      const dayFactor =
        dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.1;

      const revenue = round(avgDailyRevenue * dayFactor);
      const costs = round(totalDailyCost * dayFactor);
      const netCash = round(revenue - costs);
      cumulative += netCash;

      forecast.push({
        date: futureDate.toISOString().split("T")[0],
        revenue,
        costs,
        netCash,
        cumulative: round(cumulative),
      });
    }

    // Trendyol payment schedule (every 2 weeks approximately)
    const paymentDates: Array<{ date: string; estimatedAmount: number }> = [];
    for (let i = 14; i <= days; i += 14) {
      const payDate = new Date(today);
      payDate.setDate(payDate.getDate() + i);
      paymentDates.push({
        date: payDate.toISOString().split("T")[0],
        estimatedAmount: round(avgDailyRevenue * 14 * (1 - avgCommissionRate)),
      });
    }

    return {
      summary: {
        avgDailyRevenue: round(avgDailyRevenue),
        avgDailyCost: round(totalDailyCost),
        avgDailyProfit: round(dailyNetCash),
        profitMargin: avgDailyRevenue > 0
          ? round((dailyNetCash / avgDailyRevenue) * 100)
          : 0,
        costBreakdown: {
          commission: round(dailyCosts.commission),
          shipping: round(dailyCosts.shipping),
          cogs: round(dailyCosts.cogs),
          ads: round(dailyCosts.ads),
        },
      },
      projections: {
        next30Days: {
          revenue: round(forecast.slice(0, 30).reduce((s, f) => s + f.revenue, 0)),
          costs: round(forecast.slice(0, 30).reduce((s, f) => s + f.costs, 0)),
          netCash: round(forecast.slice(0, 30).reduce((s, f) => s + f.netCash, 0)),
        },
        next60Days: {
          revenue: round(forecast.slice(0, 60).reduce((s, f) => s + f.revenue, 0)),
          costs: round(forecast.slice(0, 60).reduce((s, f) => s + f.costs, 0)),
          netCash: round(forecast.slice(0, 60).reduce((s, f) => s + f.netCash, 0)),
        },
        next90Days: {
          revenue: round(forecast.slice(0, 90).reduce((s, f) => s + f.revenue, 0)),
          costs: round(forecast.slice(0, 90).reduce((s, f) => s + f.costs, 0)),
          netCash: round(forecast.slice(0, 90).reduce((s, f) => s + f.netCash, 0)),
        },
      },
      trendyolPayments: paymentDates,
      forecast: forecast.slice(0, 30), // Only return 30 days of daily data
      healthCheck: {
        status: dailyNetCash > 0 ? "healthy" : "warning",
        message:
          dailyNetCash > 0
            ? `✅ Günlük ₺${round(dailyNetCash)} net kâr üretiyorsun`
            : `⚠️ Günlük ₺${round(Math.abs(dailyNetCash))} zarar — maliyetleri gözden geçir`,
        suggestions: [
          ...(dailyCosts.ads > avgDailyRevenue * 0.1
            ? ["Reklam harcaması gelirin %10'unu aşıyor — ACoS optimizasyonu yap"]
            : []),
          ...(dailyCosts.shipping > avgDailyRevenue * 0.08
            ? ["Kargo maliyeti yüksek — Trendyol kargo anlaşmasını kontrol et"]
            : []),
        ],
      },
      source: "estimate" as const,
    };
  }

  /**
   * Breakeven analysis — kaç sipariş gerekli?
   */
  async getBreakevenAnalysis(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
    });

    const analyses = products.slice(0, 30).map((p) => {
      const price = Number((p as any).salePrice || 0);
      const cost = Number(p.costPrice || price * 0.4);
      const commission = price * Number(p.commissionRate || 15) / 100;
      const shipping = Number(p.shippingCost || 15);
      const packaging = Number(p.packagingCost || 2);

      const profitPerUnit = price - cost - commission - shipping - packaging;
      const fixedMonthlyCosts = 5000; // estimated monthly fixed costs

      return {
        productId: p.id,
        title: p.title,
        price: round(price),
        profitPerUnit: round(profitPerUnit),
        breakevenUnits: profitPerUnit > 0
          ? Math.ceil(fixedMonthlyCosts / profitPerUnit)
          : null,
        marginPercent: price > 0 ? round((profitPerUnit / price) * 100) : 0,
        status:
          profitPerUnit <= 0
            ? "🔴 Zararlı"
            : profitPerUnit < 10
              ? "🟡 Düşük marj"
              : "🟢 Kârlı",
      };
    });

    analyses.sort((a, b) => (b.profitPerUnit || 0) - (a.profitPerUnit || 0));

    return {
      totalProducts: analyses.length,
      profitable: analyses.filter((a) => (a.profitPerUnit || 0) > 0).length,
      unprofitable: analyses.filter((a) => (a.profitPerUnit || 0) <= 0).length,
      products: analyses,
      source: "estimate" as const,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

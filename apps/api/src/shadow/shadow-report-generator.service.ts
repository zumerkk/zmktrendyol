import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * ShadowReportGenerator — Raporlama Motoru 📋
 *
 * CRON görevleriyle günlük/haftalık/aylık raporlar üretir.
 */
@Injectable()
export class ShadowReportGenerator {
  private readonly logger = new Logger(ShadowReportGenerator.name);

  constructor(private prisma: PrismaService) {}

  @Cron('55 23 * * *')
  async generateDailyReports() {
    this.logger.log('📋 Generating daily reports...');

    const targets: any[] = await (this.prisma as any).shadowTarget.findMany({
      where: { isActive: true },
      select: { id: true, tenantId: true, productName: true },
    });

    let generated = 0;
    for (const target of targets) {
      try {
        await this.generateDailyReportForTarget(target.tenantId, target.id);
        generated++;
      } catch (e: any) {
        this.logger.warn(`Report failed for ${target.id}: ${e.message}`);
      }
    }
    this.logger.log(`📋 Daily reports: ${generated}/${targets.length} generated`);
  }

  async generateDailyReportForTarget(tenantId: string, targetId: string, date?: Date) {
    const reportDate = date || new Date();
    const dayStart = new Date(reportDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(reportDate);
    dayEnd.setHours(23, 59, 59, 999);

    const snapshots: any[] = await (this.prisma as any).shadowSnapshot.findMany({
      where: { targetId, fetchedAt: { gte: dayStart, lte: dayEnd } },
      orderBy: { fetchedAt: 'asc' },
    });

    if (snapshots.length === 0) return null;

    // Price analysis
    const prices: number[] = snapshots.filter((s: any) => s.price !== null).map((s: any) => Number(s.price));
    const avgPrice = prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : null;
    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;

    // Stock analysis
    const stocks = snapshots.filter((s: any) => s.stockCount !== null);
    const startStock = stocks.length ? stocks[0].stockCount : null;
    const endStock = stocks.length ? stocks[stocks.length - 1].stockCount : null;

    // Sales from stock logs
    const stockLogs: any[] = await (this.prisma as any).shadowStockLog.findMany({
      where: { targetId, detectedAt: { gte: dayStart, lte: dayEnd } },
    });
    const salesLogs = stockLogs.filter((l: any) => l.eventType === 'sale');
    const restockLogs = stockLogs.filter((l: any) => l.eventType === 'restock');
    const estimatedSales = salesLogs.reduce((s: number, l: any) => s + Math.abs(l.delta || 0), 0);
    const restockCount = restockLogs.length;

    // Review delta
    const reviews = snapshots.filter((s: any) => s.reviewCount !== null);
    const reviewDelta = reviews.length >= 2
      ? (reviews[reviews.length - 1].reviewCount || 0) - (reviews[0].reviewCount || 0)
      : null;

    // Rating change
    const ratings = snapshots.filter((s: any) => s.rating !== null);
    const ratingChange = ratings.length >= 2
      ? Number(ratings[ratings.length - 1].rating) - Number(ratings[0].rating)
      : null;

    // Price change percent
    const priceChangePercent = prices.length >= 2
      ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
      : null;

    // AI Summary
    const aiSummary = this.generateAISummary({ estimatedSales, startStock, endStock, avgPrice, priceChangePercent, reviewDelta, restockCount });

    return (this.prisma as any).shadowDailyReport.upsert({
      where: { targetId_reportDate: { targetId, reportDate: dayStart } },
      update: {
        avgPrice: avgPrice as any, minPrice: minPrice as any, maxPrice: maxPrice as any,
        priceChangePercent: priceChangePercent as any,
        startStock, endStock, estimatedSales, restockCount, reviewDelta,
        ratingChange: ratingChange as any,
        aiSummary: aiSummary.summary, aiRecommendation: aiSummary.recommendation,
      },
      create: {
        targetId, tenantId, reportDate: dayStart,
        avgPrice: avgPrice as any, minPrice: minPrice as any, maxPrice: maxPrice as any,
        priceChangePercent: priceChangePercent as any,
        startStock, endStock, estimatedSales, restockCount, reviewDelta,
        ratingChange: ratingChange as any,
        aiSummary: aiSummary.summary, aiRecommendation: aiSummary.recommendation,
      },
    });
  }

  async getWeeklyReport(tenantId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const reports: any[] = await (this.prisma as any).shadowDailyReport.findMany({
      where: { tenantId, reportDate: { gte: weekAgo } },
      include: {
        target: { select: { id: true, productName: true, trendyolUrl: true, brand: true, currentPrice: true } },
      },
      orderBy: { reportDate: 'desc' },
    });

    const targetMap = new Map<string, any>();
    for (const report of reports) {
      const tid = report.targetId;
      if (!targetMap.has(tid)) {
        targetMap.set(tid, {
          target: report.target, totalSales: 0, totalRestock: 0,
          avgPrice: 0, pricePoints: [] as number[], reviewDelta: 0, days: 0,
        });
      }
      const agg = targetMap.get(tid);
      agg.totalSales += report.estimatedSales || 0;
      agg.totalRestock += report.restockCount || 0;
      if (report.avgPrice) agg.pricePoints.push(Number(report.avgPrice));
      agg.reviewDelta += report.reviewDelta || 0;
      agg.days++;
    }

    const results = Array.from(targetMap.values()).map((agg: any) => ({
      ...agg,
      avgPrice: agg.pricePoints.length
        ? Math.round((agg.pricePoints.reduce((a: number, b: number) => a + b, 0) / agg.pricePoints.length) * 100) / 100
        : null,
      dailyAvgSales: agg.days > 0 ? Math.round((agg.totalSales / agg.days) * 100) / 100 : 0,
      estimatedMonthlySales: agg.days > 0 ? Math.round((agg.totalSales / agg.days) * 30) : 0,
      pricePoints: undefined,
    }));

    results.sort((a: any, b: any) => b.totalSales - a.totalSales);

    return {
      period: 'weekly',
      from: weekAgo.toISOString(),
      to: now.toISOString(),
      targets: results,
      topSeller: results[0] || null,
      totalEstimatedSales: results.reduce((s: number, r: any) => s + r.totalSales, 0),
    };
  }

  async getMonthlyReport(tenantId: string) {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const reports: any[] = await (this.prisma as any).shadowDailyReport.findMany({
      where: { tenantId, reportDate: { gte: monthAgo } },
      include: {
        target: { select: { id: true, productName: true, trendyolUrl: true, brand: true, currentPrice: true } },
      },
      orderBy: { reportDate: 'desc' },
    });

    const targetMap = new Map<string, any>();
    for (const r of reports) {
      if (!targetMap.has(r.targetId)) {
        targetMap.set(r.targetId, {
          target: r.target, totalSales: 0, totalRestock: 0,
          priceHistory: [] as Array<{ date: Date; price: number }>, reviewGrowth: 0, days: 0,
        });
      }
      const a = targetMap.get(r.targetId);
      a.totalSales += r.estimatedSales || 0;
      a.totalRestock += r.restockCount || 0;
      if (r.avgPrice) a.priceHistory.push({ date: r.reportDate, price: Number(r.avgPrice) });
      a.reviewGrowth += r.reviewDelta || 0;
      a.days++;
    }

    const results = Array.from(targetMap.values()).map((a: any) => {
      const avgPrice = a.priceHistory.length
        ? a.priceHistory.reduce((s: number, p: any) => s + p.price, 0) / a.priceHistory.length
        : 0;
      return {
        target: a.target, totalSales: a.totalSales, totalRestock: a.totalRestock,
        avgPrice: Math.round(avgPrice * 100) / 100,
        estimatedRevenue: Math.round(a.totalSales * avgPrice),
        reviewGrowth: a.reviewGrowth,
        dailyAvgSales: a.days > 0 ? Math.round((a.totalSales / a.days) * 100) / 100 : 0,
        days: a.days, priceHistory: a.priceHistory,
      };
    });

    results.sort((a: any, b: any) => b.totalSales - a.totalSales);

    return {
      period: 'monthly',
      from: monthAgo.toISOString(),
      to: now.toISOString(),
      targets: results,
      totalEstimatedSales: results.reduce((s: number, r: any) => s + r.totalSales, 0),
      totalEstimatedRevenue: results.reduce((s: number, r: any) => s + r.estimatedRevenue, 0),
      topSellers: results.slice(0, 5),
    };
  }

  private generateAISummary(data: {
    estimatedSales: number;
    startStock: number | null;
    endStock: number | null;
    avgPrice: number | null;
    priceChangePercent: number | null;
    reviewDelta: number | null;
    restockCount: number;
  }) {
    const parts: string[] = [];
    const recs: string[] = [];

    if (data.estimatedSales > 0) {
      parts.push(`Bugün tahmini ${data.estimatedSales} adet satış gerçekleşti.`);
      if (data.estimatedSales > 20) {
        parts.push('Satış hızı yüksek — trend ürün olabilir.');
        recs.push('Bu kategoride benzer ürün listelemeyi değerlendirin.');
      }
    } else {
      parts.push('Bugün satış tespit edilmedi veya veri yetersiz.');
    }

    if (data.endStock !== null) {
      if (data.endStock === 0) {
        parts.push('Ürün stoğu tamamen tükendi!');
        recs.push('OOS fırsatı: Aynı kategoride fiyatınızı hafif artırabilirsiniz.');
      } else if (data.endStock <= 5) {
        parts.push(`Stok kritik seviyede: ${data.endStock} adet.`);
        recs.push('Rakip stoğu tükenmek üzere — pazardan pay kapma fırsatı.');
      }
    }

    if (data.priceChangePercent !== null && Math.abs(data.priceChangePercent) > 2) {
      if (data.priceChangePercent > 0) {
        parts.push(`Fiyat %${data.priceChangePercent.toFixed(1)} arttı.`);
        recs.push('Rakip fiyat artırdı, marjınızı optimize edin.');
      } else {
        parts.push(`Fiyat %${Math.abs(data.priceChangePercent).toFixed(1)} düştü.`);
        recs.push('Rakip fiyat indirdi, rekabetçi fiyatınızı gözden geçirin.');
      }
    }

    if (data.restockCount > 0) parts.push(`${data.restockCount} kez stok yenilemesi tespit edildi.`);
    if (data.reviewDelta !== null && data.reviewDelta > 0) parts.push(`${data.reviewDelta} yeni yorum eklendi.`);

    return {
      summary: parts.join(' ') || 'Yeterli veri yok.',
      recommendation: recs.join(' ') || 'Mevcut stratejiyi sürdürün.',
    };
  }
}

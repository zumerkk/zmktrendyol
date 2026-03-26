import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * TrendHeatmapService — Kategori Bazlı Trend Haritası
 *
 * Trendyol kategorilerindeki sıcaklığı ölç:
 * - Hangisi yükseliyor? Hangisi düşüyor?
 * - Mevsimsellik + pazar büyüklüğü
 * - "Şu an hangi kategoriye girmeli?"
 */
@Injectable()
export class TrendHeatmapService {
  private readonly logger = new Logger(TrendHeatmapService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get heatmap data from scraped market snapshots
   */
  async getHeatmap(tenantId: string, options?: { days?: number }) {
    const days = options?.days || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get market snapshots
    const snapshots = await this.prisma.marketSnapshot.findMany({
      where: { tenantId, time: { gte: startDate } },
      orderBy: { time: "desc" },
    });

    // Group by category
    const categoryMap = new Map<
      string,
      {
        name: string;
        dataPoints: Array<{
          date: string;
          avgPrice: number;
          productCount: number;
        }>;
        totalProducts: number;
        avgPrice: number;
      }
    >();

    for (const snap of snapshots) {
      const data = snap.data as any;
      if (!data?.category) continue;

      const existing = categoryMap.get(data.category) || {
        name: data.category,
        dataPoints: [] as Array<{
          date: string;
          avgPrice: number;
          productCount: number;
        }>,
        totalProducts: 0,
        avgPrice: 0,
      };

      existing.dataPoints.push({
        date: snap.time.toISOString().split("T")[0],
        avgPrice: data.avgPrice || 0,
        productCount: data.productCount || 0,
      });
      existing.totalProducts = Math.max(
        existing.totalProducts,
        data.productCount || 0,
      );
      existing.avgPrice = data.avgPrice || existing.avgPrice;

      categoryMap.set(data.category, existing);
    }

    // Calculate trends
    const categories = Array.from(categoryMap.values()).map((cat) => {
      const points = cat.dataPoints.sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      let trend: "rising" | "falling" | "stable" = "stable";
      let growthPercent = 0;

      if (points.length >= 2) {
        const first = points[0].productCount;
        const last = points[points.length - 1].productCount;
        if (first > 0) {
          growthPercent = Math.round(((last - first) / first) * 100);
          trend =
            growthPercent > 5
              ? "rising"
              : growthPercent < -5
                ? "falling"
                : "stable";
        }
      }

      // Heat score (0-100)
      let heatScore = 50;
      if (trend === "rising") heatScore += Math.min(growthPercent, 40);
      if (trend === "falling")
        heatScore -= Math.min(Math.abs(growthPercent), 30);
      if (cat.totalProducts > 1000) heatScore += 10;
      heatScore = Math.max(0, Math.min(100, heatScore));

      return {
        category: cat.name,
        heatScore,
        trend,
        growthPercent,
        totalProducts: cat.totalProducts,
        avgPrice: Math.round(cat.avgPrice * 100) / 100,
        dataPoints: points.slice(-14), // last 14 data points
      };
    });

    // Sort by heat score descending
    categories.sort((a, b) => b.heatScore - a.heatScore);

    return {
      period: `${days} gün`,
      totalCategories: categories.length,
      hotCategories: categories.filter((c) => c.heatScore >= 70),
      risingCategories: categories.filter((c) => c.trend === "rising"),
      fallingCategories: categories.filter((c) => c.trend === "falling"),
      allCategories: categories,
      source: "estimate" as const,
    };
  }

  /**
   * Get trend for a specific category
   */
  async getCategoryTrend(tenantId: string, categoryName: string) {
    const days = 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await this.prisma.marketSnapshot.findMany({
      where: {
        tenantId,
        time: { gte: startDate },
      },
      orderBy: { time: "asc" },
    });

    const relevantSnapshots = snapshots.filter((s) => {
      const data = s.data as any;
      return data?.category?.toLowerCase() === categoryName.toLowerCase();
    });

    if (relevantSnapshots.length === 0) {
      return {
        message: "Bu kategori için veri bulunamadı",
        source: "estimate",
      };
    }

    const timeline = relevantSnapshots.map((s) => {
      const data = s.data as any;
      return {
        date: s.time.toISOString().split("T")[0],
        productCount: data.productCount || 0,
        avgPrice: data.avgPrice || 0,
        topProducts: data.topProducts?.slice(0, 5) || [],
      };
    });

    return {
      category: categoryName,
      period: `${days} gün`,
      dataPoints: timeline,
      currentProducts: timeline[timeline.length - 1]?.productCount || 0,
      currentAvgPrice: timeline[timeline.length - 1]?.avgPrice || 0,
      source: "estimate" as const,
    };
  }

  /**
   * Record a market snapshot for trend tracking
   */
  async recordSnapshot(
    tenantId: string,
    data: {
      category: string;
      productCount: number;
      avgPrice: number;
      topProducts?: Array<{ title: string; price: number; rating?: number }>;
    },
  ) {
    return this.prisma.marketSnapshot.create({
      data: {
        tenantId,
        type: "category_trend",
        data: data as any,
      },
    });
  }
}

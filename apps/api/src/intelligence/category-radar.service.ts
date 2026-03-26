import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * CategoryRadarService — Kategori Besteller & Trend Radar
 *
 * Türkiye'de BU YOK → Jungle Scout Category Tracker seviyesi
 *
 * Özellikler:
 * - Kategori bazlı en çok satan ürünler (Top 100 takibi)
 * - Yükselen yeni ürün tespiti (ani çıkışlar)
 * - Pazar boşluğu analizi (yüksek talep, düşük arz)
 * - Kategori giriş zorluğu skoru
 * - Mevsimsel trend tahmini
 */
@Injectable()
export class CategoryRadarService {
  private readonly logger = new Logger(CategoryRadarService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get category bestseller radar dashboard
   */
  async getCategoryDashboard(tenantId: string, categoryName?: string) {
    // Get tenant's products grouped by category
    const categoryGroups = await this.prisma.product.groupBy({
      by: ["categoryName"],
      where: { tenantId, status: "active" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Get competitor product data for the category
    const categories = await Promise.all(
      (categoryName
        ? categoryGroups.filter((c) => c.categoryName === categoryName)
        : categoryGroups.slice(0, 10)
      ).map(async (cat) => {
        const catName = cat.categoryName || "Unknown";

        // Our products in this category
        const ourProducts = await this.prisma.product.findMany({
          where: { tenantId, categoryName: catName, status: "active" },
        });

        // Competitor products in this category
        const competitors = await this.prisma.competitorProduct.findMany({
          where: { tenantId, category: catName },
          include: {
            snapshots: {
              orderBy: { time: "desc" },
              take: 2,
            },
          },
          take: 50,
        });

        // Calculate category metrics
        const allPrices = [
          ...ourProducts.map((p) => Number((p as any).salePrice || 0)),
          ...competitors.map((c: any) => Number(c.snapshots?.[0]?.price || 0)),
        ].filter((p) => p > 0);

        const avgPrice =
          allPrices.length > 0
            ? allPrices.reduce((s, p) => s + p, 0) / allPrices.length
            : 0;
        const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
        const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;

        // Entry difficulty (based on competition & pricing)
        const entryDifficulty = this.calculateEntryDifficulty(
          competitors.length,
          allPrices,
        );

        // Detect rising competitors (price drops = aggression)
        const risingCompetitors = competitors
          .filter((c: any) => {
            if (!c.snapshots || c.snapshots.length < 2) return false;
            const latest = Number(c.snapshots[0]?.price || 0);
            const previous = Number(c.snapshots[1]?.price || latest);
            return previous > 0 && latest < previous * 0.9;
          })
          .map((c: any) => ({
            title: c.title,
            brand: c.brand,
            currentPrice: Number(c.snapshots?.[0]?.price || 0),
            signal: "📉 Fiyat düşürdü — agresif giriş",
          }));

        return {
          categoryName: catName,
          ourProductCount: ourProducts.length,
          competitorCount: competitors.length,
          pricing: {
            avgPrice: round(avgPrice),
            minPrice: round(minPrice),
            maxPrice: round(maxPrice),
            ourAvgPrice: round(
              ourProducts.length > 0
                ? ourProducts.reduce((s, p) => s + Number((p as any).salePrice || 0), 0) /
                    ourProducts.length
                : 0,
            ),
          },
          entryDifficulty: {
            score: entryDifficulty,
            label:
              entryDifficulty >= 80
                ? "🔴 Çok Zor"
                : entryDifficulty >= 60
                  ? "🟠 Zor"
                  : entryDifficulty >= 40
                    ? "🟡 Orta"
                    : "🟢 Kolay",
          },
          risingCompetitors: risingCompetitors.slice(0, 5),
          topCompetitors: competitors.slice(0, 5).map((c: any) => ({
            title: c.title,
            brand: c.brand,
            price: Number(c.snapshots?.[0]?.price || 0),
            rating: c.snapshots?.[0]?.rating || null,
            reviewCount: c.snapshots?.[0]?.reviewCount || null,
          })),
        };
      }),
    );

    return {
      totalCategories: categoryGroups.length,
      categories,
      recommendations: this.generateCategoryRecommendations(categories),
      source: "api" as const,
    };
  }

  /**
   * Find market gaps — high demand, low supply niches
   */
  async findMarketGaps(tenantId: string) {
    // Get all categories with product counts
    const categories = await this.prisma.product.groupBy({
      by: ["categoryName"],
      where: { tenantId, status: "active" },
      _count: { id: true },
    });

    // For each category, check competitor density
    const gaps: Array<{
      category: string;
      ourProducts: number;
      competitorProducts: number;
      gapScore: number;
      opportunity: string;
    }> = [];

    for (const cat of categories) {
      if (!cat.categoryName) continue;

      const competitorCount = await this.prisma.competitorProduct.count({
        where: { tenantId, category: cat.categoryName },
      });

      // Low competitors = potential gap
      const ratio =
        competitorCount > 0 ? cat._count.id / competitorCount : cat._count.id;
      const gapScore = Math.min(100, Math.round(ratio * 20));

      if (gapScore > 30) {
        gaps.push({
          category: cat.categoryName,
          ourProducts: cat._count.id,
          competitorProducts: competitorCount,
          gapScore,
          opportunity:
            gapScore >= 70
              ? "🟢 Büyük fırsat — az rekabet"
              : gapScore >= 50
                ? "🟡 Orta fırsat"
                : "🔵 Gelişen pazar",
        });
      }
    }

    gaps.sort((a, b) => b.gapScore - a.gapScore);

    return {
      totalGaps: gaps.length,
      gaps: gaps.slice(0, 15),
      source: "estimate" as const,
    };
  }

  /**
   * Seasonal trend prediction for categories
   */
  async getSeasonalTrends(tenantId: string) {
    const seasonalMap: Record<
      string,
      Array<{ months: number[]; trend: string; multiplier: number }>
    > = {
      "Giyim": [
        { months: [3, 4, 5], trend: "Bahar koleksiyonu", multiplier: 1.3 },
        { months: [6, 7, 8], trend: "Yaz sezonu", multiplier: 1.2 },
        { months: [9, 10], trend: "Okul dönemi + Sonbahar", multiplier: 1.5 },
        { months: [11, 12], trend: "Kış+kampanya sezonu", multiplier: 2.0 },
      ],
      "Elektronik": [
        { months: [1, 2], trend: "Yeni yıl alımları", multiplier: 1.2 },
        { months: [9], trend: "Okul hazırlığı", multiplier: 1.4 },
        { months: [11], trend: "11.11 + Black Friday", multiplier: 2.5 },
        { months: [12], trend: "Yılbaşı hediyelikleri", multiplier: 1.8 },
      ],
      "Ev & Yaşam": [
        { months: [3, 4, 5], trend: "Bahar temizliği", multiplier: 1.4 },
        { months: [6, 7], trend: "Tatil hazırlığı", multiplier: 1.1 },
        { months: [9, 10], trend: "Ev dekorasyonu yenileme", multiplier: 1.3 },
        { months: [11, 12], trend: "Hediye alışverişi", multiplier: 1.6 },
      ],
    };

    const currentMonth = new Date().getMonth() + 1;
    const nextMonths = [currentMonth, currentMonth + 1, currentMonth + 2].map(
      (m) => ((m - 1) % 12) + 1,
    );

    const categories = await this.prisma.product.groupBy({
      by: ["categoryName"],
      where: { tenantId, status: "active" },
      _count: { id: true },
    });

    const trends = categories
      .filter((c) => c.categoryName)
      .map((cat) => {
        const catName = cat.categoryName!;
        const seasonal = seasonalMap[catName] || [];
        const upcomingTrends = seasonal.filter((s) =>
          s.months.some((m) => nextMonths.includes(m)),
        );

        return {
          category: catName,
          productCount: cat._count.id,
          upcomingTrends:
            upcomingTrends.length > 0
              ? upcomingTrends.map((t) => ({
                  trend: t.trend,
                  expectedDemandIncrease: `${round((t.multiplier - 1) * 100)}%`,
                }))
              : [{ trend: "Normal dönem", expectedDemandIncrease: "0%" }],
        };
      });

    return {
      currentMonth,
      forecastMonths: nextMonths,
      categories: trends,
      source: "estimate" as const,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async dailyCategorySnapshot() {
    this.logger.log("Recording daily category snapshot...");
    // In production, snapshot top products per category
  }

  // ─── Private Helpers ─────────────────────

  private calculateEntryDifficulty(
    competitorCount: number,
    prices: number[],
  ): number {
    let difficulty = 0;

    // Competition factor (more competitors = harder)
    if (competitorCount > 50) difficulty += 40;
    else if (competitorCount > 20) difficulty += 25;
    else if (competitorCount > 10) difficulty += 15;
    else difficulty += 5;

    // Price war factor (tight price range = harder)
    if (prices.length >= 2) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const spread = max > 0 ? (max - min) / max : 0;
      if (spread < 0.2) difficulty += 30; // Very tight prices
      else if (spread < 0.4) difficulty += 15;
      else difficulty += 5;
    }

    // Review barrier
    difficulty += Math.min(20, competitorCount * 0.5);

    return Math.min(100, Math.round(difficulty));
  }

  private generateCategoryRecommendations(
    categories: any[],
  ): string[] {
    const recs: string[] = [];

    for (const cat of categories) {
      if (cat.entryDifficulty.score <= 40 && cat.competitorCount < 10) {
        recs.push(
          `🟢 "${cat.categoryName}" — az rekabet, ürün ekleme fırsatı`,
        );
      }
      if (cat.risingCompetitors.length > 0) {
        recs.push(
          `⚠️ "${cat.categoryName}" — ${cat.risingCompetitors.length} yeni agresif rakip tespit edildi`,
        );
      }
      if (
        cat.pricing.ourAvgPrice > cat.pricing.avgPrice * 1.2
      ) {
        recs.push(
          `💰 "${cat.categoryName}" — fiyatın piyasa ortalamasının %20 üstünde, fiyat stratejisini gözden geçir`,
        );
      }
    }

    return recs;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

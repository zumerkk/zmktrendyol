import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * ProductResearchService — Ürün Fırsat Keşfi (Jungle Scout mantığı)
 *
 * Yüksek talep + düşük rekabet = 💰
 * - Kategorideki tüm ürünleri tara
 * - Satıcı sayısı vs yorum ortalaması → fırsat puanı
 * - "Bu kategoride 50k yorum var ama sadece 3 satıcı — gir!"
 */
@Injectable()
export class ProductResearchService {
  private readonly logger = new Logger(ProductResearchService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Analyze a category/keyword for opportunity
   */
  async analyzeOpportunity(
    tenantId: string,
    dto: {
      categoryName?: string;
      categoryId?: number;
      keyword?: string;
      scrapedProducts?: Array<{
        title: string;
        price: number;
        rating: number;
        reviewCount: number;
        sellerName: string;
        isSponsored?: boolean;
      }>;
    },
  ) {
    const products = dto.scrapedProducts || [];

    // Calculate metrics
    const totalReviews = products.reduce((sum, p) => sum + p.reviewCount, 0);
    const avgPrice =
      products.length > 0
        ? products.reduce((sum, p) => sum + p.price, 0) / products.length
        : 0;
    const avgRating =
      products.length > 0
        ? products.reduce((sum, p) => sum + p.rating, 0) / products.length
        : 0;
    const uniqueSellers = new Set(products.map((p) => p.sellerName)).size;
    const sponsoredRatio =
      products.length > 0
        ? products.filter((p) => p.isSponsored).length / products.length
        : 0;

    // Demand Score (0-100): based on total reviews & average rating
    const demandScore = Math.min(
      100,
      Math.round(
        Math.min(totalReviews / 1000, 50) + // cap at 50k reviews = 50 points
          (avgRating >= 4 ? 30 : avgRating >= 3 ? 20 : 10) + // rating bonus
          (products.length >= 20 ? 20 : products.length), // variety bonus
      ),
    );

    // Competition Score (0-100): lower is better for entry
    const competitionScore = Math.min(
      100,
      Math.round(
        Math.min(uniqueSellers, 50) + // sellers count
          sponsoredRatio * 30 + // high ad ratio = competitive
          (avgRating >= 4.5 ? 20 : 0), // very high ratings = hard to compete
      ),
    );

    // Opportunity Score (0-100): high demand + low competition = high opportunity
    const opportunityScore = Math.round(
      demandScore * 0.6 + (100 - competitionScore) * 0.4,
    );

    // Price analysis
    const prices = products.map((p) => p.price).sort((a, b) => a - b);
    const priceRange =
      prices.length >= 2
        ? {
            min: prices[0],
            max: prices[prices.length - 1],
            median: prices[Math.floor(prices.length / 2)],
          }
        : null;

    // Top sellers analysis
    const sellerCounts = new Map<string, number>();
    products.forEach((p) => {
      sellerCounts.set(p.sellerName, (sellerCounts.get(p.sellerName) || 0) + 1);
    });
    const topSellers = Array.from(sellerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, productCount: count }));

    // Recommendation
    let recommendation: string;
    if (opportunityScore >= 70) {
      recommendation = `🟢 YÜKSEK FIRSAT! Talep güçlü (${demandScore}/100), rekabet düşük (${competitionScore}/100). Bu kategoriye giriş yapılmalı!`;
    } else if (opportunityScore >= 50) {
      recommendation = `🟡 ORTA FIRSAT. Talep var ama rekabet de yoğun. Niche bir alt segment veya fark yaratan özellikle girilebilir.`;
    } else if (opportunityScore >= 30) {
      recommendation = `🟠 DÜŞÜK FIRSAT. Rekabet çok yoğun. Çok güçlü bir fiyat avantajı veya marka bilinirliği olmadan riskli.`;
    } else {
      recommendation = `🔴 GİRME! Pazara giriş maliyeti yüksek, marjlar düşük, rekabet sert.`;
    }

    // Save to DB
    const research = await this.prisma.productResearch.create({
      data: {
        tenantId,
        categoryId: dto.categoryId,
        categoryName: dto.categoryName,
        keyword: dto.keyword,
        demandScore,
        competitionScore,
        opportunityScore,
        avgPrice: avgPrice > 0 ? avgPrice : null,
        totalReviews,
        totalSellers: uniqueSellers,
        topProducts: products.slice(0, 10) as any,
        recommendation,
      },
    });

    return {
      id: research.id,
      categoryName: dto.categoryName,
      keyword: dto.keyword,
      scores: {
        demand: {
          value: demandScore,
          label:
            demandScore >= 60 ? "Güçlü" : demandScore >= 30 ? "Orta" : "Düşük",
        },
        competition: {
          value: competitionScore,
          label:
            competitionScore >= 60
              ? "Yoğun"
              : competitionScore >= 30
                ? "Orta"
                : "Düşük",
        },
        opportunity: {
          value: opportunityScore,
          label:
            opportunityScore >= 60
              ? "Yüksek"
              : opportunityScore >= 30
                ? "Orta"
                : "Düşük",
        },
      },
      marketData: {
        totalProducts: products.length,
        totalReviews,
        uniqueSellers,
        avgPrice: Math.round(avgPrice * 100) / 100,
        avgRating: Math.round(avgRating * 100) / 100,
        priceRange,
        sponsoredRatio: Math.round(sponsoredRatio * 100),
        topSellers,
      },
      recommendation,
      source: "estimate" as const,
    };
  }

  /**
   * Get research history
   */
  async getResearchHistory(tenantId: string, limit = 20) {
    return this.prisma.productResearch.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Get trending opportunities (top opportunity scores)
   */
  async getTrendingOpportunities(tenantId: string) {
    return this.prisma.productResearch.findMany({
      where: { tenantId },
      orderBy: { opportunityScore: "desc" },
      take: 10,
    });
  }
}

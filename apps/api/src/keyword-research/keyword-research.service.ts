import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * KeywordResearchService — Trendyol Anahtar Kelime Araştırma Motoru
 *
 * Türkiye'de BU YOK → Jungle Scout / Helium 10 seviyesi
 *
 * Özellikler:
 * - Anahtar kelime zorluk skoru (Keyword Difficulty)
 * - Tahmini arama hacmi
 * - Rakip anahtar kelime analizi
 * - SEO skorkartı (başlık/açıklama optimizasyonu)
 * - İlgili anahtar kelime önerileri
 * - Fırsat skoru hesaplama
 */
@Injectable()
export class KeywordResearchService {
  private readonly logger = new Logger(KeywordResearchService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Research a keyword — full analysis
   */
  async researchKeyword(
    tenantId: string,
    keyword: string,
    categoryId?: number,
  ) {
    this.logger.log(`Researching keyword: "${keyword}" for tenant ${tenantId}`);

    // Check for cached result
    const existing = await this.prisma.searchVolumeEstimate.findUnique({
      where: {
        tenantId_keyword: { tenantId, keyword: keyword.toLowerCase() },
      },
    });

    // If fresh (< 24h old), return cached
    if (existing && Date.now() - existing.createdAt.getTime() < 24 * 60 * 60 * 1000) {
      return this.formatKeywordResult(existing);
    }

    // Generate research data from scraping results and internal data
    const research = await this.generateKeywordResearch(tenantId, keyword, categoryId);

    // Save to DB
    const saved = await this.prisma.searchVolumeEstimate.upsert({
      where: {
        tenantId_keyword: { tenantId, keyword: keyword.toLowerCase() },
      },
      create: {
        tenantId,
        keyword: keyword.toLowerCase(),
        categoryId,
        estimatedVolume: research.estimatedVolume,
        competition: research.competition,
        difficultyScore: research.difficultyScore,
        opportunityScore: research.opportunityScore,
        avgPrice: research.avgPrice,
        topProducts: research.topProducts as any,
        relatedKeywords: research.relatedKeywords as any,
        source: "estimate",
      },
      update: {
        estimatedVolume: research.estimatedVolume,
        competition: research.competition,
        difficultyScore: research.difficultyScore,
        opportunityScore: research.opportunityScore,
        avgPrice: research.avgPrice,
        topProducts: research.topProducts as any,
        relatedKeywords: research.relatedKeywords as any,
      },
    });

    return this.formatKeywordResult(saved);
  }

  /**
   * Bulk keyword research
   */
  async researchKeywords(
    tenantId: string,
    keywords: string[],
    categoryId?: number,
  ) {
    const results = await Promise.all(
      keywords.map((kw) =>
        this.researchKeyword(tenantId, kw, categoryId).catch((err: any) => ({
          keyword: kw,
          error: err.message,
        })),
      ),
    );

    // Sort by opportunity score
    return results.sort((a: any, b: any) =>
      (b.opportunityScore || 0) - (a.opportunityScore || 0),
    );
  }

  /**
   * Get keyword suggestions based on a seed keyword
   */
  async getKeywordSuggestions(
    tenantId: string,
    seedKeyword: string,
    limit = 20,
  ) {
    // Generate variations
    const variations = this.generateKeywordVariations(seedKeyword);

    // Check which ones we have data for
    const existingData = await this.prisma.searchVolumeEstimate.findMany({
      where: {
        tenantId,
        keyword: { in: variations.map((v) => v.toLowerCase()) },
      },
    });

    const existingMap = new Map(
      existingData.map((d) => [d.keyword, d]),
    );

    const suggestions = variations.slice(0, limit).map((kw) => {
      const data = existingMap.get(kw.toLowerCase());
      return {
        keyword: kw,
        hasData: !!data,
        estimatedVolume: data?.estimatedVolume || null,
        difficultyScore: data ? Number(data.difficultyScore) : null,
        opportunityScore: data ? Number(data.opportunityScore) : null,
      };
    });

    return {
      seedKeyword,
      suggestions,
      totalSuggestions: suggestions.length,
    };
  }

  /**
   * SEO Score Card — rate a product listing's keyword optimization
   */
  async getSeoScoreCard(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { variants: true },
    });

    if (!product) throw new Error("Ürün bulunamadı");

    const scores: Array<{ factor: string; score: number; max: number; advice: string }> = [];

    // 1. Title length (ideal: 70-150 chars)
    const titleLen = product.title.length;
    const titleScore =
      titleLen >= 70 && titleLen <= 150
        ? 15
        : titleLen >= 50 && titleLen <= 200
          ? 10
          : 5;
    scores.push({
      factor: "Başlık Uzunluğu",
      score: titleScore,
      max: 15,
      advice:
        titleLen < 70
          ? "Başlık çok kısa. 70-150 karakter arasında olmalı."
          : titleLen > 150
            ? "Başlık çok uzun. 150 karakterin altına indir."
            : "Başlık uzunluğu ideal.",
    });

    // 2. Title has brand
    const hasBrand = product.brand ? product.title.toLowerCase().includes(product.brand.toLowerCase()) : false;
    scores.push({
      factor: "Marka Başlıkta",
      score: hasBrand ? 10 : 0,
      max: 10,
      advice: hasBrand
        ? "Marka başlıkta var."
        : "Başlığa marka adı ekle — arama sıralamasını artırır.",
    });

    // 3. Title has numbers (size, quantity, etc.)
    const hasNumbers = /\d/.test(product.title);
    scores.push({
      factor: "Başlıkta Sayılar",
      score: hasNumbers ? 5 : 0,
      max: 5,
      advice: hasNumbers
        ? "Başlıkta boyut/adet bilgisi var."
        : "Boyut, adet veya ağırlık bilgisi ekle (ör: 500ml, 3'lü Set).",
    });

    // 4. Title keyword density (check common words)
    const commonWords = ["tl", "indirim", "ücretsiz", "kargo", "set", "adet"];
    const hasCommonKeywords = commonWords.some((w) =>
      product.title.toLowerCase().includes(w),
    );
    scores.push({
      factor: "Anahtar Kelime Kullanımı",
      score: hasCommonKeywords ? 10 : 5,
      max: 10,
      advice: hasCommonKeywords
        ? "Başlıkta faydalı anahtar kelimeler var."
        : "Ürünle ilgili popüler arama terimlerini başlığa ekle.",
    });

    // 5. Has image
    scores.push({
      factor: "Ürün Görseli",
      score: product.imageUrl ? 15 : 0,
      max: 15,
      advice: product.imageUrl
        ? "Ürün görseli mevcut."
        : "Ürün görseli eklenmeli — görselsiz ürünler çok düşük sıralanır.",
    });

    // 6. Category assigned
    scores.push({
      factor: "Kategori Ataması",
      score: product.categoryId ? 10 : 0,
      max: 10,
      advice: product.categoryId
        ? "Doğru kategoriye atanmış."
        : "Ürünü doğru kategoriye ata — yanlış kategori sıralamayı düşürür.",
    });

    // 7. Variants exist
    const hasVariants = product.variants.length > 0;
    scores.push({
      factor: "Varyant Çeşitliliği",
      score: hasVariants ? (product.variants.length >= 3 ? 10 : 5) : 0,
      max: 10,
      advice: hasVariants
        ? `${product.variants.length} varyant mevcut.`
        : "Varyant ekle (beden, renk vb.) — listelenme şansını artırır.",
    });

    // 8. Price competitiveness
    scores.push({
      factor: "Fiyat Rekabeti",
      score: 10,
      max: 10,
      advice: "Fiyat rekabet analizi için rakip takip modülüne bakın.",
    });

    // 9. Title Turkish characters
    const hasTurkish = /[çğıöşüÇĞİÖŞÜ]/.test(product.title);
    scores.push({
      factor: "Türkçe Karakter Kullanımı",
      score: hasTurkish ? 5 : 3,
      max: 5,
      advice: hasTurkish
        ? "Türkçe karakterler doğru kullanılıyor."
        : "Türkçe karakterleri doğru kullan (ö, ü, ç, ş, ğ) — arama eşleşmesi için önemli.",
    });

    // 10. Approved status
    scores.push({
      factor: "Onay Durumu",
      score: product.approved ? 10 : 0,
      max: 10,
      advice: product.approved
        ? "Ürün onaylı."
        : "Ürün onay bekliyor — onaysız ürünler listelenmiyor!",
    });

    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    const maxScore = scores.reduce((sum, s) => sum + s.max, 0);

    return {
      productId,
      productTitle: product.title,
      seoScore: totalScore,
      maxScore,
      percentage: Math.round((totalScore / maxScore) * 100),
      grade:
        totalScore >= maxScore * 0.8
          ? "A"
          : totalScore >= maxScore * 0.6
            ? "B"
            : totalScore >= maxScore * 0.4
              ? "C"
              : "D",
      factors: scores,
      topImprovements: scores
        .filter((s) => s.score < s.max)
        .sort((a, b) => (b.max - b.score) - (a.max - a.score))
        .slice(0, 3)
        .map((s) => s.advice),
    };
  }

  /**
   * Competitor keyword analysis — extract keywords from competitor titles
   */
  async analyzeCompetitorKeywords(tenantId: string, limit = 50) {
    const competitors = await this.prisma.competitorProduct.findMany({
      where: { tenantId },
      take: limit,
    });

    const keywordFrequency = new Map<string, number>();

    for (const comp of competitors) {
      if (!comp.title) continue;
      const words = this.extractKeywords(comp.title);
      for (const word of words) {
        keywordFrequency.set(word, (keywordFrequency.get(word) || 0) + 1);
      }
    }

    // Sort by frequency
    const topKeywords = Array.from(keywordFrequency.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30)
      .map(([keyword, frequency]) => ({
        keyword,
        frequency,
        usagePercent: Math.round((frequency / competitors.length) * 100),
      }));

    return {
      analyzedProducts: competitors.length,
      topKeywords,
      insights: [
        `Rakipleriniz en çok "${topKeywords[0]?.keyword}" kelimesini kullanıyor (${topKeywords[0]?.usagePercent}%).`,
        `İlk 5 anahtar kelime: ${topKeywords.slice(0, 5).map((k) => k.keyword).join(", ")}`,
      ],
    };
  }

  // ─── Private Helpers ─────────────────────────

  private async generateKeywordResearch(
    tenantId: string,
    keyword: string,
    categoryId?: number,
  ) {
    // Get scrape results for this keyword if available
    const scrapeResults = await this.prisma.scrapeResult.findMany({
      where: {
        target: {
          tenantId,
          url: { contains: encodeURIComponent(keyword) },
          type: "search_results",
        },
      },
      orderBy: { time: "desc" },
      take: 5,
    });

    // Get our products matching keyword
    const ourProducts = await this.prisma.product.findMany({
      where: {
        tenantId,
        title: { contains: keyword, mode: "insensitive" },
      },
      take: 10,
    });

    // Get competitor products matching keyword
    const competitorProducts = await this.prisma.competitorProduct.findMany({
      where: {
        tenantId,
        title: { contains: keyword, mode: "insensitive" },
      },
      include: {
        snapshots: {
          orderBy: { time: "desc" },
          take: 1,
        },
      },
      take: 20,
    });

    // Estimate search volume based on available signals
    const totalCompetitors = competitorProducts.length;
    const estimatedVolume = this.estimateSearchVolume(keyword, totalCompetitors, scrapeResults);

    // Calculate difficulty score
    const difficultyScore = this.calculateDifficultyScore(
      totalCompetitors,
      competitorProducts,
    );

    // Calculate opportunity score
    const opportunityScore = this.calculateOpportunityScore(
      estimatedVolume,
      difficultyScore,
      ourProducts.length,
    );

    // Average price from competitors
    const prices = competitorProducts
      .map((cp) => cp.snapshots[0]?.price)
      .filter(Boolean)
      .map(Number);
    const avgPrice =
      prices.length > 0
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : null;

    // Top products
    const topProducts = competitorProducts.slice(0, 5).map((cp) => ({
      title: cp.title,
      brand: cp.brand,
      price: cp.snapshots[0]?.price ? Number(cp.snapshots[0].price) : null,
      rating: cp.snapshots[0]?.rating ? Number(cp.snapshots[0].rating) : null,
      reviewCount: cp.snapshots[0]?.reviewCount,
    }));

    // Related keywords
    const relatedKeywords = this.generateKeywordVariations(keyword).slice(0, 10);

    return {
      estimatedVolume,
      competition:
        difficultyScore > 70 ? "high" : difficultyScore > 40 ? "medium" : "low",
      difficultyScore,
      opportunityScore,
      avgPrice,
      topProducts,
      relatedKeywords,
    };
  }

  private estimateSearchVolume(
    keyword: string,
    competitorCount: number,
    scrapeResults: any[],
  ): number {
    // Base volume estimation heuristic
    let baseVolume = 1000;

    // More competitors = higher volume
    baseVolume += competitorCount * 200;

    // Shorter keywords tend to have higher volume
    const wordCount = keyword.split(" ").length;
    if (wordCount === 1) baseVolume *= 3;
    else if (wordCount === 2) baseVolume *= 1.5;

    // If we have scrape data, use total results as signal
    if (scrapeResults.length > 0) {
      const latestScrape = scrapeResults[0];
      const totalResults = (latestScrape.data as any)?.totalResults;
      if (totalResults) {
        baseVolume = Math.max(baseVolume, totalResults * 0.1);
      }
    }

    return Math.round(baseVolume);
  }

  private calculateDifficultyScore(
    competitorCount: number,
    competitors: any[],
  ): number {
    let score = 0;

    // Number of competitors (max 30 pts)
    score += Math.min(competitorCount * 2, 30);

    // Average review count of top competitors (max 30 pts)
    const avgReviews =
      competitors.slice(0, 5).reduce((sum: number, cp: any) => {
        return sum + (cp.snapshots?.[0]?.reviewCount || 0);
      }, 0) / Math.max(competitors.slice(0, 5).length, 1);
    score += Math.min(avgReviews / 10, 30);

    // Brand diversity (max 20 pts) — more brands = harder market
    const brands = new Set(
      competitors.filter((c) => c.brand).map((c) => c.brand),
    );
    score += Math.min(brands.size * 3, 20);

    // Price competition (max 20 pts)
    const prices = competitors
      .map((c: any) => c.snapshots?.[0]?.price)
      .filter(Boolean)
      .map(Number);
    if (prices.length > 1) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const spread = maxPrice > 0 ? (maxPrice - minPrice) / maxPrice : 0;
      score += Math.min(spread * 40, 20);
    }

    return Math.min(Math.round(score), 100);
  }

  private calculateOpportunityScore(
    volume: number,
    difficulty: number,
    ourProductCount: number,
  ): number {
    // High volume + low difficulty = high opportunity
    const volumeScore = Math.min(volume / 100, 50);
    const difficultyBonus = (100 - difficulty) * 0.3;
    const presenceBonus = ourProductCount > 0 ? 10 : 0;

    return Math.min(Math.round(volumeScore + difficultyBonus + presenceBonus), 100);
  }

  private extractKeywords(title: string): string[] {
    const stopWords = new Set([
      "ve", "ile", "için", "bir", "bu", "de", "da", "den", "dan",
      "adet", "set", "li", "lu", "lü", "lü", "cm", "mm", "ml", "gr",
      "kg", "lt", "the", "and", "for", "with",
    ]);

    return title
      .toLowerCase()
      .replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  private generateKeywordVariations(seed: string): string[] {
    const variations: string[] = [];
    const words = seed.toLowerCase().split(" ");

    // Original
    variations.push(seed.toLowerCase());

    // With common suffixes/prefixes
    const prefixes = ["ucuz", "en iyi", "kaliteli", "orijinal", "toptan", "indirimli"];
    const suffixes = [
      "fiyat", "fiyatları", "modelleri", "çeşitleri",
      "online", "satın al", "sipariş", "kampanya",
    ];

    for (const prefix of prefixes) {
      variations.push(`${prefix} ${seed.toLowerCase()}`);
    }

    for (const suffix of suffixes) {
      variations.push(`${seed.toLowerCase()} ${suffix}`);
    }

    // Singular/plural variations  
    if (words.length >= 1) {
      const base = words[0];
      if (!base.endsWith("lar") && !base.endsWith("ler")) {
        // Simple Turkish plural
        const lastVowelBack = /[aıou]/.test(base);
        variations.push(`${seed.toLowerCase()} ${lastVowelBack ? "lar" : "ler"}`);
      }
    }

    // Remove duplicates
    return [...new Set(variations)];
  }

  private formatKeywordResult(data: any) {
    return {
      keyword: data.keyword,
      estimatedVolume: data.estimatedVolume,
      competition: data.competition,
      difficultyScore: Number(data.difficultyScore || 0),
      opportunityScore: Number(data.opportunityScore || 0),
      avgPrice: data.avgPrice ? Number(data.avgPrice) : null,
      topProducts: data.topProducts || [],
      relatedKeywords: data.relatedKeywords || [],
      source: data.source || "estimate",
      lastUpdated: data.createdAt,
    };
  }
}

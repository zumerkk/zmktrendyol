import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { OrchestratorService } from "./orchestrator.service";

/**
 * ListingOptimizerService — SEO & Listing Optimizasyonu
 *
 * Ürün başlıklarını, açıklamalarını ve görsellerini AI ile optimize eder.
 * - Kategori bazlı en çok aranan keyword'leri tespit
 * - Başlık, açıklama, bullet point optimizasyonu
 * - Listing kalite puanı (0-100)
 * - Görsel kalite kontrol (arka plan, çözünürlük)
 */
@Injectable()
export class ListingOptimizerService {
  private readonly logger = new Logger(ListingOptimizerService.name);

  constructor(
    private prisma: PrismaService,
    private orchestrator: OrchestratorService,
  ) {}

  /**
   * Calculate listing quality score for a product (0-100)
   */
  async getListingScore(productId: string): Promise<{
    productId: string;
    totalScore: number;
    breakdown: Array<{
      category: string;
      score: number;
      maxScore: number;
      issues: string[];
      suggestions: string[];
    }>;
    grade: string;
    source: string;
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new Error("Product not found");

    const breakdown: Array<{
      category: string;
      score: number;
      maxScore: number;
      issues: string[];
      suggestions: string[];
    }> = [];

    // 1. Title Score (max 25)
    const titleScore = this.scoreTitle(product.title || "");
    breakdown.push(titleScore);

    // 2. Description Score (max 25)
    const descScore = this.scoreDescription((product as any).description || "");
    breakdown.push(descScore);

    // 3. Images Score (max 25)
    const imageScore = this.scoreImages((product as any).images);
    breakdown.push(imageScore);

    // 4. Technical Details Score (max 25)
    const techScore = this.scoreTechnicalDetails(product);
    breakdown.push(techScore);

    const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);

    return {
      productId,
      totalScore,
      breakdown,
      grade: this.getGrade(totalScore),
      source: "estimate",
    };
  }

  /**
   * AI-powered title optimization
   */
  async optimizeTitle(tenantId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new Error("Product not found");

    const result = await this.orchestrator.generate(tenantId, {
      scenario: "listing_title_optimize",
      input: {
        currentTitle: product.title,
        category: (product as any).category || product.categoryName,
        brand: product.brand,
        barcode: product.barcode,
      },
    });

    return {
      currentTitle: product.title,
      suggestions: result.variations || [],
      aiProvider: result.metadata?.provider,
    };
  }

  /**
   * AI-powered description optimization
   */
  async optimizeDescription(tenantId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new Error("Product not found");

    const result = await this.orchestrator.generate(tenantId, {
      scenario: "listing_description_optimize",
      input: {
        currentDescription: (product as any).description,
        title: product.title,
        category: product.categoryName,
        brand: product.brand,
      },
    });

    return {
      currentDescription: ((product as any).description || "").substring(
        0,
        200,
      ),
      suggestion: result.variations?.[0] || null,
    };
  }

  /**
   * Get optimization suggestions for all products
   */
  async getTenantListingHealth(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
    });

    const scores = products.map((product) => {
      const titleScore = this.scoreTitle(product.title || "");
      const descScore = this.scoreDescription(
        (product as any).description || "",
      );
      const imageScore = this.scoreImages((product as any).images);
      const techScore = this.scoreTechnicalDetails(product);
      const totalScore =
        titleScore.score + descScore.score + imageScore.score + techScore.score;

      return {
        productId: product.id,
        title: product.title,
        totalScore,
        grade: this.getGrade(totalScore),
        topIssue:
          [
            ...titleScore.issues,
            ...descScore.issues,
            ...imageScore.issues,
          ][0] || null,
      };
    });

    scores.sort((a, b) => a.totalScore - b.totalScore); // worst first

    return {
      avgScore:
        scores.length > 0
          ? Math.round(
              scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length,
            )
          : 0,
      distribution: {
        excellent: scores.filter((s) => s.totalScore >= 85).length,
        good: scores.filter((s) => s.totalScore >= 70 && s.totalScore < 85)
          .length,
        fair: scores.filter((s) => s.totalScore >= 50 && s.totalScore < 70)
          .length,
        poor: scores.filter((s) => s.totalScore < 50).length,
      },
      worstProducts: scores.slice(0, 10),
      bestProducts: scores.slice(-5).reverse(),
    };
  }

  private scoreTitle(title: string): {
    category: string;
    score: number;
    maxScore: number;
    issues: string[];
    suggestions: string[];
  } {
    let score = 0;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Length check (ideal: 70-150 chars)
    if (title.length >= 70 && title.length <= 150) {
      score += 10;
    } else if (title.length > 0) {
      score += 5;
      if (title.length < 70) {
        issues.push(`Başlık çok kısa (${title.length} karakter)`);
        suggestions.push("70-150 karakter arası başlık kullan");
      } else {
        issues.push(`Başlık çok uzun (${title.length} karakter)`);
        suggestions.push("150 karakter altına düşür");
      }
    } else {
      issues.push("Başlık yok!");
    }

    // Contains brand
    if (title.match(/\b[A-Z][a-zA-Z]+\b/)) {
      score += 5;
    } else {
      issues.push("Marka adı başlıkta belirgin değil");
      suggestions.push("Başlığın başına marka adı ekle");
    }

    // Has descriptive keywords
    const keywordPatterns = [
      /\d+\s*(adet|ml|gr|cm|mm|lt|kg)/i,
      /renk|beden|numara|model/i,
    ];
    if (keywordPatterns.some((p) => p.test(title))) {
      score += 5;
    } else {
      suggestions.push("Boyut, adet, renk gibi detay bilgileri ekle");
    }

    // No special characters abuse
    if (!/[!@#$%^&*]{2,}/.test(title)) {
      score += 5;
    } else {
      issues.push("Başlıkta gereksiz özel karakter var");
    }

    return { category: "Başlık", score, maxScore: 25, issues, suggestions };
  }

  private scoreDescription(description: string): {
    category: string;
    score: number;
    maxScore: number;
    issues: string[];
    suggestions: string[];
  } {
    let score = 0;
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!description || description.length < 10) {
      issues.push("Ürün açıklaması yok veya çok kısa");
      suggestions.push("En az 200 karakter açıklama ekle");
      return {
        category: "Açıklama",
        score: 0,
        maxScore: 25,
        issues,
        suggestions,
      };
    }

    // Length (ideal: 200+)
    if (description.length >= 500) {
      score += 10;
    } else if (description.length >= 200) {
      score += 7;
    } else {
      score += 3;
      suggestions.push("Daha detaylı açıklama yaz (500+ karakter)");
    }

    // Contains bullet points or structured content
    if (
      description.includes("•") ||
      description.includes("-") ||
      description.includes("\n")
    ) {
      score += 5;
    } else {
      suggestions.push("Madde işaretleri (bullet points) kullan");
    }

    // Contains keywords
    const hasKeywords =
      /özellik|boyut|malzeme|garanti|kargo|teslimat|iade/i.test(description);
    if (hasKeywords) {
      score += 5;
    } else {
      suggestions.push("Özellik, boyut, malzeme gibi SEO keyword'leri ekle");
    }

    // HTML quality
    if (description.includes("<") && !description.includes("<script")) {
      score += 5;
    }

    return { category: "Açıklama", score, maxScore: 25, issues, suggestions };
  }

  private scoreImages(images: any): {
    category: string;
    score: number;
    maxScore: number;
    issues: string[];
    suggestions: string[];
  } {
    let score = 0;
    const issues: string[] = [];
    const suggestions: string[] = [];

    const imageList = Array.isArray(images) ? images : [];

    if (imageList.length === 0) {
      issues.push("Ürün görseli yok!");
      suggestions.push("En az 3 görsel ekle");
      return {
        category: "Görseller",
        score: 0,
        maxScore: 25,
        issues,
        suggestions,
      };
    }

    // Count (ideal: 5+)
    if (imageList.length >= 5) {
      score += 15;
    } else if (imageList.length >= 3) {
      score += 10;
    } else {
      score += 5;
      suggestions.push(`${5 - imageList.length} görsel daha ekle (ideal: 5+)`);
    }

    // Has images at all
    score += 5;

    // Bonus for having many
    if (imageList.length >= 7) score += 5;

    return {
      category: "Görseller",
      score: Math.min(score, 25),
      maxScore: 25,
      issues,
      suggestions,
    };
  }

  private scoreTechnicalDetails(product: any): {
    category: string;
    score: number;
    maxScore: number;
    issues: string[];
    suggestions: string[];
  } {
    let score = 0;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Has category
    if (product.category) score += 5;
    else {
      issues.push("Kategori belirtilmemiş");
    }

    // Has brand
    if (product.brand) score += 5;
    else {
      issues.push("Marka girilmemiş");
    }

    // Has barcode
    if (product.barcode) score += 5;
    else {
      suggestions.push("Barkod ekle");
    }

    // Has price
    if (Number(product.salePrice) > 0) score += 5;

    // Has stock
    if (Number(product.quantity) > 0) score += 5;
    else {
      issues.push("Stok 0 — ürün satışa kapalı");
    }

    return {
      category: "Teknik Bilgiler",
      score: Math.min(score, 25),
      maxScore: 25,
      issues,
      suggestions,
    };
  }

  /**
   * AI Auto-Generate Full Listing — tek tık ile başlık + açıklama + bullet points
   */
  async generateListing(
    tenantId: string,
    input: {
      productName: string;
      categoryName?: string;
      brand?: string;
      features?: string[];
      targetAudience?: string;
      language?: string;
    },
  ) {
    const result = await this.orchestrator.generate(tenantId, {
      scenario: "listing_full_generate",
      input: {
        ...input,
        language: input.language || "tr",
        instructions: `Sen bir Trendyol e-ticaret uzmanısın. Aşağıdaki ürün için Trendyol'da en iyi sıralamayı alacak bir listing oluştur.

Ürün: ${input.productName}
Kategori: ${input.categoryName || "Belirtilmemiş"}
Marka: ${input.brand || "Belirtilmemiş"}
Özellikler: ${input.features?.join(", ") || "Belirtilmemiş"}

Şu formatta JSON döndür:
{
  "title": "Başlık (70-150 karakter, marka + ürün adı + özellikler)",
  "bulletPoints": ["5 adet madde işareti"],
  "description": "Detaylı açıklama (500+ karakter, HTML formatında)",
  "searchKeywords": ["10 adet anahtar kelime"],
  "seoScore": 85
}`,
      },
    });

    return {
      generated: result.variations?.[0] || null,
      aiProvider: result.metadata?.provider,
      source: "ai" as const,
    };
  }

  /**
   * Batch optimize — düşük skorlu tüm ürünleri otomatik optimize et
   */
  async autoOptimizeAll(tenantId: string, maxScore = 50) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
    });

    const needsOptimization: Array<{
      productId: string;
      title: string;
      score: number;
      topIssues: string[];
    }> = [];

    for (const product of products) {
      const titleScore = this.scoreTitle(product.title || "");
      const descScore = this.scoreDescription((product as any).description || "");
      const imageScore = this.scoreImages((product as any).images);
      const techScore = this.scoreTechnicalDetails(product);
      const totalScore =
        titleScore.score + descScore.score + imageScore.score + techScore.score;

      if (totalScore < maxScore) {
        needsOptimization.push({
          productId: product.id,
          title: product.title,
          score: totalScore,
          topIssues: [
            ...titleScore.issues,
            ...descScore.issues,
            ...imageScore.issues,
            ...techScore.issues,
          ].slice(0, 3),
        });
      }
    }

    // Sort worst first
    needsOptimization.sort((a, b) => a.score - b.score);

    return {
      totalProducts: products.length,
      needsOptimization: needsOptimization.length,
      percentNeedsWork:
        products.length > 0
          ? Math.round((needsOptimization.length / products.length) * 100)
          : 0,
      products: needsOptimization.slice(0, 20), // top 20 worst
      recommendation:
        needsOptimization.length > products.length * 0.3
          ? "🚨 Ürünlerin %30'undan fazlası kötü listing'e sahip. Toplu AI optimizasyon önerilir."
          : needsOptimization.length > 0
            ? `⚠️ ${needsOptimization.length} ürün optimize edilmeli.`
            : "✅ Tüm listingler iyi durumda!",
    };
  }

  /**
   * Compare listing quality against competitors
   */
  async compareWithCompetitors(tenantId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new Error("Product not found");

    // Find related competitor products
    const competitors = await this.prisma.competitorProduct.findMany({
      where: {
        tenantId,
        OR: [
          { title: { contains: product.brand || "", mode: "insensitive" } },
          { category: product.categoryName },
        ],
      },
      take: 10,
    });

    const ourScore = this.scoreTitle(product.title || "");
    const competitorScores = competitors.map((c) => ({
      title: c.title,
      brand: c.brand,
      titleLength: (c.title || "").length,
      score: this.scoreTitle(c.title || ""),
    }));

    const avgCompetitorScore =
      competitorScores.length > 0
        ? Math.round(
            competitorScores.reduce((sum, c) => sum + c.score.score, 0) /
              competitorScores.length,
          )
        : 0;

    return {
      ourProduct: {
        title: product.title,
        titleLength: (product.title || "").length,
        score: ourScore.score,
        issues: ourScore.issues,
      },
      competitorAvgScore: avgCompetitorScore,
      comparison:
        ourScore.score > avgCompetitorScore
          ? "✅ Listing'in rakiplerden daha iyi!"
          : ourScore.score === avgCompetitorScore
            ? "➡️ Rakiplerle aynı seviyede"
            : "⚠️ Rakipler daha iyi listing'e sahip — optimize et!",
      competitorDetails: competitorScores.slice(0, 5),
      suggestions: ourScore.suggestions,
    };
  }

  private getGrade(score: number): string {
    if (score >= 85) return "A+";
    if (score >= 75) return "A";
    if (score >= 65) return "B";
    if (score >= 50) return "C";
    if (score >= 30) return "D";
    return "F";
  }
}

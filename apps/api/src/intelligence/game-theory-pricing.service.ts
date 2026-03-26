import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * GameTheoryPricingService — Oyun Teorisi Fiyatlama
 *
 * Nash Equilibrium bazlı fiyatlama — rakip de düşürecek, sonsuz savaşa girme.
 * Elastisite hesabı — fiyatı 5 TL düşürünce satış %X artıyor mu?
 * Zaman bazlı strateji — gece fiyat düşür, sabah geri çek.
 *
 * Bu, basit "undercut" stratejisinin ötesinde akıllı fiyatlamadır.
 */
@Injectable()
export class GameTheoryPricingService {
  private readonly logger = new Logger(GameTheoryPricingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculate optimal price using game theory
   */
  async calculateOptimalPrice(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        pricingRules: { where: { isActive: true } },
      },
    });
    if (!product) throw new Error("Product not found");

    // Get competitor prices
    const competitors = await this.prisma.competitorProduct.findMany({
      where: { tenantId: product.tenantId },
      include: {
        snapshots: {
          orderBy: { time: "desc" },
          take: 30,
        },
      },
    });

    const competitorPrices = competitors
      .filter((c) => c.snapshots.length > 0 && c.snapshots[0].price)
      .map((c) => ({
        id: c.id,
        title: c.title,
        currentPrice: Number(c.snapshots[0].price),
        priceHistory: c.snapshots.map((s) => Number(s.price)).filter(Boolean),
      }));

    if (competitorPrices.length === 0) {
      return { message: "Rakip fiyat verisi yok", suggestion: null };
    }

    const ourPrice = Number(
      (product as any).salePrice ||
        (product as any).variants?.[0]?.salePrice ||
        0,
    );
    const costPrice = Number(product.costPrice || 0);
    const minViablePrice = costPrice > 0 ? costPrice * 1.15 : ourPrice * 0.7; // min 15% margin

    // Price elasticity estimation
    const elasticity = await this.estimateElasticity(product.id);

    // Nash Equilibrium estimation
    const avgCompetitorPrice =
      competitorPrices.reduce((sum, c) => sum + c.currentPrice, 0) /
      competitorPrices.length;
    const minCompetitorPrice = Math.min(
      ...competitorPrices.map((c) => c.currentPrice),
    );
    const maxCompetitorPrice = Math.max(
      ...competitorPrices.map((c) => c.currentPrice),
    );

    // Competitor price stability (are they aggressive?)
    const competitorVolatility = competitorPrices.map((c) => {
      if (c.priceHistory.length < 2) return 0;
      const changes = c.priceHistory
        .slice(0, -1)
        .map((p, i) => (Math.abs(p - c.priceHistory[i + 1]) / p) * 100);
      return changes.reduce((sum, v) => sum + v, 0) / changes.length;
    });
    const avgVolatility =
      competitorVolatility.reduce((a, b) => a + b, 0) /
      competitorVolatility.length;

    // Strategy determination
    let strategy: string;
    let suggestedPrice: number;
    let reasoning: string;

    if (avgVolatility > 5) {
      // Competitors are aggressive — DON'T enter price war
      strategy = "value_positioning";
      suggestedPrice = Math.max(minViablePrice, avgCompetitorPrice * 1.05);
      reasoning =
        "Rakipler agresif fiyatlıyor. Fiyat savaşına girme! Değer odaklı pozisyonlan — paketleme, kargo hızı, müşteri hizmeti ile farklılaş.";
    } else if (ourPrice > maxCompetitorPrice * 1.1) {
      // We're significantly more expensive
      strategy = "competitive_adjustment";
      suggestedPrice = Math.max(minViablePrice, avgCompetitorPrice * 1.02);
      reasoning =
        "Fiyatın pazarın çok üstünde. Ortalamaya yakın ama rekabetçi bir fiyat ayarla.";
    } else if (ourPrice < minCompetitorPrice) {
      // We're already cheapest — raise if possible
      strategy = "margin_recovery";
      suggestedPrice = Math.min(minCompetitorPrice - 0.1, ourPrice * 1.05);
      reasoning =
        "Zaten en ucuzsun. Fiyatı biraz yükselt, marjı koru. Buybox'ı kaybetmeden maximum kâr.";
    } else {
      // We're in the middle — slight undercut
      strategy = "smart_undercut";
      suggestedPrice = Math.max(minViablePrice, minCompetitorPrice - 0.2);
      reasoning =
        "Stratejik 20 kuruş indirimle Buybox'ı al. Aşırı düşürme — rakip de düşürecek.";
    }

    // Time-based adjustment
    const hour = new Date().getHours();
    let timeAdjustment = null;
    if (hour >= 22 || hour < 6) {
      // Night: aggressive pricing (competitors sleeping)
      timeAdjustment = {
        advice:
          "Gece saatleri — rakipler uyuyor. Agresif fiyat uygulayabilirsin.",
        multiplier: 0.98,
      };
      suggestedPrice *= 0.98;
    } else if (hour >= 19 && hour < 22) {
      // Peak hours: slightly higher
      timeAdjustment = {
        advice: "Yoğun saatler — trafik yüksek. Normal fiyatta kal.",
        multiplier: 1.0,
      };
    }

    suggestedPrice = Math.round(suggestedPrice * 100) / 100;

    return {
      productId,
      productTitle: product.title,
      currentPrice: ourPrice,
      costPrice: costPrice > 0 ? costPrice : null,
      suggestion: {
        price: suggestedPrice,
        strategy,
        reasoning,
        priceChange: Math.round((suggestedPrice - ourPrice) * 100) / 100,
        priceChangePercent:
          Math.round(((suggestedPrice - ourPrice) / ourPrice) * 100 * 100) /
          100,
        estimatedMargin:
          costPrice > 0
            ? Math.round(
                ((suggestedPrice - costPrice) / suggestedPrice) * 100 * 100,
              ) / 100
            : null,
      },
      marketContext: {
        avgCompetitorPrice: Math.round(avgCompetitorPrice * 100) / 100,
        minCompetitorPrice: Math.round(minCompetitorPrice * 100) / 100,
        maxCompetitorPrice: Math.round(maxCompetitorPrice * 100) / 100,
        competitorCount: competitorPrices.length,
        marketVolatility: Math.round(avgVolatility * 100) / 100,
      },
      elasticity,
      timeAdjustment,
      source: "estimate" as const,
    };
  }

  /**
   * Estimate price elasticity from historical data
   */
  private async estimateElasticity(productId: string): Promise<{
    elasticity: number | null;
    interpretation: string;
  }> {
    // Get price history and corresponding sales
    const priceHistory = await this.prisma.inventoryHistory.findMany({
      where: { productId },
      orderBy: { time: "desc" },
      take: 60,
    });

    if (priceHistory.length < 5) {
      return {
        elasticity: null,
        interpretation: "Yeterli veri yok. En az 5 fiyat noktası gerekli.",
      };
    }

    // Simple elasticity: % change in quantity / % change in price
    let totalElasticity = 0;
    let count = 0;

    for (let i = 1; i < priceHistory.length; i++) {
      const priceDelta =
        Number((priceHistory[i - 1] as any).salePrice || 0) -
        Number((priceHistory[i] as any).salePrice || 0);
      const basePrice = Number((priceHistory[i] as any).salePrice || 1);
      const qtyDelta =
        (priceHistory[i - 1].quantity || 0) - (priceHistory[i].quantity || 0);
      const baseQty = Math.max(priceHistory[i].quantity || 1, 1);

      if (basePrice > 0 && priceDelta !== 0) {
        const priceChangePercent = priceDelta / basePrice;
        const qtyChangePercent = qtyDelta / baseQty;
        totalElasticity += qtyChangePercent / priceChangePercent;
        count++;
      }
    }

    const avgElasticity =
      count > 0 ? Math.round((totalElasticity / count) * 100) / 100 : null;

    let interpretation: string;
    if (avgElasticity === null) {
      interpretation = "Elastisite hesaplanamadı.";
    } else if (Math.abs(avgElasticity) > 1.5) {
      interpretation = `Yüksek elastisite (${avgElasticity}). Fiyat değişimleri satışı çok etkiliyor. Dikkatli fiyatla!`;
    } else if (Math.abs(avgElasticity) > 0.5) {
      interpretation = `Orta elastisite (${avgElasticity}). Fiyat değişimleri satışı etkiliyor ama orantılı.`;
    } else {
      interpretation = `Düşük elastisite (${avgElasticity}). Müşteriler fiyata duyarsız. Marjı artırabilirsin!`;
    }

    return { elasticity: avgElasticity, interpretation };
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * PriceIntelligenceService — AI Fiyat Zekâsı
 *
 * Türkiye'de BU YOK → Profitero / Intelligence Node seviyesi
 *
 * Özellikler:
 * - Fiyat elastikiyet analizi (fiyatı %5 düşürsem satış ne değişir?)
 * - Optimum kâr noktası hesaplama
 * - Rakip fiyat tahmini
 * - Kampanya dönemlerinde otomatik fiyat stratejisi
 * - Fiyat savaşı erken uyarı
 */
@Injectable()
export class PriceIntelligenceService {
  private readonly logger = new Logger(PriceIntelligenceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Price elasticity analysis
   * "Fiyatı %X düşürsem satış ne kadar artar?"
   */
  async analyzeElasticity(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new Error("Ürün bulunamadı");

    // Get price history and sales data
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const priceHistory = await this.prisma.priceHistory.findMany({
      where: { productId, time: { gte: threeMonthsAgo } },
      orderBy: { time: "asc" },
    });

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        barcode: product.barcode,
        order: { tenantId, orderDate: { gte: threeMonthsAgo } },
      },
      include: { order: true },
    });

    // Build price-quantity correlation
    const pricePoints: Array<{ price: number; dailySales: number }> = [];

    if (priceHistory.length > 1) {
      for (let i = 0; i < priceHistory.length - 1; i++) {
        const price = Number(priceHistory[i].salePrice);
        const startTime = priceHistory[i].time;
        const endTime = priceHistory[i + 1].time;
        const days = Math.max(
          (endTime.getTime() - startTime.getTime()) / (24 * 60 * 60 * 1000),
          1,
        );

        const salesInPeriod = orderItems.filter(
          (oi) =>
            oi.order.orderDate >= startTime && oi.order.orderDate < endTime,
        );
        const totalQty = salesInPeriod.reduce((s, i) => s + i.quantity, 0);
        const dailySales = totalQty / days;

        pricePoints.push({ price, dailySales });
      }
    }

    // Calculate elasticity coefficient
    let elasticity = -1.5; // default moderate
    if (pricePoints.length >= 2) {
      const sortedByPrice = [...pricePoints].sort((a, b) => a.price - b.price);
      const lowPrice = sortedByPrice[0];
      const highPrice = sortedByPrice[sortedByPrice.length - 1];

      if (lowPrice.price > 0 && highPrice.price > lowPrice.price) {
        const priceChange =
          (highPrice.price - lowPrice.price) / lowPrice.price;
        const salesChange =
          lowPrice.dailySales > 0
            ? (highPrice.dailySales - lowPrice.dailySales) / lowPrice.dailySales
            : 0;
        elasticity = priceChange !== 0 ? salesChange / priceChange : -1.5;
      }
    }

    const currentPrice = Number(
      priceHistory[priceHistory.length - 1]?.salePrice ||
        (product as any).salePrice ||
        0,
    );

    // Generate what-if scenarios
    const scenarios = [-15, -10, -5, 5, 10, 15].map((changePercent) => {
      const newPrice = currentPrice * (1 + changePercent / 100);
      const salesMultiplier = 1 + ((-changePercent / 100) * Math.abs(elasticity));
      const currentDailySales =
        pricePoints.length > 0
          ? pricePoints[pricePoints.length - 1]?.dailySales || 1
          : 1;
      const newDailySales = currentDailySales * salesMultiplier;

      const costPerUnit = Number(product.costPrice || currentPrice * 0.4);
      const commissionRate = Number(product.commissionRate || 15) / 100;
      const shipping = Number(product.shippingCost || 12.5);

      const currentProfit =
        (currentPrice - currentPrice * commissionRate - shipping - costPerUnit) *
        currentDailySales *
        30;
      const newProfit =
        (newPrice - newPrice * commissionRate - shipping - costPerUnit) *
        newDailySales *
        30;

      return {
        priceChange: `${changePercent > 0 ? "+" : ""}${changePercent}%`,
        newPrice: round(newPrice),
        estimatedDailySales: round(newDailySales),
        salesChange: round((salesMultiplier - 1) * 100),
        monthlyProfit: round(newProfit),
        profitChange: round(newProfit - currentProfit),
        recommended: newProfit > currentProfit,
      };
    });

    // Find optimum price
    const bestScenario = scenarios.reduce((best, s) =>
      s.monthlyProfit > best.monthlyProfit ? s : best,
    );

    return {
      productId,
      productTitle: product.title,
      currentPrice: round(currentPrice),
      elasticity: {
        coefficient: round(elasticity),
        interpretation:
          Math.abs(elasticity) > 2
            ? "Çok Elastik — fiyat değişikliği satışı çok etkiler"
            : Math.abs(elasticity) > 1
              ? "Elastik — fiyat hassasiyeti var"
              : Math.abs(elasticity) > 0.5
                ? "Orta Elastik — fiyat etkisi orta"
                : "İnelastik — fiyat çok etkilemiyor",
        dataPoints: pricePoints.length,
      },
      scenarios,
      optimumPrice: {
        price: bestScenario.newPrice,
        change: bestScenario.priceChange,
        estimatedProfitIncrease: round(bestScenario.profitChange),
      },
      recommendation:
        bestScenario.profitChange > 0
          ? `💡 Fiyatı ${bestScenario.priceChange} değiştirerek aylık ₺${round(bestScenario.profitChange)} daha fazla kâr edebilirsin!`
          : "✅ Mevcut fiyat optimum görünüyor.",
      source: pricePoints.length >= 2 ? ("api" as const) : ("estimate" as const),
    };
  }

  /**
   * Competitor price war detection
   */
  async detectPriceWar(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) throw new Error("Ürün bulunamadı");

    // Get competitor snapshots
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const competitors = await this.prisma.competitorProduct.findMany({
      where: {
        tenantId,
        OR: [
          { title: { contains: product.brand || "", mode: "insensitive" } },
          { category: product.categoryName },
        ],
      },
      include: {
        snapshots: {
          orderBy: { time: "desc" },
          take: 14, // two weeks of daily snapshots
        },
      },
      take: 10,
    });

    const warnings: Array<{
      competitorTitle: string;
      brand: string | null;
      currentPrice: number;
      previousPrice: number;
      changePercent: number;
      severity: string;
    }> = [];

    for (const comp of competitors) {
      if (comp.snapshots.length < 2) continue;
      const latest = Number(comp.snapshots[0]?.price || 0);
      const previous = Number(comp.snapshots[1]?.price || 0);

      if (previous > 0 && latest < previous) {
        const change = ((latest - previous) / previous) * 100;
        if (change < -5) {
          // More than 5% price drop
          warnings.push({
            competitorTitle: comp.title || "Bilinmeyen",
            brand: comp.brand,
            currentPrice: round(latest),
            previousPrice: round(previous),
            changePercent: round(change),
            severity: change < -15 ? "critical" : change < -10 ? "high" : "medium",
          });
        }
      }
    }

    // Sort by severity
    warnings.sort((a, b) => a.changePercent - b.changePercent);

    return {
      productId,
      productTitle: product.title,
      ourPrice: Number((product as any).salePrice || 0),
      warDetected: warnings.length > 0,
      warnings,
      analysis:
        warnings.length === 0
          ? "✅ Fiyat savaşı tespit edilmedi."
          : warnings.some((w) => w.severity === "critical")
            ? "🚨 KRİTİK: Rakipler agresif fiyat düşürdü! Acil strateji gerekiyor."
            : "⚠️ Rakiplerde fiyat düşüşü var. Piyasayı yakından takip et.",
      recommendation:
        warnings.length > 0
          ? [
              "1. Fiyat savaşına hemen girme — rakibin zarar edip etmediğini analiz et",
              "2. Fiyat düşürmek yerine değer artır (ek hizmet, bundle, hızlı kargo)",
              "3. Reklam bütçesini artırarak görünürlüğü koru",
            ]
          : [],
      source: "api" as const,
    };
  }

  /**
   * Campaign pricing strategy
   */
  async getCampaignPricingStrategy(tenantId: string, campaignType: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
      take: 50,
    });

    const strategies: Record<string, { discountRange: string; focus: string }> = {
      "11.11": { discountRange: "%20-40", focus: "Hacim satışı — stok eritme" },
      "black_friday": { discountRange: "%30-50", focus: "En düşük fiyat garantisi" },
      "yilbasi": { discountRange: "%15-30", focus: "Hediye odaklı paketler" },
      "ramazan": { discountRange: "%10-25", focus: "Aile ürünleri öne çıkar" },
      "yaz": { discountRange: "%15-35", focus: "Sezonluk ürünler" },
    };

    const strategy = strategies[campaignType] || strategies["11.11"];

    const suggestions = products.slice(0, 20).map((p) => {
      const currentPrice = Number((p as any).salePrice || 0);
      const costPrice = Number(p.costPrice || currentPrice * 0.4);
      const commissionRate = Number(p.commissionRate || 15) / 100;
      const minProfitablePrice = (costPrice + 15) / (1 - commissionRate); // 15TL margin

      return {
        productId: p.id,
        title: p.title,
        currentPrice: round(currentPrice),
        minProfitablePrice: round(minProfitablePrice),
        suggestedCampaignPrice: round(Math.max(currentPrice * 0.75, minProfitablePrice)),
        maxDiscountPercent: round(
          ((currentPrice - minProfitablePrice) / currentPrice) * 100,
        ),
        canDiscount: currentPrice > minProfitablePrice,
      };
    });

    return {
      campaignType,
      strategy,
      products: suggestions,
      warnings: suggestions
        .filter((s) => !s.canDiscount)
        .map(
          (s) =>
            `⚠️ "${s.title}" — bu fiyatla indirim yapamazsın (min kârlı fiyat: ₺${s.minProfitablePrice})`,
        ),
      source: "estimate" as const,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

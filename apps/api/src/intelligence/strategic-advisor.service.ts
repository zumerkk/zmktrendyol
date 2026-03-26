import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * StrategicAdvisorService — AI Stratejik Danışman
 *
 * Tüm verileri analiz edip haftalık strateji raporu üretir:
 * - SWOT analizi (Güçlü/Zayıf/Fırsat/Tehdit)
 * - Büyüme önerileri
 * - Risk uyarıları
 * - Aksiyon planı
 * - Performans karnesi
 */
@Injectable()
export class StrategicAdvisorService {
  private readonly logger = new Logger(StrategicAdvisorService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate weekly strategic report
   */
  async generateStrategicReport(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Gather all data
    const [productCount, orderCount, prevOrderCount, activeAds] =
      await Promise.all([
        this.prisma.product.count({ where: { tenantId, status: "active" } }),
        this.prisma.order.count({
          where: { tenantId, orderDate: { gte: thirtyDaysAgo } },
        }),
        this.prisma.order.count({
          where: {
            tenantId,
            orderDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          },
        }),
        this.prisma.adCampaign.count({
          where: { tenantId, status: "active" },
        }),
      ]);

    const orderGrowth =
      prevOrderCount > 0
        ? Math.round(((orderCount - prevOrderCount) / prevOrderCount) * 100)
        : 0;

    // SWOT Analysis
    const swot = {
      strengths: [] as string[],
      weaknesses: [] as string[],
      opportunities: [] as string[],
      threats: [] as string[],
    };

    // Evaluate strengths
    if (productCount > 50) swot.strengths.push("Geniş ürün portföyü");
    if (orderGrowth > 10) swot.strengths.push(`Güçlü satış büyümesi (+${orderGrowth}%)`);
    if (activeAds > 0) swot.strengths.push("Aktif reklam kampanyaları");

    // Evaluate weaknesses
    if (productCount < 10) swot.weaknesses.push("Sınırlı ürün çeşitliliği");
    if (orderGrowth < 0) swot.weaknesses.push(`Satışlarda düşüş (${orderGrowth}%)`);
    if (activeAds === 0) swot.weaknesses.push("Reklam kampanyası yok");

    // Opportunities
    swot.opportunities.push("Hepsiburada/N11/Amazon TR'ye genişleme");
    if (orderGrowth > 0) swot.opportunities.push("Büyüyen talebe stok artırımı");
    swot.opportunities.push("AI listing optimizasyonu ile dönüşüm artışı");

    // Threats
    swot.threats.push("Rakip fiyat agresifliği");
    swot.threats.push("Trendyol komisyon artışı riski");
    if (orderGrowth < -15) swot.threats.push("Pazar payı kaybı riski");

    // Performance scorecard
    const scorecard = {
      salesGrowth: { score: Math.min(100, Math.max(0, 50 + orderGrowth)), weight: 30 },
      productHealth: { score: Math.min(100, productCount * 2), weight: 20 },
      adEfficiency: { score: activeAds > 0 ? 70 : 30, weight: 20 },
      marketPresence: { score: 40, weight: 15 }, // Only on Trendyol
      innovation: { score: 80, weight: 15 }, // Using AI tools
    };

    const overallScore = Math.round(
      Object.values(scorecard).reduce(
        (sum, item) => sum + (item.score * item.weight) / 100,
        0,
      ),
    );

    // Action plan
    const actionPlan: Array<{
      priority: string;
      action: string;
      expectedImpact: string;
      timeline: string;
    }> = [];

    if (orderGrowth < 0) {
      actionPlan.push({
        priority: "🔴 Yüksek",
        action: "Satış düşüşünü analiz et ve kampanya başlat",
        expectedImpact: "Satışı %20 artırma potansiyeli",
        timeline: "1 hafta",
      });
    }
    if (activeAds === 0) {
      actionPlan.push({
        priority: "🟠 Orta",
        action: "En yüksek marjlı 5 ürünü reklama al",
        expectedImpact: "Görünürlük %50 artış",
        timeline: "3 gün",
      });
    }
    actionPlan.push({
      priority: "🟡 Normal",
      action: "Düşük skorlu listing'leri AI ile optimize et",
      expectedImpact: "Dönüşüm oranı %10-15 artış",
      timeline: "1 hafta",
    });
    actionPlan.push({
      priority: "🔵 Stratejik",
      action: "Hepsiburada'ya genişle — mevcut ürünleri listele",
      expectedImpact: "Geliri %30-50 artırma potansiyeli",
      timeline: "2 hafta",
    });

    return {
      reportDate: new Date().toISOString().split("T")[0],
      overallScore,
      grade:
        overallScore >= 80 ? "A" : overallScore >= 60 ? "B" : overallScore >= 40 ? "C" : "D",
      swot,
      scorecard,
      keyMetrics: {
        totalProducts: productCount,
        monthlyOrders: orderCount,
        orderGrowth: `${orderGrowth > 0 ? "+" : ""}${orderGrowth}%`,
        activeCampaigns: activeAds,
        connectedMarketplaces: 1,
      },
      actionPlan,
      weeklyFocus:
        orderGrowth < 0
          ? "🎯 Bu hafta odaklan: Satış düşüşünü durdur ve reklam kampanyaları başlat"
          : orderGrowth > 20
            ? "🎯 Bu hafta odaklan: Stok seviyelerini kontrol et ve yeni ürünleri listele"
            : "🎯 Bu hafta odaklan: Listing optimizasyonu ve yeni platform genişlemesi",
      source: "ai" as const,
    };
  }

  /**
   * Quick health check
   */
  async getQuickHealth(tenantId: string) {
    const productCount = await this.prisma.product.count({
      where: { tenantId, status: "active" },
    });
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekOrders = await this.prisma.order.count({
      where: { tenantId, orderDate: { gte: weekAgo } },
    });

    return {
      products: productCount,
      weeklyOrders: weekOrders,
      avgDailyOrders: Math.round(weekOrders / 7),
      health: weekOrders > 0 ? "✅ İşletme aktif" : "⚠️ Bu hafta sipariş yok",
    };
  }
}

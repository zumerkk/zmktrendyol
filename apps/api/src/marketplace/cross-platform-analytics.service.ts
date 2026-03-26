import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * CrossPlatformAnalyticsService — Çapraz Platform Analitik
 *
 * Tüm pazaryerlerinden gelen verileri birleştirerek tek bir dashboard sunar:
 * - Toplam satış (Trendyol + HB + N11 + Amazon)
 * - Platform bazlı kârlılık karşılaştırması
 * - En iyi platform tespiti (ürün bazlı)
 * - Fiyat tutarlılık analizi
 * - Stok senkronizasyon durumu
 */
@Injectable()
export class CrossPlatformAnalyticsService {
  private readonly logger = new Logger(CrossPlatformAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Unified dashboard — tüm platformlardan birleşik görünüm
   */
  async getUnifiedDashboard(tenantId: string) {
    // Trendyol data (from existing DB)
    const trendyolProducts = await this.prisma.product.count({
      where: { tenantId, status: "active" },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trendyolOrders = await this.prisma.order.count({
      where: { tenantId, orderDate: { gte: thirtyDaysAgo } },
    });

    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: { tenantId, orderDate: { gte: thirtyDaysAgo } } },
    });

    const trendyolRevenue = orderItems.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    return {
      summary: {
        totalRevenue: round(trendyolRevenue),
        totalOrders: trendyolOrders,
        totalProducts: trendyolProducts,
        activePlatforms: 1, // Will increase as platforms are connected
      },
      platforms: [
        {
          name: "Trendyol",
          status: "active",
          products: trendyolProducts,
          orders: trendyolOrders,
          revenue: round(trendyolRevenue),
          share: "100%",
          icon: "🟠",
        },
        {
          name: "Hepsiburada",
          status: "ready_to_connect",
          products: 0,
          orders: 0,
          revenue: 0,
          share: "0%",
          icon: "🟣",
        },
        {
          name: "N11",
          status: "ready_to_connect",
          products: 0,
          orders: 0,
          revenue: 0,
          share: "0%",
          icon: "🔵",
        },
        {
          name: "Amazon TR",
          status: "ready_to_connect",
          products: 0,
          orders: 0,
          revenue: 0,
          share: "0%",
          icon: "🟡",
        },
      ],
      recommendations: [
        "💡 Hepsiburada'ya bağlanarak geliri %30-50 artırabilirsin",
        "💡 N11 düşük rekabetli kategorilerde fırsat sunuyor",
        "💡 Amazon TR FBA ile uluslararası müşterilere ulaşabilirsin",
      ],
      source: "api" as const,
    };
  }

  /**
   * Per-product platform performance comparison
   */
  async getProductPlatformComparison(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
      take: 20,
    });

    return {
      products: products.map((p) => ({
        productId: p.id,
        title: p.title,
        barcode: p.barcode,
        platforms: {
          trendyol: {
            listed: true,
            price: Number((p as any).salePrice || 0),
            status: p.status,
          },
          hepsiburada: { listed: false, price: null, status: "not_connected" },
          n11: { listed: false, price: null, status: "not_connected" },
          amazon_tr: { listed: false, price: null, status: "not_connected" },
        },
        recommendation: "Diğer platformlara expand et — geliri artır",
      })),
      source: "api" as const,
    };
  }

  /**
   * Price consistency checker across platforms
   */
  async checkPriceConsistency(tenantId: string) {
    return {
      totalProducts: 0,
      consistent: 0,
      inconsistent: 0,
      message: "Çapraz platform fiyat tutarlılığı — birden fazla platform bağlandığında aktif",
      source: "pending" as const,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

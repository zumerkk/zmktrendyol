import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * ProfitabilityService — SKU Bazlı P&L Motoru
 *
 * Her ürün için gerçek kârlılık:
 * Satış Fiyatı - Komisyon - Kargo - Ürün Maliyeti - Reklam Maliyeti = Net Kâr
 *
 * ⚠️ Bu veriyi hiçbir yerli araç göstermiyor — ZMK farkı.
 */
@Injectable()
export class ProfitabilityService {
  private readonly logger = new Logger(ProfitabilityService.name);

  // Trendyol default commission rates by category (approximate)
  private readonly defaultCommissionRates: Record<string, number> = {
    Elektronik: 0.12,
    Moda: 0.2,
    "Ev & Yaşam": 0.15,
    "Anne & Bebek": 0.15,
    Kozmetik: 0.18,
    Spor: 0.15,
    Gıda: 0.1,
    Kitap: 0.08,
    default: 0.15,
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Calculate P&L for a single product
   */
  async calculateProductPL(productId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        orderItems: {
          where: { order: { orderDate: { gte: startDate } } },
          include: { order: true },
        },
        pricingRules: true,
      },
    });

    if (!product) throw new Error("Product not found");

    // Revenue
    const totalUnits = product.orderItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const totalRevenue = product.orderItems.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );
    const avgSellingPrice =
      totalUnits > 0
        ? totalRevenue / totalUnits
        : Number((product as any).salePrice || 0);

    // Commission (öncelikle üründen, yoksa kategoriden al)
    const productCommission = Number(product.commissionRate || 0);
    const commissionRate =
      productCommission > 0
        ? productCommission / 100
        : this.getCommissionRate(product.categoryName || "default");
    const totalCommission = totalRevenue * commissionRate;

    // Shipping cost
    const shippingPerUnit =
      Number(product.shippingCost || 0) > 0
        ? Number(product.shippingCost)
        : Number(product.costPrice || 0) > 0
          ? 12.5
          : 15.0;
    const totalShipping = shippingPerUnit * totalUnits;

    // Packaging cost
    const packagingPerUnit = Number(product.packagingCost || 0);
    const totalPackaging = packagingPerUnit * totalUnits;

    // Product cost (COGS)
    const costPerUnit = Number(product.costPrice || 0);
    const totalCOGS = costPerUnit * totalUnits;

    // Ad spend (if data available)
    const adSpend = await this.getProductAdSpend(productId, startDate);

    // Returns
    const returns = await this.prisma.return.findMany({
      where: {
        tenantId: product.tenantId,
        createdAt: { gte: startDate },
      },
    });
    const productReturns = returns.length; // approximate
    const returnCost = productReturns * shippingPerUnit * 2; // double shipping for returns

    // Calculate P&L
    const grossProfit =
      totalRevenue -
      totalCommission -
      totalShipping -
      totalPackaging -
      totalCOGS;
    const netProfit = grossProfit - adSpend - returnCost;
    const grossMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      productId,
      productTitle: product.title,
      barcode: product.barcode,
      period: `Son ${days} gün`,
      revenue: {
        totalUnits,
        totalRevenue: round(totalRevenue),
        avgSellingPrice: round(avgSellingPrice),
        source: "api" as const,
      },
      costs: {
        commission: {
          amount: round(totalCommission),
          rate: commissionRate * 100,
          source:
            productCommission > 0 ? ("api" as const) : ("estimate" as const),
        },
        shipping: {
          amount: round(totalShipping),
          perUnit: shippingPerUnit,
          source:
            Number(product.shippingCost || 0) > 0
              ? ("api" as const)
              : ("estimate" as const),
        },
        packaging: {
          amount: round(totalPackaging),
          perUnit: packagingPerUnit,
          source:
            packagingPerUnit > 0 ? ("user" as const) : ("unknown" as const),
        },
        cogs: {
          amount: round(totalCOGS),
          perUnit: costPerUnit,
          source: costPerUnit > 0 ? ("api" as const) : ("unknown" as const),
        },
        adSpend: { amount: round(adSpend), source: "api" as const },
        returnCost: {
          amount: round(returnCost),
          returnCount: productReturns,
          source: "estimate" as const,
        },
      },
      profit: {
        grossProfit: round(grossProfit),
        netProfit: round(netProfit),
        grossMargin: round(grossMargin),
        netMargin: round(netMargin),
        profitPerUnit: totalUnits > 0 ? round(netProfit / totalUnits) : 0,
      },
      health: this.getProfitHealth(netMargin),
      recommendation: this.getProfitRecommendation(
        netMargin,
        commissionRate,
        adSpend,
        totalRevenue,
      ),
    };
  }

  /**
   * Calculate P&L for all products of a tenant
   */
  async calculateTenantPL(tenantId: string, days = 30) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
      select: { id: true },
    });

    const results = await Promise.all(
      products.map((p) =>
        this.calculateProductPL(p.id, days).catch(() => null),
      ),
    );

    const validResults = results.filter(Boolean) as any[];

    const totalRevenue = validResults.reduce(
      (sum, r) => sum + r.revenue.totalRevenue,
      0,
    );
    const totalNetProfit = validResults.reduce(
      (sum, r) => sum + r.profit.netProfit,
      0,
    );
    const totalUnits = validResults.reduce(
      (sum, r) => sum + r.revenue.totalUnits,
      0,
    );

    // Top winners and losers
    const sorted = [...validResults].sort(
      (a, b) => b.profit.netProfit - a.profit.netProfit,
    );

    return {
      summary: {
        totalProducts: validResults.length,
        totalRevenue: round(totalRevenue),
        totalNetProfit: round(totalNetProfit),
        overallMargin:
          totalRevenue > 0 ? round((totalNetProfit / totalRevenue) * 100) : 0,
        totalUnits,
        profitableProducts: validResults.filter((r) => r.profit.netProfit > 0)
          .length,
        unprofitableProducts: validResults.filter(
          (r) => r.profit.netProfit <= 0,
        ).length,
      },
      topWinners: sorted.slice(0, 5).map(simplifyPL),
      topLosers: sorted.slice(-5).reverse().map(simplifyPL),
      allProducts: validResults.map(simplifyPL),
    };
  }

  /**
   * Get commission rate for category
   */
  private getCommissionRate(category: string): number {
    for (const [key, rate] of Object.entries(this.defaultCommissionRates)) {
      if (category.toLowerCase().includes(key.toLowerCase())) return rate;
    }
    return this.defaultCommissionRates["default"];
  }

  /**
   * Get ad spend for a product
   */
  private async getProductAdSpend(
    productId: string,
    startDate: Date,
  ): Promise<number> {
    // Try to match keywords to product — simplified estimation
    const campaigns = await this.prisma.adCampaign.findMany({
      where: {
        dailyMetrics: {
          some: { date: { gte: startDate } },
        },
      },
      include: {
        dailyMetrics: {
          where: { date: { gte: startDate } },
        },
      },
    });

    // Rough estimate: distribute ad spend proportionally
    if (campaigns.length === 0) return 0;

    const totalAdSpend = campaigns.reduce(
      (sum, c) => sum + c.dailyMetrics.reduce((s, m) => s + Number(m.spend), 0),
      0,
    );

    // Without product-level attribution, estimate per-product share
    const productCount = await this.prisma.product.count({
      where: { tenantId: campaigns[0]?.tenantId, status: "active" },
    });

    return productCount > 0 ? totalAdSpend / productCount : 0;
  }

  private getProfitHealth(netMargin: number): {
    status: string;
    color: string;
    emoji: string;
  } {
    if (netMargin >= 25)
      return { status: "Mükemmel", color: "#10b981", emoji: "🟢" };
    if (netMargin >= 15)
      return { status: "İyi", color: "#22d3ee", emoji: "🔵" };
    if (netMargin >= 5)
      return { status: "Orta", color: "#fbbf24", emoji: "🟡" };
    if (netMargin >= 0)
      return { status: "Düşük", color: "#f97316", emoji: "🟠" };
    return { status: "Zarar", color: "#ef4444", emoji: "🔴" };
  }

  private getProfitRecommendation(
    netMargin: number,
    commRate: number,
    adSpend: number,
    revenue: number,
  ): string | null {
    if (netMargin < 0) {
      return "🚨 Bu ürün zararda! Fiyat artışı veya maliyet düşürme acil.";
    }
    if (netMargin < 5) {
      return "⚠️ Marj çok düşük. Reklam harcamasını optimize et veya fiyat ayarla.";
    }
    if (adSpend > 0 && revenue > 0 && adSpend / revenue > 0.15) {
      return "💡 Reklam maliyeti ciironun %15'ini aşıyor. ACOS optimizasyonu gerek.";
    }
    if (commRate >= 0.18) {
      return "💡 Komisyon oranı yüksek. Alternatif pazaryerlerini değerlendir.";
    }
    return null;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function simplifyPL(r: any) {
  return {
    productId: r.productId,
    title: r.productTitle,
    revenue: r.revenue.totalRevenue,
    units: r.revenue.totalUnits,
    netProfit: r.profit.netProfit,
    netMargin: r.profit.netMargin,
    health: r.health,
  };
}

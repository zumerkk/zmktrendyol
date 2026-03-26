import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * CustomerAnalyticsService — Müşteri Zekası & CLV
 *
 * Müşteri segmentasyonu + Lifetime Value:
 * - Tekrar eden müşteriler kim?
 * - Hangi ürünler tekrar satın alınıyor?
 * - CRM benzeri aksiyonlar
 */
@Injectable()
export class CustomerAnalyticsService {
  private readonly logger = new Logger(CustomerAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get customer segments
   */
  async getCustomerSegments(tenantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { tenantId },
      orderBy: { orderDate: "desc" },
    });

    // Group by customer
    const customerMap = new Map<
      string,
      {
        customerId: string;
        orderCount: number;
        totalSpent: number;
        firstOrder: Date;
        lastOrder: Date;
        avgOrderValue: number;
      }
    >();

    for (const order of orders) {
      const custId = order.customerNamePseudo || "anonymous";
      const existing = customerMap.get(custId) || {
        customerId: custId,
        orderCount: 0,
        totalSpent: 0,
        firstOrder: order.orderDate,
        lastOrder: order.orderDate,
        avgOrderValue: 0,
      };

      existing.orderCount++;
      existing.totalSpent += Number(order.totalPrice);
      if (order.orderDate < existing.firstOrder)
        existing.firstOrder = order.orderDate;
      if (order.orderDate > existing.lastOrder)
        existing.lastOrder = order.orderDate;
      existing.avgOrderValue = existing.totalSpent / existing.orderCount;

      customerMap.set(custId, existing);
    }

    const customers = Array.from(customerMap.values());

    // Segment customers
    const segments = {
      vip: customers.filter((c) => c.orderCount >= 5 && c.totalSpent >= 1000),
      loyal: customers.filter((c) => c.orderCount >= 3 && c.orderCount < 5),
      returning: customers.filter((c) => c.orderCount === 2),
      oneTime: customers.filter((c) => c.orderCount === 1),
      atRisk: customers.filter((c) => {
        const daysSinceLastOrder =
          (Date.now() - c.lastOrder.getTime()) / (1000 * 60 * 60 * 24);
        return c.orderCount >= 2 && daysSinceLastOrder > 90;
      }),
    };

    // CLV calculation
    const avgOrderValue =
      customers.length > 0
        ? customers.reduce((sum, c) => sum + c.avgOrderValue, 0) /
          customers.length
        : 0;
    const avgOrderFrequency =
      customers.length > 0
        ? customers.reduce((sum, c) => sum + c.orderCount, 0) / customers.length
        : 0;
    const avgLifespan = 12; // months estimate
    const clv = avgOrderValue * avgOrderFrequency * (avgLifespan / 12);

    return {
      totalCustomers: customers.length,
      segments: {
        vip: {
          count: segments.vip.length,
          totalRevenue: segments.vip.reduce((sum, c) => sum + c.totalSpent, 0),
          avgSpend:
            segments.vip.length > 0
              ? Math.round(
                  segments.vip.reduce((sum, c) => sum + c.totalSpent, 0) /
                    segments.vip.length,
                )
              : 0,
          label: "💎 VIP (5+ sipariş, ₺1K+)",
        },
        loyal: {
          count: segments.loyal.length,
          totalRevenue: segments.loyal.reduce(
            (sum, c) => sum + c.totalSpent,
            0,
          ),
          label: "⭐ Sadık (3-4 sipariş)",
        },
        returning: {
          count: segments.returning.length,
          totalRevenue: segments.returning.reduce(
            (sum, c) => sum + c.totalSpent,
            0,
          ),
          label: "🔄 Dönüşen (2 sipariş)",
        },
        oneTime: {
          count: segments.oneTime.length,
          totalRevenue: segments.oneTime.reduce(
            (sum, c) => sum + c.totalSpent,
            0,
          ),
          label: "👤 Tek Seferlik",
        },
        atRisk: {
          count: segments.atRisk.length,
          label: "⚠️ Risk Altında (90+ gün)",
        },
      },
      metrics: {
        avgOrderValue: Math.round(avgOrderValue),
        avgOrdersPerCustomer: Math.round(avgOrderFrequency * 100) / 100,
        estimatedCLV: Math.round(clv),
        repeatRate:
          customers.length > 0
            ? Math.round(
                (customers.filter((c) => c.orderCount >= 2).length /
                  customers.length) *
                  100,
              )
            : 0,
      },
      topCustomers: [...customers]
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10)
        .map((c) => ({
          id: c.customerId.substring(0, 20),
          orders: c.orderCount,
          totalSpent: Math.round(c.totalSpent),
          lastOrder: c.lastOrder,
        })),
      source: "api" as const,
    };
  }

  /**
   * Get repeat purchase analysis
   */
  async getRepeatPurchaseAnalysis(tenantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { tenantId },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { orderDate: "desc" },
    });

    // Find products that are frequently repurchased
    const productPurchases = new Map<
      string,
      {
        productId: string;
        title: string;
        uniqueCustomers: Set<string>;
        repeatCustomers: Set<string>;
        totalOrders: number;
      }
    >();

    const customerProducts = new Map<string, Set<string>>();

    for (const order of orders) {
      const custId = order.customerNamePseudo || "anonymous";
      if (!customerProducts.has(custId)) {
        customerProducts.set(custId, new Set());
      }

      for (const item of order.items) {
        const pid = item.productId || "unknown";
        const data = productPurchases.get(pid) || {
          productId: pid,
          title: item.product?.title || "Unknown",
          uniqueCustomers: new Set<string>(),
          repeatCustomers: new Set<string>(),
          totalOrders: 0,
        };

        data.totalOrders++;
        if (data.uniqueCustomers.has(custId)) {
          data.repeatCustomers.add(custId);
        }
        data.uniqueCustomers.add(custId);

        productPurchases.set(pid, data);
      }
    }

    const repeatProducts = Array.from(productPurchases.values())
      .map((p) => ({
        productId: p.productId,
        title: p.title,
        uniqueCustomers: p.uniqueCustomers.size,
        repeatCustomers: p.repeatCustomers.size,
        repeatRate:
          p.uniqueCustomers.size > 0
            ? Math.round(
                (p.repeatCustomers.size / p.uniqueCustomers.size) * 100,
              )
            : 0,
        totalOrders: p.totalOrders,
      }))
      .sort((a, b) => b.repeatRate - a.repeatRate);

    return {
      products: repeatProducts.slice(0, 20),
      avgRepeatRate:
        repeatProducts.length > 0
          ? Math.round(
              repeatProducts.reduce((sum, p) => sum + p.repeatRate, 0) /
                repeatProducts.length,
            )
          : 0,
      source: "api" as const,
    };
  }
}

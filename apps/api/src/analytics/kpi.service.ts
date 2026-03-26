import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

@Injectable()
export class KpiService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get daily KPIs for a date range
   * Kaynak: API (siparişler) → İç hesaplama
   */
  async getDailyKPIs(tenantId: string, startDate: string, endDate: string) {
    return this.prisma.kpiDaily.findMany({
      where: {
        tenantId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: "asc" },
    });
  }

  /**
   * Get monthly KPIs
   * Kaynak: API (siparişler) → İç hesaplama
   */
  async getMonthlyKPIs(tenantId: string, months = 12) {
    try {
      const now = new Date();
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - Number(months) || 0,
        1,
      );

      return await this.prisma.kpiMonthly.findMany({
        where: {
          tenantId,
          month: { gte: startDate },
        },
        orderBy: { month: "asc" },
      });
    } catch {
      return [];
    }
  }

  /**
   * Get summary metrics
   */
  async getSummary(tenantId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [orders, returns, products] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId, orderDate: { gte: thirtyDaysAgo } },
        include: { items: true },
      }),
      this.prisma.return.count({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.product.count({
        where: { tenantId, status: "active" },
      }),
    ]);

    const revenue = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const totalUnits = orders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0,
    );
    const orderCount = orders.length;

    return {
      last30Days: {
        revenue: { value: revenue, source: "api" as const },
        orders: { value: orderCount, source: "api" as const },
        units: { value: totalUnits, source: "api" as const },
        avgBasket: {
          value:
            orderCount > 0 ? Math.round((revenue / orderCount) * 100) / 100 : 0,
          source: "api" as const,
        },
        returnRate: {
          value:
            orderCount > 0
              ? Math.round((returns / orderCount) * 10000) / 100
              : 0,
          source: "api" as const,
        },
        returns: { value: returns, source: "api" as const },
      },
      activeProducts: products,
    };
  }

  /**
   * Get top performing products
   */
  async getTopProducts(tenantId: string, limit = 10) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: { tenantId, orderDate: { gte: thirtyDaysAgo } },
      },
      include: { product: true },
    });

    // Aggregate by product
    const productMap = new Map<
      string,
      { product: any; totalUnits: number; totalRevenue: number }
    >();

    for (const item of orderItems) {
      if (!item.product) continue;
      const existing = productMap.get(item.product.id) || {
        product: item.product,
        totalUnits: 0,
        totalRevenue: 0,
      };
      existing.totalUnits += item.quantity;
      existing.totalRevenue += Number(item.amount);
      productMap.set(item.product.id, existing);
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map((item) => ({
        ...item,
        source: "api" as const,
      }));
  }

  /**
   * Get hourly order heatmap data
   */
  async getOrderHeatmap(tenantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        orderDate: { gte: startDate },
      },
      select: { orderDate: true },
    });

    // Create heatmap: day of week x hour
    const heatmap: Record<string, Record<number, number>> = {};
    const days_of_week = [
      "Pazar",
      "Pazartesi",
      "Salı",
      "Çarşamba",
      "Perşembe",
      "Cuma",
      "Cumartesi",
    ];

    for (const day of days_of_week) {
      heatmap[day] = {};
      for (let h = 0; h < 24; h++) heatmap[day][h] = 0;
    }

    for (const order of orders) {
      const date = new Date(order.orderDate);
      const dayName = days_of_week[date.getDay()];
      const hour = date.getHours();
      heatmap[dayName][hour]++;
    }

    return { heatmap, source: "api" as const };
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";

/**
 * RestockingService — Predictive Restocking (Stok Tahmin Motoru)
 *
 * Satış hızına göre stok ne zaman bitecek → Otomatik uyarı
 * "Bu ürün 12 güne biter, 500 adet sipariş ver"
 *
 * Algoritma: Son 30 günlük satış hızı + mevsimsel katsayı → tükenme tahmini
 */
@Injectable()
export class RestockingService {
  private readonly logger = new Logger(RestockingService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsGateway,
  ) {}

  /**
   * Get restocking predictions for all products of a tenant
   */
  async getRestockingPredictions(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
      include: {
        orderItems: {
          where: {
            order: {
              orderDate: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      },
    });

    const predictions = products.map((product) => {
      const totalSold = product.orderItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const dailySalesRate = totalSold / 30;
      const currentStock = Number((product as any).quantity || 0);

      // Days until out of stock
      const daysUntilOOS =
        dailySalesRate > 0 ? Math.floor(currentStock / dailySalesRate) : null;

      // Recommended reorder quantity (30-day supply + safety buffer)
      const reorderQty = Math.ceil(dailySalesRate * 45); // 45 days supply
      const leadTimeDays = 7; // default supplier lead time

      // Urgency level
      let urgency: string;
      let color: string;
      if (daysUntilOOS === null || daysUntilOOS > 30) {
        urgency = "low";
        color = "#10b981";
      } else if (daysUntilOOS > 14) {
        urgency = "medium";
        color = "#fbbf24";
      } else if (daysUntilOOS > 7) {
        urgency = "high";
        color = "#f97316";
      } else {
        urgency = "critical";
        color = "#ef4444";
      }

      return {
        productId: product.id,
        title: product.title,
        barcode: product.barcode,
        currentStock,
        dailySalesRate: Math.round(dailySalesRate * 100) / 100,
        monthlyUnits: totalSold,
        daysUntilOOS,
        predictedOOSDate:
          daysUntilOOS !== null
            ? new Date(Date.now() + daysUntilOOS * 24 * 60 * 60 * 1000)
            : null,
        reorderQty,
        reorderDeadline:
          daysUntilOOS !== null && daysUntilOOS > leadTimeDays
            ? new Date(
                Date.now() +
                  (daysUntilOOS - leadTimeDays) * 24 * 60 * 60 * 1000,
              )
            : "HEMEN SİPARİŞ VER!",
        urgency,
        color,
        source: "estimate" as const,
      };
    });

    // Sort by urgency
    const urgencyOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    predictions.sort(
      (a, b) =>
        (urgencyOrder[a.urgency] || 99) - (urgencyOrder[b.urgency] || 99),
    );

    return {
      predictions,
      summary: {
        critical: predictions.filter((p) => p.urgency === "critical").length,
        high: predictions.filter((p) => p.urgency === "high").length,
        medium: predictions.filter((p) => p.urgency === "medium").length,
        low: predictions.filter((p) => p.urgency === "low").length,
      },
    };
  }

  /**
   * CRON: Check stock levels daily and alert on low stock
   */
  @Cron("0 9 * * *") // Her gün saat 9'da
  async checkStockAlerts() {
    this.logger.log("Running daily stock alert check...");

    const tenants = await this.prisma.tenant.findMany();

    for (const tenant of tenants) {
      const { predictions } = await this.getRestockingPredictions(tenant.id);
      const criticals = predictions.filter((p) => p.urgency === "critical");
      const highs = predictions.filter((p) => p.urgency === "high");

      if (criticals.length > 0) {
        await this.notifications.pushNotification(tenant.id, {
          type: "restock_alert",
          title: `🚨 ${criticals.length} ürün stok kritik!`,
          message: criticals
            .map(
              (p) =>
                `${p.title}: ${p.currentStock} kaldı (${p.daysUntilOOS} gün)`,
            )
            .join("\n"),
          severity: "critical",
          data: { products: criticals.map((p) => p.productId) },
        });
      }

      if (highs.length > 0) {
        await this.notifications.pushNotification(tenant.id, {
          type: "restock_alert",
          title: `⚠️ ${highs.length} ürün stoka dikkat`,
          message: highs
            .map((p) => `${p.title}: ${p.daysUntilOOS} gün kaldı`)
            .join("\n"),
          severity: "warning",
        });
      }
    }
  }

  /**
   * Get single product prediction with detailed breakdown
   */
  async getProductPrediction(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        orderItems: {
          include: { order: true },
          orderBy: { order: { orderDate: "desc" } },
          take: 200,
        },
      },
    });

    if (!product) throw new Error("Product not found");

    // Calculate weekly sales trend
    const now = new Date();
    const weeklyTrend: Array<{ week: string; units: number }> = [];

    for (let w = 0; w < 8; w++) {
      const weekStart = new Date(
        now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000,
      );
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const weekItems = product.orderItems.filter(
        (item) =>
          item.order.orderDate >= weekStart && item.order.orderDate < weekEnd,
      );
      const units = weekItems.reduce((sum, item) => sum + item.quantity, 0);
      weeklyTrend.unshift({
        week: `Hafta ${8 - w}`,
        units,
      });
    }

    // Trend direction
    const recentAvg =
      weeklyTrend.slice(-2).reduce((sum, w) => sum + w.units, 0) / 2;
    const olderAvg =
      weeklyTrend.slice(0, 2).reduce((sum, w) => sum + w.units, 0) / 2;
    const trendDirection =
      recentAvg > olderAvg * 1.1
        ? "increasing"
        : recentAvg < olderAvg * 0.9
          ? "decreasing"
          : "stable";

    return {
      productId,
      title: product.title,
      currentStock: Number((product as any).quantity || 0),
      weeklyTrend,
      trendDirection,
      averageDailySales: Math.round((recentAvg / 7) * 100) / 100,
      source: "estimate" as const,
    };
  }
}

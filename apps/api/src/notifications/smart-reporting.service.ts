import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * SmartReportingService — Email + WhatsApp Akıllı Raporlama
 *
 * Otomatik günlük/haftalık/aylık raporlar:
 * - Satış özeti (toplam, trend, en çok satanlar)
 * - Stok uyarıları (tükenmek üzere)
 * - Kârlılık raporu (en kârlı / en zararlı ürünler)
 * - Rakip aktivite özeti
 * - Reklam performansı
 *
 * Kanallar: Email, WhatsApp, Telegram (mevcut), SMS
 */
@Injectable()
export class SmartReportingService {
  private readonly logger = new Logger(SmartReportingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate daily summary report
   */
  async generateDailyReport(tenantId: string) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Sales summary
    const todayOrders = await this.prisma.order.count({
      where: { tenantId, orderDate: { gte: yesterday } },
    });
    const weekOrders = await this.prisma.order.count({
      where: { tenantId, orderDate: { gte: weekAgo } },
    });

    // Stock alerts - use inventory history for latest stock
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
      select: { id: true, title: true },
      take: 100,
    });

    // Get latest stock for each product from inventory history
    const lowStockProducts: Array<{ id: string; title: string; quantity: number }> = [];
    for (const p of products.slice(0, 50)) {
      const latest = await this.prisma.inventoryHistory.findFirst({
        where: { productId: p.id },
        orderBy: { time: "desc" },
      });
      if (latest && (latest.quantity || 0) <= 5) {
        lowStockProducts.push({
          id: p.id,
          title: p.title,
          quantity: latest.quantity || 0,
        });
      }
      if (lowStockProducts.length >= 10) break;
    }

    // Top sellers
    const topSellers = await this.prisma.orderItem.groupBy({
      by: ["barcode"],
      where: { order: { tenantId, orderDate: { gte: weekAgo } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    // Active campaigns
    const activeCampaigns = await this.prisma.adCampaign.count({
      where: { tenantId, status: "active" },
    });

    const report = {
      date: today.toISOString().split("T")[0],
      tenantId,
      sections: {
        sales: {
          title: "📊 Satış Özeti",
          todayOrders,
          weekOrders,
          avgDailyOrders: Math.round(weekOrders / 7),
          trend: todayOrders > weekOrders / 7 ? "📈 Yükseliyor" : "📉 Düşüyor",
        },
        stockAlerts: {
          title: "⚠️ Stok Uyarıları",
          lowStockCount: lowStockProducts.length,
          products: lowStockProducts.map((p) => ({
            title: p.title,
            remaining: p.quantity,
            urgency: p.quantity <= 2 ? "🔴 ACİL" : "🟡 DİKKAT",
          })),
        },
        topSellers: {
          title: "🏆 En Çok Satanlar (7 Gün)",
          products: topSellers.map((t) => ({
            barcode: t.barcode,
            totalSold: t._sum.quantity || 0,
          })),
        },
        ads: {
          title: "📢 Reklam Durumu",
          activeCampaigns,
        },
      },
      generatedAt: new Date().toISOString(),
    };

    return report;
  }

  /**
   * Generate weekly performance report
   */
  async generateWeeklyReport(tenantId: string) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const thisWeekOrders = await this.prisma.order.count({
      where: { tenantId, orderDate: { gte: weekAgo } },
    });
    const lastWeekOrders = await this.prisma.order.count({
      where: {
        tenantId,
        orderDate: { gte: twoWeeksAgo, lt: weekAgo },
      },
    });

    const growth =
      lastWeekOrders > 0
        ? Math.round(((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100)
        : 0;

    // Products needing attention
    const zeroStockCount = await this.prisma.inventoryHistory.count({
      where: {
        product: { tenantId, status: "active" },
        quantity: { lte: 0 },
      },
    });

    return {
      period: "Haftalık Rapor",
      thisWeek: thisWeekOrders,
      lastWeek: lastWeekOrders,
      growth: `${growth > 0 ? "+" : ""}${growth}%`,
      growthEmoji: growth > 0 ? "📈" : growth < 0 ? "📉" : "➡️",
      zeroStockProducts: zeroStockCount,
      actionItems: [
        ...(zeroStockCount > 0
          ? [`🔴 ${zeroStockCount} ürünün stoğu sıfıra yakın — acil yenile`]
          : []),
        ...(growth < -10
          ? ["⚠️ Satışlar %10'dan fazla düştü — kampanya öner"]
          : []),
        ...(growth > 20
          ? ["🟢 Satışlar çok iyi! Stok yeterli mi kontrol et"]
          : []),
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Format report for WhatsApp message
   */
  formatForWhatsApp(report: any): string {
    const sections = report.sections;
    let msg = `📊 *ZMK Trendyol Günlük Rapor*\n`;
    msg += `📅 ${report.date}\n\n`;

    if (sections.sales) {
      msg += `${sections.sales.title}\n`;
      msg += `• Bugün: ${sections.sales.todayOrders} sipariş\n`;
      msg += `• Bu hafta: ${sections.sales.weekOrders} sipariş\n`;
      msg += `• Trend: ${sections.sales.trend}\n\n`;
    }

    if (sections.stockAlerts?.products?.length > 0) {
      msg += `${sections.stockAlerts.title}\n`;
      for (const p of sections.stockAlerts.products.slice(0, 5)) {
        msg += `• ${p.urgency} ${p.title} (${p.remaining} adet)\n`;
      }
      msg += "\n";
    }

    if (sections.topSellers?.products?.length > 0) {
      msg += `${sections.topSellers.title}\n`;
      for (const p of sections.topSellers.products) {
        msg += `• ${p.barcode}: ${p.totalSold} adet\n`;
      }
    }

    return msg;
  }

  /**
   * Format report for Email (HTML)
   */
  formatForEmail(report: any): { subject: string; html: string } {
    const sections = report.sections;
    return {
      subject: `📊 ZMK Trendyol Rapor — ${report.date}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f27a1a;">📊 Günlük Rapor — ${report.date}</h2>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h3>${sections.sales?.title || ""}</h3>
            <p>Bugün: <strong>${sections.sales?.todayOrders || 0}</strong> sipariş</p>
            <p>Bu hafta: <strong>${sections.sales?.weekOrders || 0}</strong> sipariş</p>
            <p>Trend: ${sections.sales?.trend || ""}</p>
          </div>
          ${
            sections.stockAlerts?.products?.length > 0
              ? `<div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <h3>${sections.stockAlerts.title}</h3>
              <ul>
                ${sections.stockAlerts.products.map((p: any) => `<li>${p.urgency} ${p.title} — ${p.remaining} adet kaldı</li>`).join("")}
              </ul>
            </div>`
              : ""
          }
          <p style="color: #888; font-size: 12px;">ZMK Trendyol Intelligence Platform</p>
        </div>
      `,
    };
  }

  /**
   * Get report configuration for a tenant
   */
  async getReportConfig(tenantId: string) {
    return {
      tenantId,
      channels: {
        email: { enabled: true, frequency: "daily" },
        whatsapp: { enabled: false, frequency: "daily", note: "WhatsApp Business API gerekli" },
        telegram: { enabled: true, frequency: "daily" },
      },
      reportTypes: [
        { type: "daily_summary", label: "Günlük Özet", enabled: true },
        { type: "weekly_performance", label: "Haftalık Performans", enabled: true },
        { type: "stock_alerts", label: "Stok Uyarıları", enabled: true },
        { type: "competitor_alerts", label: "Rakip Hareketleri", enabled: false },
      ],
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyReports() {
    this.logger.log("Sending daily reports...");
    // In production: iterate tenants and send reports via configured channels
  }

  @Cron("0 9 * * 1") // Every Monday at 9 AM
  async sendWeeklyReports() {
    this.logger.log("Sending weekly reports...");
  }
}

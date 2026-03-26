import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TrendyolService } from "../trendyol.service";

/**
 * ClaimsService — Trendyol İade/Talep Yönetimi
 *
 * - İade/iptal siparişleri takibi
 * - İade sebep analizi
 * - Otomatik onay/ret politikaları
 * - İade maliyeti hesaplama
 */
@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    private prisma: PrismaService,
    private trendyol: TrendyolService,
  ) {}

  /**
   * Sync claims (returns) from Trendyol API
   * Endpoint: GET /integration/order/sellers/{sellerId}/claims
   */
  async syncClaims(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ synced: number }> {
    const { client, sellerId } = await this.trendyol.getClient(tenantId);

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    let page = 0;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const res = await client.get(
          `/integration/order/sellers/${sellerId}/claims`,
          {
            params: {
              claimDate: start.getTime(),
              endDate: end.getTime(),
              page,
              size: 100,
            },
          },
        );

        const claims = res.data?.content || [];
        hasMore = claims.length === 100;
        page++;

        for (const claim of claims) {
          // Upsert return record
          const returnRecord = await this.prisma.return.upsert({
            where: { id: `ty-claim-${claim.id}` },
            create: {
              id: `ty-claim-${claim.id}`,
              tenantId,
              orderId: claim.orderNumber
                ? `ty-${claim.shipmentPackageId}`
                : null,
              status: claim.claimStatus || "pending",
              reason: claim.claimIssueReasonText || claim.reason || "Belirtilmemiş",
            },
            update: {
              status: claim.claimStatus || "pending",
              reason: claim.claimIssueReasonText || claim.reason,
            },
          });

          // Sync claim items
          for (const item of claim.items || []) {
            await this.prisma.returnItem.upsert({
              where: { id: `ty-claim-item-${claim.id}-${item.lineId || 0}` },
              create: {
                id: `ty-claim-item-${claim.id}-${item.lineId || 0}`,
                returnId: returnRecord.id,
                quantity: item.quantity || 1,
                refundAmount: item.refundPrice || item.amount || 0,
              },
              update: {
                quantity: item.quantity || 1,
                refundAmount: item.refundPrice || item.amount || 0,
              },
            });
          }

          totalSynced++;
        }
      } catch (error: any) {
        this.logger.error(`Claims sync failed: ${error.message}`);
        throw error;
      }
    }

    this.logger.log(`Synced ${totalSynced} claims for tenant ${tenantId}`);
    return { synced: totalSynced };
  }

  /**
   * Get return analytics — reason breakdown, cost analysis
   */
  async getReturnAnalytics(tenantId: string, days: number | string = 30) {
    const numDays = Number(days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numDays);

    const returns = await this.prisma.return.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      include: {
        items: true,
        order: true,
      },
    });

    // Reason breakdown
    const reasonMap = new Map<string, { count: number; amount: number }>();
    let totalReturnAmount = 0;

    for (const ret of returns) {
      const reason = ret.reason || "Diğer";
      if (!reasonMap.has(reason)) {
        reasonMap.set(reason, { count: 0, amount: 0 });
      }
      const entry = reasonMap.get(reason)!;
      entry.count++;

      const returnAmount = ret.items.reduce(
        (sum, item) => sum + Number(item.refundAmount),
        0,
      );
      entry.amount += returnAmount;
      totalReturnAmount += returnAmount;
    }

    // Sort by count
    const reasonBreakdown = Array.from(reasonMap.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        amount: round(data.amount),
        percentage: round((data.count / returns.length) * 100),
      }));

    // Get total orders for return rate
    const totalOrders = await this.prisma.order.count({
      where: {
        tenantId,
        orderDate: { gte: startDate },
      },
    });

    const returnRate = totalOrders > 0 ? (returns.length / totalOrders) * 100 : 0;

    // Estimated return cost (double shipping + handling)
    const estimatedReturnCost = returns.length * 25; // ~25 TL per return handling

    return {
      period: `Son ${days} gün`,
      totalReturns: returns.length,
      totalReturnAmount: round(totalReturnAmount),
      returnRate: round(returnRate),
      estimatedReturnCost: round(estimatedReturnCost),
      reasonBreakdown,
      health:
        returnRate < 3
          ? { status: "Mükemmel", emoji: "🟢" }
          : returnRate < 8
            ? { status: "Normal", emoji: "🟡" }
            : { status: "Yüksek", emoji: "🔴" },
      recommendations: this.getReturnRecommendations(reasonBreakdown, returnRate),
      source: "api" as const,
    };
  }

  private getReturnRecommendations(
    reasons: Array<{ reason: string; count: number; percentage: number }>,
    returnRate: number,
  ): string[] {
    const recommendations: string[] = [];

    if (returnRate > 10) {
      recommendations.push(
        "🚨 İade oranı %10 üzerinde! Ürün kalitesi ve açıklamaları acil gözden geçirilmeli.",
      );
    }

    const topReason = reasons[0];
    if (topReason) {
      if (topReason.reason.toLowerCase().includes("beden") || topReason.reason.toLowerCase().includes("boyut")) {
        recommendations.push(
          "👗 Beden/boyut kaynaklı iadeler fazla. Beden tablosu eklenmeli veya güncellenmeli.",
        );
      }
      if (topReason.reason.toLowerCase().includes("hasar") || topReason.reason.toLowerCase().includes("kırık")) {
        recommendations.push(
          "📦 Hasar kaynaklı iadeler fazla. Paketleme kalitesi artırılmalı.",
        );
      }
      if (topReason.reason.toLowerCase().includes("farklı") || topReason.reason.toLowerCase().includes("yanlış")) {
        recommendations.push(
          "🔄 Yanlış ürün gönderimi fazla. Depo süreçleri kontrol edilmeli.",
        );
      }
    }

    return recommendations;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

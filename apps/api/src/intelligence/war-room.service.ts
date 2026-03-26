import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * WarRoomService — Competitive War Room (Rekabet Savaş Odası)
 *
 * Rakip bazlı 360° görünüm:
 * - Rakibin tüm hareketlerini takip et
 * - Rekabet skoru hesapla (0-100)
 * - "Bu rakibi yenmek için yapman gereken 5 şey" → AI
 * - Timeline: her hamle kaydedilir
 */
@Injectable()
export class WarRoomService {
  private readonly logger = new Logger(WarRoomService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Record a competitive event
   */
  async recordEvent(
    tenantId: string,
    event: {
      competitorId?: string;
      eventType: string;
      title: string;
      description: string;
      impact?: string;
      data?: any;
    },
  ) {
    return this.prisma.warRoomEntry.create({
      data: {
        tenantId,
        competitorId: event.competitorId,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        impact: event.impact || "medium",
        data: event.data,
      },
    });
  }

  /**
   * Get war room timeline
   */
  async getTimeline(
    tenantId: string,
    options?: {
      competitorId?: string;
      eventType?: string;
      impact?: string;
      limit?: number;
      days?: number;
    },
  ) {
    const where: any = { tenantId };

    if (options?.competitorId) where.competitorId = options.competitorId;
    if (options?.eventType) where.eventType = options.eventType;
    if (options?.impact) where.impact = options.impact;
    if (options?.days) {
      where.createdAt = {
        gte: new Date(Date.now() - options.days * 24 * 60 * 60 * 1000),
      };
    }

    return this.prisma.warRoomEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 50,
    });
  }

  /**
   * Get competitor battle card (360° view)
   */
  async getCompetitorBattleCard(tenantId: string, competitorId: string) {
    const [competitor, events, snapshots, buyboxData] = await Promise.all([
      this.prisma.competitorProduct.findUnique({ where: { id: competitorId } }),
      this.prisma.warRoomEntry.findMany({
        where: { tenantId, competitorId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.competitorSnapshot.findMany({
        where: { competitorProductId: competitorId },
        orderBy: { time: "desc" },
        take: 30,
      }),
      this.prisma.buyboxSnapshot.findMany({
        where: { competitorProductId: competitorId },
        orderBy: { time: "desc" },
        take: 30,
      }),
    ]);

    if (!competitor) throw new Error("Competitor not found");

    // Price trend
    const prices = snapshots.filter((s) => s.price).map((s) => Number(s.price));
    const priceTrend =
      prices.length >= 2
        ? prices[0] > prices[prices.length - 1]
          ? "decreasing"
          : prices[0] < prices[prices.length - 1]
            ? "increasing"
            : "stable"
        : "unknown";

    // Review growth
    const reviews = snapshots
      .filter((s) => s.reviewCount)
      .map((s) => s.reviewCount || 0);
    const reviewGrowth =
      reviews.length >= 2 ? reviews[0] - reviews[reviews.length - 1] : 0;

    // Buybox ownership
    const ourBuybox = buyboxData.filter((b) => b.isOurBuybox).length;
    const buyboxRate =
      buyboxData.length > 0
        ? Math.round((ourBuybox / buyboxData.length) * 100)
        : null;

    // Competition score (0-100 — lower is easier to beat)
    let competitionScore = 50;
    if (prices.length > 0 && prices[0] < 50) competitionScore += 10; // aggressive pricing
    if (reviewGrowth > 100) competitionScore += 15; // fast growing
    if (buyboxRate !== null && buyboxRate < 30) competitionScore -= 10; // we're winning buybox
    competitionScore = Math.max(0, Math.min(100, competitionScore));

    return {
      competitor: {
        id: competitor.id,
        title: competitor.title,
        brand: competitor.brand,
        url: competitor.trendyolUrl,
        trackedSince: competitor.trackedSince,
      },
      currentStatus: {
        latestPrice: prices[0] || null,
        priceTrend,
        latestRating: snapshots[0]?.rating ? Number(snapshots[0].rating) : null,
        latestReviewCount: snapshots[0]?.reviewCount || null,
        reviewGrowth30d: reviewGrowth,
        buyboxOwnershipRate: buyboxRate,
        inStock: snapshots[0]?.inStock ?? null,
      },
      competitionScore,
      recentEvents: events.slice(0, 10),
      source: "estimate" as const,
    };
  }

  /**
   * Get war room dashboard summary
   */
  async getDashboard(tenantId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalEvents, recentEvents, byType, criticals] = await Promise.all([
      this.prisma.warRoomEntry.count({ where: { tenantId } }),
      this.prisma.warRoomEntry.count({
        where: { tenantId, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.warRoomEntry.groupBy({
        by: ["eventType"],
        where: { tenantId, createdAt: { gte: sevenDaysAgo } },
        _count: true,
      }),
      this.prisma.warRoomEntry.findMany({
        where: {
          tenantId,
          impact: "critical",
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      totalEvents,
      last7Days: recentEvents,
      byEventType: byType.map((b) => ({ type: b.eventType, count: b._count })),
      criticalAlerts: criticals,
      competitorCount: await this.prisma.competitorProduct.count({
        where: { tenantId },
      }),
    };
  }

  /**
   * Mark action taken on a war room event
   */
  async markActionTaken(eventId: string, action: string) {
    return this.prisma.warRoomEntry.update({
      where: { id: eventId },
      data: { actionTaken: action },
    });
  }
}

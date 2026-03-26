import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * RankTrackerService — Trendyol Arama Sıralama Takibi
 *
 * Türkiye'de BU YOK → Helium 10 Rank Tracker seviyesi
 *
 * Özellikler:
 * - Belirlenen anahtar kelimelerde günlük sıralama takibi
 * - Organik vs reklam sıralama ayrımı
 * - Sıralama değişikliği anlık alarm
 * - Rakip sıralama karşılaştırması
 * - Trend analizi
 */
@Injectable()
export class RankTrackerService {
  private readonly logger = new Logger(RankTrackerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Add a keyword to track
   */
  async addKeyword(
    tenantId: string,
    keyword: string,
    productId?: string,
    categoryId?: number,
    checkIntervalMinutes = 1440,
  ) {
    const tracking = await this.prisma.keywordTracking.upsert({
      where: {
        tenantId_keyword: { tenantId, keyword: keyword.toLowerCase() },
      },
      create: {
        tenantId,
        keyword: keyword.toLowerCase(),
        productId,
        categoryId,
        checkInterval: checkIntervalMinutes,
      },
      update: {
        productId,
        categoryId,
        isActive: true,
        checkInterval: checkIntervalMinutes,
      },
    });

    return tracking;
  }

  /**
   * Remove a keyword from tracking
   */
  async removeKeyword(tenantId: string, keyword: string) {
    return this.prisma.keywordTracking.update({
      where: {
        tenantId_keyword: { tenantId, keyword: keyword.toLowerCase() },
      },
      data: { isActive: false },
    });
  }

  /**
   * Get all tracked keywords with their latest ranks
   */
  async getTrackedKeywords(tenantId: string) {
    const keywords = await this.prisma.keywordTracking.findMany({
      where: { tenantId, isActive: true },
      include: {
        history: {
          orderBy: { time: "desc" },
          take: 2, // last 2 for trend calculation
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return keywords.map((kw) => {
      const latest = kw.history[0];
      const previous = kw.history[1];
      const rankChange =
        latest && previous && latest.organicRank && previous.organicRank
          ? previous.organicRank - latest.organicRank // positive = improved
          : 0;

      return {
        id: kw.id,
        keyword: kw.keyword,
        productId: kw.productId,
        currentRank: latest?.organicRank || null,
        adRank: latest?.adRank || null,
        previousRank: previous?.organicRank || null,
        change: rankChange,
        trend:
          rankChange > 0 ? "up" : rankChange < 0 ? "down" : "stable",
        trendEmoji:
          rankChange > 0 ? "📈" : rankChange < 0 ? "📉" : "➡️",
        totalResults: latest?.totalResults || null,
        lastChecked: latest?.time || null,
        checkInterval: kw.checkInterval,
      };
    });
  }

  /**
   * Get rank history for a specific keyword
   */
  async getKeywordRankHistory(
    tenantId: string,
    keyword: string,
    days = 30,
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tracking = await this.prisma.keywordTracking.findUnique({
      where: {
        tenantId_keyword: { tenantId, keyword: keyword.toLowerCase() },
      },
    });

    if (!tracking) throw new Error(`Keyword "${keyword}" is not being tracked`);

    const history = await this.prisma.keywordRankHistory.findMany({
      where: {
        keywordId: tracking.id,
        time: { gte: startDate },
      },
      orderBy: { time: "asc" },
    });

    // Calculate stats
    const ranks = history
      .map((h) => h.organicRank)
      .filter((r): r is number => r !== null);

    const stats = ranks.length > 0
      ? {
          bestRank: Math.min(...ranks),
          worstRank: Math.max(...ranks),
          avgRank: Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length),
          currentRank: ranks[ranks.length - 1],
          dataPoints: ranks.length,
          improved: ranks.length > 1 && ranks[ranks.length - 1] < ranks[0],
        }
      : null;

    return {
      keyword: tracking.keyword,
      productId: tracking.productId,
      period: `Son ${days} gün`,
      stats,
      history: history.map((h) => ({
        time: h.time,
        organicRank: h.organicRank,
        adRank: h.adRank,
        totalResults: h.totalResults,
        pageNumber: h.pageNumber,
        topCompetitors: h.topCompetitors,
      })),
    };
  }

  /**
   * Record a rank check result
   * Called by ScraperModule when a keyword search is performed
   */
  async recordRank(
    keywordId: string,
    organicRank: number | null,
    adRank: number | null,
    totalResults: number | null,
    topCompetitors: any[] | null,
    searchUrl?: string,
  ) {
    const pageNumber =
      organicRank !== null ? Math.ceil(organicRank / 24) : null; // Trendyol shows 24 per page

    await this.prisma.keywordRankHistory.create({
      data: {
        keywordId,
        organicRank,
        adRank,
        totalResults,
        pageNumber,
        topCompetitors: topCompetitors as any,
        searchUrl,
      },
    });

    // Update last checked time
    await this.prisma.keywordTracking.update({
      where: { id: keywordId },
      data: { lastCheckedAt: new Date() },
    });

    // Check for significant rank change and generate alert
    await this.checkRankAlert(keywordId, organicRank);
  }

  /**
   * Rank comparison — how do we rank vs competitors for each keyword
   */
  async getRankComparison(tenantId: string) {
    const keywords = await this.prisma.keywordTracking.findMany({
      where: { tenantId, isActive: true },
      include: {
        history: {
          orderBy: { time: "desc" },
          take: 1,
        },
      },
    });

    const comparison = keywords.map((kw) => {
      const latest = kw.history[0];
      const competitors = (latest?.topCompetitors as any[]) || [];

      return {
        keyword: kw.keyword,
        ourRank: latest?.organicRank || null,
        ourAdRank: latest?.adRank || null,
        totalResults: latest?.totalResults || null,
        topCompetitors: competitors.slice(0, 5).map((c: any, index: number) => ({
          rank: index + 1,
          title: c.title,
          brand: c.brand,
          price: c.price,
          rating: c.rating,
        })),
        onFirstPage: latest?.organicRank ? latest.organicRank <= 24 : false,
        visibility:
          !latest?.organicRank
            ? "invisible"
            : latest.organicRank <= 3
              ? "dominant"
              : latest.organicRank <= 10
                ? "strong"
                : latest.organicRank <= 24
                  ? "visible"
                  : "weak",
      };
    });

    // Summary stats
    const onFirstPage = comparison.filter((c) => c.onFirstPage).length;
    const dominant = comparison.filter((c) => c.visibility === "dominant").length;

    return {
      totalKeywords: comparison.length,
      onFirstPage,
      firstPageRate:
        comparison.length > 0
          ? Math.round((onFirstPage / comparison.length) * 100)
          : 0,
      dominantKeywords: dominant,
      comparison,
      overallHealth:
        onFirstPage / comparison.length > 0.7
          ? { status: "Güçlü", emoji: "🟢" }
          : onFirstPage / comparison.length > 0.4
            ? { status: "Orta", emoji: "🟡" }
            : { status: "Zayıf", emoji: "🔴" },
    };
  }

  /**
   * Scheduled: Check keywords that need updating
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleRankChecks() {
    const now = new Date();
    const keywordsToCheck = await this.prisma.keywordTracking.findMany({
      where: {
        isActive: true,
        OR: [
          { lastCheckedAt: null },
          {
            lastCheckedAt: {
              lt: new Date(now.getTime() - 60 * 60 * 1000), // at least 1 hour ago
            },
          },
        ],
      },
      take: 20,
    });

    if (keywordsToCheck.length > 0) {
      this.logger.log(
        `${keywordsToCheck.length} keywords need rank checking`,
      );
      // These keyword IDs would be passed to the scraper engine for processing
      // The scraper will call recordRank() with the results
    }

    return keywordsToCheck;
  }

  /**
   * Check for significant rank changes and create alerts
   */
  private async checkRankAlert(
    keywordId: string,
    newRank: number | null,
  ) {
    if (newRank === null) return;

    const previousRecords = await this.prisma.keywordRankHistory.findMany({
      where: { keywordId },
      orderBy: { time: "desc" },
      take: 2,
      skip: 1, // skip the one we just inserted
    });

    if (previousRecords.length === 0) return;

    const prevRank = previousRecords[0]?.organicRank;
    if (!prevRank) return;

    const change = prevRank - newRank; // positive = improved

    // Alert on significant changes (more than 5 positions)
    if (Math.abs(change) >= 5) {
      const keyword = await this.prisma.keywordTracking.findUnique({
        where: { id: keywordId },
      });

      if (keyword) {
        await this.prisma.notification.create({
          data: {
            tenantId: keyword.tenantId,
            type: "ranking_change",
            channel: "websocket",
            title:
              change > 0
                ? `📈 Sıralama Yükseldi: "${keyword.keyword}"`
                : `📉 Sıralama Düştü: "${keyword.keyword}"`,
            message:
              change > 0
                ? `"${keyword.keyword}" kelimesinde ${Math.abs(change)} sıra yükseldiniz! (${prevRank} → ${newRank})`
                : `"${keyword.keyword}" kelimesinde ${Math.abs(change)} sıra düştünüz! (${prevRank} → ${newRank})`,
            severity: Math.abs(change) >= 10 ? "critical" : "warning",
            data: {
              keywordId,
              keyword: keyword.keyword,
              previousRank: prevRank,
              newRank,
              change,
            } as any,
          },
        });
      }
    }
  }
}

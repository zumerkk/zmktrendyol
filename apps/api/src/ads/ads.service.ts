import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { TrendyolService } from "../trendyol/trendyol.service";

/**
 * AdsService — Trendyol Reklam Yönetimi
 *
 * Reklam kampanyalarını senkronize eder, ACOS hesaplar,
 * keyword sıralamalarını takip eder.
 * ZMK bir pazarlama ajansı olduğu için bu modül kritik.
 *
 * ⚠️ Kaynak: API (Trendyol Reklam API, resmi) + estimate (ACOS hesaplama)
 */
@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private prisma: PrismaService,
    private trendyolService: TrendyolService,
  ) {}

  /**
   * Sync campaigns from Trendyol Ads API
   */
  async syncCampaigns(tenantId: string) {
    try {
      const { client, sellerId } =
        await this.trendyolService.getClient(tenantId);

      // Trendyol Reklam API endpoint (if available)
      // Note: Trendyol's ad API access may be limited
      // Fallback: manual entry or extension-based data collection
      let campaigns: any[] = [];

      try {
        const response = await client.get(
          `/integration/sellers/${sellerId}/sponsored-products/campaigns`,
        );
        campaigns = response.data?.campaigns || response.data || [];
      } catch (apiError: any) {
        this.logger.warn(
          `Trendyol Ads API not accessible: ${apiError.message}. Using extension/manual data.`,
        );
        // Return existing campaigns from DB
        return this.getCampaigns(tenantId);
      }

      // Upsert campaigns
      for (const campaign of campaigns) {
        await this.prisma.adCampaign.upsert({
          where: {
            id: campaign.id || "temp",
          },
          create: {
            tenantId,
            trendyolCampaignId: String(campaign.id || campaign.campaignId),
            name: campaign.name || campaign.campaignName || "Unnamed",
            status: campaign.status || "active",
            budgetDaily: campaign.dailyBudget || campaign.budget?.daily,
            budgetTotal: campaign.totalBudget || campaign.budget?.total,
            startDate: campaign.startDate ? new Date(campaign.startDate) : null,
            endDate: campaign.endDate ? new Date(campaign.endDate) : null,
          },
          update: {
            name: campaign.name || campaign.campaignName,
            status: campaign.status,
            budgetDaily: campaign.dailyBudget || campaign.budget?.daily,
            budgetTotal: campaign.totalBudget || campaign.budget?.total,
          },
        });
      }

      this.logger.log(
        `Synced ${campaigns.length} ad campaigns for tenant ${tenantId}`,
      );
      return this.getCampaigns(tenantId);
    } catch (error: any) {
      this.logger.error(`Ad sync failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all campaigns for a tenant
   */
  async getCampaigns(tenantId: string) {
    return this.prisma.adCampaign.findMany({
      where: { tenantId },
      include: {
        dailyMetrics: {
          orderBy: { date: "desc" },
          take: 7,
        },
        _count: {
          select: { keywords: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create a campaign manually (for when API sync is not available)
   */
  async createCampaign(
    tenantId: string,
    dto: {
      name: string;
      trendyolCampaignId?: string;
      budgetDaily?: number;
      budgetTotal?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.prisma.adCampaign.create({
      data: {
        tenantId,
        name: dto.name,
        trendyolCampaignId: dto.trendyolCampaignId,
        budgetDaily: dto.budgetDaily,
        budgetTotal: dto.budgetTotal,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  /**
   * Record keyword performance data
   */
  async recordKeywordPerformance(
    campaignId: string,
    data: {
      keyword: string;
      matchType?: string;
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      orders: number;
      searchRank?: number;
      adRank?: number;
      date: string;
    },
  ) {
    const acos = data.sales > 0 ? (data.spend / data.sales) * 100 : null;

    return this.prisma.adKeywordPerformance.create({
      data: {
        campaignId,
        keyword: data.keyword,
        matchType: data.matchType || "broad",
        impressions: data.impressions,
        clicks: data.clicks,
        spend: data.spend,
        sales: data.sales,
        orders: data.orders,
        acos,
        searchRank: data.searchRank,
        adRank: data.adRank,
        date: new Date(data.date),
      },
    });
  }

  /**
   * Get keyword performances for a campaign
   */
  async getKeywordPerformances(campaignId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const keywords = await this.prisma.adKeywordPerformance.findMany({
      where: {
        campaignId,
        date: { gte: startDate },
      },
      orderBy: { date: "desc" },
    });

    // Aggregate by keyword
    const keywordMap = new Map<
      string,
      {
        keyword: string;
        totalImpressions: number;
        totalClicks: number;
        totalSpend: number;
        totalSales: number;
        totalOrders: number;
        latestSearchRank: number | null;
        latestAdRank: number | null;
      }
    >();

    for (const kw of keywords) {
      const existing = keywordMap.get(kw.keyword) || {
        keyword: kw.keyword,
        totalImpressions: 0,
        totalClicks: 0,
        totalSpend: 0,
        totalSales: 0,
        totalOrders: 0,
        latestSearchRank: null,
        latestAdRank: null,
      };

      existing.totalImpressions += kw.impressions;
      existing.totalClicks += kw.clicks;
      existing.totalSpend += Number(kw.spend);
      existing.totalSales += Number(kw.sales);
      existing.totalOrders += kw.orders;

      // Keep latest rank
      if (!existing.latestSearchRank && kw.searchRank) {
        existing.latestSearchRank = kw.searchRank;
      }
      if (!existing.latestAdRank && kw.adRank) {
        existing.latestAdRank = kw.adRank;
      }

      keywordMap.set(kw.keyword, existing);
    }

    return Array.from(keywordMap.values()).map((kw) => ({
      ...kw,
      acos:
        kw.totalSales > 0
          ? Math.round((kw.totalSpend / kw.totalSales) * 100 * 100) / 100
          : null,
      ctr:
        kw.totalImpressions > 0
          ? Math.round((kw.totalClicks / kw.totalImpressions) * 100 * 100) / 100
          : null,
      cpc:
        kw.totalClicks > 0
          ? Math.round((kw.totalSpend / kw.totalClicks) * 100) / 100
          : null,
      source: "api" as const,
    }));
  }

  /**
   * Record daily ad metrics
   */
  async recordDailyMetrics(
    campaignId: string,
    data: {
      date: string;
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      orders: number;
    },
  ) {
    const acos = data.sales > 0 ? (data.spend / data.sales) * 100 : null;
    const roas = data.spend > 0 ? data.sales / data.spend : null;
    const ctr =
      data.impressions > 0 ? (data.clicks / data.impressions) * 100 : null;
    const cpc = data.clicks > 0 ? data.spend / data.clicks : null;

    return this.prisma.adDailyMetric.upsert({
      where: {
        campaignId_date: {
          campaignId,
          date: new Date(data.date),
        },
      },
      create: {
        campaignId,
        date: new Date(data.date),
        impressions: data.impressions,
        clicks: data.clicks,
        spend: data.spend,
        sales: data.sales,
        orders: data.orders,
        acos,
        roas,
        ctr,
        cpc,
      },
      update: {
        impressions: data.impressions,
        clicks: data.clicks,
        spend: data.spend,
        sales: data.sales,
        orders: data.orders,
        acos,
        roas,
        ctr,
        cpc,
      },
    });
  }

  /**
   * Get daily metrics for a campaign
   */
  async getDailyMetrics(campaignId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.prisma.adDailyMetric.findMany({
      where: {
        campaignId,
        date: { gte: startDate },
      },
      orderBy: { date: "asc" },
    });
  }

  /**
   * Get ACOS analysis across all campaigns
   */
  async getACOSAnalysis(tenantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const campaigns = await this.prisma.adCampaign.findMany({
      where: { tenantId },
      include: {
        dailyMetrics: {
          where: { date: { gte: startDate } },
          orderBy: { date: "asc" },
        },
      },
    });

    return campaigns.map((campaign) => {
      const totalSpend = campaign.dailyMetrics.reduce(
        (sum, m) => sum + Number(m.spend),
        0,
      );
      const totalSales = campaign.dailyMetrics.reduce(
        (sum, m) => sum + Number(m.sales),
        0,
      );
      const totalOrders = campaign.dailyMetrics.reduce(
        (sum, m) => sum + m.orders,
        0,
      );
      const totalClicks = campaign.dailyMetrics.reduce(
        (sum, m) => sum + m.clicks,
        0,
      );
      const totalImpressions = campaign.dailyMetrics.reduce(
        (sum, m) => sum + m.impressions,
        0,
      );

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        period: `Last ${days} days`,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalSales: Math.round(totalSales * 100) / 100,
        totalOrders,
        acos:
          totalSales > 0
            ? Math.round((totalSpend / totalSales) * 100 * 100) / 100
            : null,
        roas:
          totalSpend > 0
            ? Math.round((totalSales / totalSpend) * 100) / 100
            : null,
        ctr:
          totalImpressions > 0
            ? Math.round((totalClicks / totalImpressions) * 100 * 100) / 100
            : null,
        cpc:
          totalClicks > 0
            ? Math.round((totalSpend / totalClicks) * 100) / 100
            : null,
        dailyTrend: campaign.dailyMetrics.map((m) => ({
          date: m.date,
          acos: m.acos,
          spend: m.spend,
          sales: m.sales,
        })),
        source: "api" as const,
      };
    });
  }

  /**
   * Get overall ad performance summary
   */
  async getPerformanceSummary(tenantId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const metrics = await this.prisma.adDailyMetric.findMany({
      where: {
        campaign: { tenantId },
        date: { gte: last30Days },
      },
    });

    const totalSpend = metrics.reduce((sum, m) => sum + Number(m.spend), 0);
    const totalSales = metrics.reduce((sum, m) => sum + Number(m.sales), 0);
    const totalOrders = metrics.reduce((sum, m) => sum + m.orders, 0);
    const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
    const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);

    const activeCampaigns = await this.prisma.adCampaign.count({
      where: { tenantId, status: "active" },
    });

    return {
      last30Days: {
        totalSpend: {
          value: Math.round(totalSpend * 100) / 100,
          source: "api" as const,
        },
        totalSales: {
          value: Math.round(totalSales * 100) / 100,
          source: "api" as const,
        },
        totalOrders: { value: totalOrders, source: "api" as const },
        acos: {
          value:
            totalSales > 0
              ? Math.round((totalSpend / totalSales) * 100 * 100) / 100
              : null,
          source: "api" as const,
        },
        roas: {
          value:
            totalSpend > 0
              ? Math.round((totalSales / totalSpend) * 100) / 100
              : null,
          source: "api" as const,
        },
        ctr: {
          value:
            totalImpressions > 0
              ? Math.round((totalClicks / totalImpressions) * 100 * 100) / 100
              : null,
          source: "api" as const,
        },
        cpc: {
          value:
            totalClicks > 0
              ? Math.round((totalSpend / totalClicks) * 100) / 100
              : null,
          source: "api" as const,
        },
      },
      activeCampaigns,
    };
  }

  /**
   * Delete a campaign and all related data
   */
  async deleteCampaign(campaignId: string) {
    await this.prisma.adKeywordPerformance.deleteMany({
      where: { campaignId },
    });
    await this.prisma.adDailyMetric.deleteMany({ where: { campaignId } });
    return this.prisma.adCampaign.delete({ where: { id: campaignId } });
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * AdAutopilotService — AI Reklam Otopilot
 *
 * Türkiye'de BU YOK → Amazon PPC Autopilot seviyesi
 *
 * Özellikler:
 * - Otomatik bid yönetimi (ACOS hedefe göre)
 * - Kötü keyword tespit & negatif anahtar kelime önerisi
 * - Bütçe optimizasyonu — günlük bütçeyi performansa göre dağıt
 * - Kampanya sağlık skoru (0-100)
 * - Otomatik kampanya önerileri (hangi ürünler reklam yapmalı?)
 */
@Injectable()
export class AdAutopilotService {
  private readonly logger = new Logger(AdAutopilotService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Analyze all campaigns and generate autopilot recommendations
   */
  async getAutopilotDashboard(tenantId: string) {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { tenantId, status: "active" },
      include: {
        dailyMetrics: {
          orderBy: { date: "desc" },
          take: 30,
        },
        keywords: {
          orderBy: { date: "desc" },
          take: 100,
        },
      },
    });

    const campaignAnalyses = campaigns.map((c) => this.analyzeCampaign(c));

    // Find best and worst performers
    const sorted = [...campaignAnalyses].sort(
      (a, b) => b.healthScore - a.healthScore,
    );

    // Budget redistribution recommendation
    const totalDailyBudget = campaigns.reduce(
      (sum, c) => sum + Number(c.budgetDaily || 0),
      0,
    );
    const redistributed = this.calculateBudgetRedistribution(
      campaignAnalyses,
      totalDailyBudget,
    );

    return {
      totalCampaigns: campaigns.length,
      overallHealthScore: campaignAnalyses.length > 0
        ? Math.round(
            campaignAnalyses.reduce((s, c) => s + c.healthScore, 0) /
              campaignAnalyses.length,
          )
        : 0,
      totalDailyBudget: round(totalDailyBudget),
      campaigns: campaignAnalyses,
      bestPerformer: sorted[0] || null,
      worstPerformer: sorted[sorted.length - 1] || null,
      budgetRedistribution: redistributed,
      urgentActions: this.getUrgentActions(campaignAnalyses),
      source: "estimate" as const,
    };
  }

  /**
   * Get bid optimization suggestions for a campaign
   */
  async getBidSuggestions(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        keywords: {
          orderBy: { date: "desc" },
          take: 200,
        },
      },
    });

    if (!campaign) throw new Error("Kampanya bulunamadı");

    // Aggregate keyword performance
    const keywordMap = new Map<string, {
      keyword: string;
      totalSpend: number;
      totalSales: number;
      totalClicks: number;
      totalImpressions: number;
      totalOrders: number;
      count: number;
    }>();

    for (const kw of campaign.keywords) {
      const existing = keywordMap.get(kw.keyword) || {
        keyword: kw.keyword,
        totalSpend: 0,
        totalSales: 0,
        totalClicks: 0,
        totalImpressions: 0,
        totalOrders: 0,
        count: 0,
      };
      existing.totalSpend += Number(kw.spend);
      existing.totalSales += Number(kw.sales);
      existing.totalClicks += kw.clicks;
      existing.totalImpressions += kw.impressions;
      existing.totalOrders += kw.orders;
      existing.count++;
      keywordMap.set(kw.keyword, existing);
    }

    const keywords = Array.from(keywordMap.values());

    // Categorize keywords
    const goldKeywords = keywords.filter(
      (kw) => kw.totalSales > 0 && kw.totalSpend / kw.totalSales < 0.15,
    ); // ACoS < 15%
    const silverKeywords = keywords.filter(
      (kw) =>
        kw.totalSales > 0 &&
        kw.totalSpend / kw.totalSales >= 0.15 &&
        kw.totalSpend / kw.totalSales < 0.30,
    ); // ACoS 15-30%
    const wasteKeywords = keywords.filter(
      (kw) =>
        (kw.totalSpend > 50 && kw.totalOrders === 0) ||
        (kw.totalSales > 0 && kw.totalSpend / kw.totalSales > 0.50),
    ); // ACoS > 50% or no sales
    const noImpressions = keywords.filter(
      (kw) => kw.totalImpressions < 10 && kw.count >= 3,
    );

    return {
      campaignId,
      campaignName: campaign.name,
      totalKeywords: keywords.length,
      categories: {
        gold: {
          label: "🥇 Altın Kelimeler (ACoS < 15%)",
          count: goldKeywords.length,
          action: "Bid'i artır, bütçeyi buraya yönlendir",
          keywords: goldKeywords.slice(0, 10).map(formatKeyword),
        },
        silver: {
          label: "🥈 Gümüş (ACoS 15-30%)",
          count: silverKeywords.length,
          action: "Bid'i koru, performansı izle",
          keywords: silverKeywords.slice(0, 10).map(formatKeyword),
        },
        waste: {
          label: "🗑️ Israf (ACoS > 50% veya satış yok)",
          count: wasteKeywords.length,
          action: "Bid'i düşür veya negatif kelimeye çevir",
          keywords: wasteKeywords.slice(0, 10).map(formatKeyword),
        },
        dead: {
          label: "💀 Ölü (gösterim almıyor)",
          count: noImpressions.length,
          action: "Kaldır ve yeni kelimelerle değiştir",
          keywords: noImpressions.slice(0, 5).map(formatKeyword),
        },
      },
      potentialSavings: round(
        wasteKeywords.reduce((s, kw) => s + kw.totalSpend * 0.6, 0),
      ),
      recommendation:
        wasteKeywords.length > keywords.length * 0.3
          ? "🚨 Reklam bütçesinin %30'undan fazlası israf ediliyor! Acil optimizasyon gerekli."
          : wasteKeywords.length > 0
            ? `⚠️ ₺${round(wasteKeywords.reduce((s, kw) => s + kw.totalSpend * 0.6, 0))} tasarruf potansiyeli var.`
            : "✅ Tüm kelimeler iyi performans gösteriyor.",
      source: "api" as const,
    };
  }

  /**
   * Which products should be advertised?
   */
  async getAdCandidates(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
    });

    const candidates: Array<{
      productId: string;
      title: string;
      reason: string;
      priority: string;
      estimatedRoas: number;
    }> = [];

    for (const product of products) {
      const salePrice = Number((product as any).salePrice || 0);
      const costPrice = Number(product.costPrice || salePrice * 0.4);
      const commissionRate = Number(product.commissionRate || 15) / 100;
      const margin = salePrice - costPrice - salePrice * commissionRate - 12.5;

      // High margin products are good ad candidates
      const marginPercent = salePrice > 0 ? (margin / salePrice) * 100 : 0;

      if (marginPercent > 25) {
        candidates.push({
          productId: product.id,
          title: product.title,
          reason: `Yüksek marj (%${round(marginPercent)}) — reklam kârlı olur`,
          priority: "high",
          estimatedRoas: round(salePrice / (salePrice * 0.05)), // ~5% of sale price as ad spend
        });
      } else if (marginPercent > 15) {
        candidates.push({
          productId: product.id,
          title: product.title,
          reason: `Orta marj (%${round(marginPercent)}) — dikkatli bid yönetimi ile kârlı`,
          priority: "medium",
          estimatedRoas: round(salePrice / (salePrice * 0.03)),
        });
      }
    }

    candidates.sort((a, b) => b.estimatedRoas - a.estimatedRoas);

    return {
      totalProducts: products.length,
      adCandidates: candidates.length,
      highPriority: candidates.filter((c) => c.priority === "high").length,
      products: candidates.slice(0, 20),
      source: "estimate" as const,
    };
  }

  /**
   * Auto-optimize: scheduled task to check campaigns
   */
  @Cron(CronExpression.EVERY_4_HOURS)
  async autoOptimizeCampaigns() {
    this.logger.log("Running ad autopilot optimization cycle...");
    // In production, iterate tenants and generate alerts
  }

  // ─── Private Helpers ─────────────────────

  private analyzeCampaign(campaign: any) {
    const metrics = campaign.dailyMetrics || [];
    const totalSpend = metrics.reduce(
      (s: number, m: any) => s + Number(m.spend),
      0,
    );
    const totalSales = metrics.reduce(
      (s: number, m: any) => s + Number(m.sales),
      0,
    );
    const totalClicks = metrics.reduce(
      (s: number, m: any) => s + m.clicks,
      0,
    );
    const totalImpressions = metrics.reduce(
      (s: number, m: any) => s + m.impressions,
      0,
    );
    const totalOrders = metrics.reduce(
      (s: number, m: any) => s + m.orders,
      0,
    );

    const acos = totalSales > 0 ? (totalSpend / totalSales) * 100 : null;
    const roas = totalSpend > 0 ? totalSales / totalSpend : null;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;

    // Health score calculation
    let healthScore = 50; // base
    if (acos !== null) {
      if (acos < 10) healthScore += 30;
      else if (acos < 20) healthScore += 20;
      else if (acos < 30) healthScore += 10;
      else if (acos > 50) healthScore -= 20;
    }
    if (ctr !== null) {
      if (ctr > 2) healthScore += 10;
      else if (ctr > 1) healthScore += 5;
      else healthScore -= 5;
    }
    if (totalOrders > 0) healthScore += 10;

    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      budgetDaily: Number(campaign.budgetDaily || 0),
      healthScore,
      grade: healthScore >= 80 ? "A" : healthScore >= 60 ? "B" : healthScore >= 40 ? "C" : "D",
      metrics: {
        spend: round(totalSpend),
        sales: round(totalSales),
        orders: totalOrders,
        acos: acos !== null ? round(acos) : null,
        roas: roas !== null ? round(roas) : null,
        ctr: ctr !== null ? round(ctr) : null,
      },
      issues: this.getCampaignIssues(acos, ctr, totalOrders, totalSpend),
    };
  }

  private getCampaignIssues(
    acos: number | null,
    ctr: number | null,
    orders: number,
    spend: number,
  ): string[] {
    const issues: string[] = [];
    if (acos !== null && acos > 35) issues.push("ACoS çok yüksek — bid'leri düşür");
    if (acos !== null && acos > 50) issues.push("🚨 ACoS %50 üstünde — acil müdahale gerekli");
    if (ctr !== null && ctr < 0.5) issues.push("CTR çok düşük — reklam metni/görseli güncelle");
    if (spend > 100 && orders === 0) issues.push("Harcama var ama satış yok — durdur veya optimize et");
    return issues;
  }

  private calculateBudgetRedistribution(
    analyses: Array<{ campaignId: string; campaignName: string; healthScore: number; budgetDaily: number }>,
    totalBudget: number,
  ) {
    if (analyses.length === 0 || totalBudget === 0) return [];

    const totalScore = analyses.reduce((s, c) => s + c.healthScore, 0);
    return analyses.map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      currentBudget: round(c.budgetDaily),
      suggestedBudget: round((c.healthScore / Math.max(totalScore, 1)) * totalBudget),
      change: round(
        ((c.healthScore / Math.max(totalScore, 1)) * totalBudget) - c.budgetDaily,
      ),
    }));
  }

  private getUrgentActions(analyses: any[]): string[] {
    const actions: string[] = [];
    for (const a of analyses) {
      for (const issue of a.issues) {
        if (issue.startsWith("🚨")) {
          actions.push(`${a.campaignName}: ${issue}`);
        }
      }
    }
    return actions;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatKeyword(kw: any) {
  return {
    keyword: kw.keyword,
    spend: round(kw.totalSpend),
    sales: round(kw.totalSales),
    orders: kw.totalOrders,
    acos: kw.totalSales > 0 ? round((kw.totalSpend / kw.totalSales) * 100) : null,
    ctr: kw.totalImpressions > 0
      ? round((kw.totalClicks / kw.totalImpressions) * 100)
      : null,
  };
}

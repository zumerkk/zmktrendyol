import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * SubscriptionService — White-Label SaaS Abonelik Yönetimi
 *
 * ZMK bu aracı başka ajanslara da satabilir:
 * - Starter: ₺499/ay
 * - Pro: ₺1.499/ay
 * - Enterprise: ₺4.999/ay
 *
 * Potansiyel: 100 ajans × ₺1.500 = ₺150.000/ay
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  readonly plans = [
    {
      id: "starter",
      name: "Başlangıç",
      monthlyPrice: 499,
      features: [
        "1 Mağaza",
        "5 Rakip Takibi",
        "Temel KPI Paneli",
        "100 AI Üretim/ay",
        "E-posta Destek",
      ],
      limits: {
        stores: 1,
        competitors: 5,
        aiCalls: 100,
        adsTracking: false,
        abTesting: false,
      },
    },
    {
      id: "pro",
      name: "Profesyonel",
      monthlyPrice: 1499,
      features: [
        "3 Mağaza",
        "25 Rakip Takibi",
        "Gelişmiş KPI + P&L",
        "500 AI Üretim/ay",
        "Buybox Monitör",
        "Dinamik Fiyatlama",
        "A/B Test",
        "Telegram Bot",
        "Öncelikli Destek",
      ],
      limits: {
        stores: 3,
        competitors: 25,
        aiCalls: 500,
        adsTracking: true,
        abTesting: true,
      },
    },
    {
      id: "enterprise",
      name: "Kurumsal",
      monthlyPrice: 4999,
      features: [
        "Sınırsız Mağaza",
        "Sınırsız Rakip",
        "Tüm Özellikler",
        "Sınırsız AI",
        "ML Tahmin",
        "Multi-Marketplace",
        "Oyun Teorisi Fiyatlama",
        "War Room",
        "Özel API",
        "Dedicated Account Manager",
        "White-Label Seçeneği",
      ],
      limits: {
        stores: -1,
        competitors: -1,
        aiCalls: -1,
        adsTracking: true,
        abTesting: true,
      },
    },
  ];

  constructor(private prisma: PrismaService) {}

  /**
   * Get available plans
   */
  getPlans() {
    return this.plans;
  }

  /**
   * Create or update subscription
   */
  async subscribe(tenantId: string, planId: string) {
    const plan = this.plans.find((p) => p.id === planId);
    if (!plan) throw new Error(`Geçersiz plan: ${planId}`);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.upsert({
      where: { id: `sub-${tenantId}` },
      create: {
        id: `sub-${tenantId}`,
        tenantId,
        plan: planId,
        monthlyPrice: plan.monthlyPrice,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      update: {
        plan: planId,
        monthlyPrice: plan.monthlyPrice,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
      },
    });
  }

  /**
   * Get current subscription
   */
  async getSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
    });

    if (!sub) {
      return {
        plan: "starter",
        status: "trial",
        limits: this.plans[0].limits,
        trialDaysLeft: 14,
      };
    }

    const plan = this.plans.find((p) => p.id === sub.plan);

    return {
      ...sub,
      planDetails: plan,
      limits: plan?.limits,
      daysRemaining: Math.ceil(
        (sub.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    };
  }

  /**
   * Check if tenant has feature access
   */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const sub = await this.getSubscription(tenantId);
    const limits = sub.limits as any;

    switch (feature) {
      case "ads_tracking":
        return limits?.adsTracking === true;
      case "ab_testing":
        return limits?.abTesting === true;
      case "unlimited_ai":
        return limits?.aiCalls === -1;
      case "war_room":
        return sub.plan === "enterprise";
      case "ml_prediction":
        return sub.plan === "enterprise";
      case "multi_marketplace":
        return sub.plan === "enterprise";
      case "game_theory":
        return sub.plan === "enterprise";
      default:
        return true;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(tenantId: string) {
    return this.prisma.subscription.updateMany({
      where: { tenantId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Get usage stats for rate limiting
   */
  async getUsageStats(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [aiCalls, competitors, stores] = await Promise.all([
      this.prisma.aiRun.count({
        where: { tenantId, createdAt: { gte: monthStart } },
      }),
      this.prisma.competitorProduct.count({ where: { tenantId } }),
      this.prisma.sellerConnection.count({ where: { tenantId } }),
    ]);

    const sub = await this.getSubscription(tenantId);
    const limits = sub.limits as any;

    return {
      aiCalls: {
        used: aiCalls,
        limit: limits?.aiCalls || 100,
        remaining:
          limits?.aiCalls === -1
            ? "unlimited"
            : Math.max(0, (limits?.aiCalls || 100) - aiCalls),
      },
      competitors: {
        used: competitors,
        limit: limits?.competitors || 5,
        remaining:
          limits?.competitors === -1
            ? "unlimited"
            : Math.max(0, (limits?.competitors || 5) - competitors),
      },
      stores: {
        used: stores,
        limit: limits?.stores || 1,
        remaining:
          limits?.stores === -1
            ? "unlimited"
            : Math.max(0, (limits?.stores || 1) - stores),
      },
    };
  }
}

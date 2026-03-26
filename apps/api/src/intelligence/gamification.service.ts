import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * GamificationService — Mağaza Gamification Sistemi
 *
 * Satıcıyı motive eden ve bağımlılık yaratan oyunlaştırma:
 * - Günlük görevler (achievements)
 * - Seviye sistemi (Bronze → Silver → Gold → Platinum → Diamond)
 * - XP puanlama
 * - Streak (ardışık günler)
 * - Başarı rozetleri
 */
@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  private readonly levels = [
    { name: "Bronze", minXp: 0, icon: "🥉", perks: ["Temel analizler"] },
    { name: "Silver", minXp: 500, icon: "🥈", perks: ["Haftalık rapor", "Trend radar"] },
    { name: "Gold", minXp: 2000, icon: "🥇", perks: ["AI asistan", "Fiyat zekâsı"] },
    { name: "Platinum", minXp: 5000, icon: "💎", perks: ["Tüm özellikler", "Öncelikli destek"] },
    { name: "Diamond", minXp: 15000, icon: "👑", perks: ["VIP erişim", "Kişisel danışman"] },
  ];

  private readonly badges = [
    { id: "first_sale", name: "İlk Satış!", icon: "🎉", xp: 50, desc: "İlk siparişini al" },
    { id: "speed_seller", name: "Hız Satıcısı", icon: "⚡", xp: 100, desc: "Bir günde 10+ sipariş" },
    { id: "listing_master", name: "Listing Ustası", icon: "✍️", xp: 75, desc: "Tüm listingler A+ skoru" },
    { id: "ad_genius", name: "Reklam Dehası", icon: "📢", xp: 100, desc: "ACoS %15'in altına düşür" },
    { id: "diversifier", name: "Çeşitlikçi", icon: "🌈", xp: 150, desc: "50+ farklı ürün listele" },
    { id: "weekly_streak_3", name: "3 Hafta Canavarı", icon: "🔥", xp: 200, desc: "3 hafta üst üste hedef tut" },
    { id: "profit_king", name: "Kâr Kralı", icon: "💰", xp: 150, desc: "Aylık %25+ kâr marjı" },
    { id: "review_champ", name: "Yorum Şampiyonu", icon: "⭐", xp: 100, desc: "4.5+ ortalama puan" },
    { id: "multi_platform", name: "Platform Avcısı", icon: "🌍", xp: 250, desc: "2+ pazaryerine bağlan" },
    { id: "data_driven", name: "Veri Odaklı", icon: "📊", xp: 75, desc: "30 gün boyunca dashboard'u kullan" },
  ];

  constructor(private prisma: PrismaService) {}

  /**
   * Get gamification dashboard for a tenant
   */
  async getDashboard(tenantId: string) {
    // Calculate XP from activity
    const xp = await this.calculateXp(tenantId);
    const currentLevel = this.getLevel(xp);
    const nextLevel = this.levels.find((l) => l.minXp > xp);
    const earnedBadges = await this.checkBadges(tenantId);

    // Daily challenges
    const dailyChallenges = await this.getDailyChallenges(tenantId);

    return {
      xp,
      level: currentLevel,
      nextLevel: nextLevel
        ? { ...nextLevel, xpNeeded: nextLevel.minXp - xp }
        : null,
      progressPercent: nextLevel
        ? Math.round(
            ((xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100,
          )
        : 100,
      badges: {
        earned: earnedBadges,
        total: this.badges.length,
        list: this.badges.map((b) => ({
          ...b,
          earned: earnedBadges.includes(b.id),
        })),
      },
      dailyChallenges,
      leaderboardPosition: null, // Future: compare against other sellers
      source: "estimate" as const,
    };
  }

  /**
   * Get daily challenges
   */
  async getDailyChallenges(tenantId: string) {
    const today = new Date();
    const dayOfWeek = today.getDay();

    const challenges = [
      {
        id: "check_listing",
        title: "1 ürünün listing skorunu kontrol et",
        xp: 10,
        completed: false,
        type: "daily",
      },
      {
        id: "review_analytics",
        title: "Dashboard'u incele ve 1 aksiyon al",
        xp: 15,
        completed: false,
        type: "daily",
      },
      {
        id: "optimize_price",
        title: "1 ürünün fiyatını analiz et",
        xp: 20,
        completed: false,
        type: "daily",
      },
    ];

    // Add day-specific challenge
    if (dayOfWeek === 1) {
      challenges.push({
        id: "weekly_review",
        title: "Haftalık performans raporunu oku",
        xp: 30,
        completed: false,
        type: "weekly",
      });
    }

    return challenges;
  }

  // ─── Private ─────────────────────

  private async calculateXp(tenantId: string): Promise<number> {
    let xp = 0;

    // XP from orders
    const orderCount = await this.prisma.order.count({ where: { tenantId } });
    xp += orderCount * 2;

    // XP from products
    const productCount = await this.prisma.product.count({
      where: { tenantId, status: "active" },
    });
    xp += productCount * 5;

    // XP from ad campaigns
    const adCount = await this.prisma.adCampaign.count({ where: { tenantId } });
    xp += adCount * 25;

    // XP from competitor tracking
    const competitorCount = await this.prisma.competitorProduct.count({
      where: { tenantId },
    });
    xp += competitorCount * 3;

    return xp;
  }

  private getLevel(xp: number) {
    let current = this.levels[0];
    for (const level of this.levels) {
      if (xp >= level.minXp) current = level;
    }
    return current;
  }

  private async checkBadges(tenantId: string): Promise<string[]> {
    const earned: string[] = [];

    const orderCount = await this.prisma.order.count({ where: { tenantId } });
    if (orderCount > 0) earned.push("first_sale");

    const productCount = await this.prisma.product.count({
      where: { tenantId, status: "active" },
    });
    if (productCount >= 50) earned.push("diversifier");

    const adCount = await this.prisma.adCampaign.count({ where: { tenantId } });
    if (adCount > 0) earned.push("data_driven");

    return earned;
  }
}

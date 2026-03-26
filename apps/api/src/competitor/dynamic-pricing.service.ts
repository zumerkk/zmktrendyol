import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { TrendyolService } from "../trendyol/trendyol.service";

/**
 * DynamicPricingService — Otomatik Fiyatlama Motoru
 *
 * Rakip fiyat değişikliklerine göre otomatik fiyat ayarlama.
 * Her kural için min/max sınırı zorunlu — sınır dışı fiyat ASLA uygulanmaz.
 * autoApply = false ise fiyat önerisi oluşturur, onay bekler.
 *
 * ⚠️ DİKKAT: Yanlış kural tanımı gelir kaybına yol açabilir!
 */
@Injectable()
export class DynamicPricingService {
  private readonly logger = new Logger(DynamicPricingService.name);

  constructor(
    private prisma: PrismaService,
    private trendyolService: TrendyolService,
  ) {}

  /**
   * Create a pricing rule
   */
  async createRule(
    tenantId: string,
    dto: {
      productId: string;
      strategy: "undercut" | "match" | "margin_target";
      minPrice: number;
      maxPrice: number;
      targetMargin?: number;
      undercutAmount?: number;
      autoApply?: boolean;
    },
  ) {
    if (dto.minPrice >= dto.maxPrice) {
      throw new Error("Min fiyat, max fiyattan küçük olmalıdır.");
    }

    if (dto.minPrice <= 0) {
      throw new Error("Min fiyat 0'dan büyük olmalıdır.");
    }

    return this.prisma.pricingRule.create({
      data: {
        tenantId,
        productId: dto.productId,
        strategy: dto.strategy,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        targetMargin: dto.targetMargin,
        undercutAmount: dto.undercutAmount ?? 0.2, // Default: 20 kuruş
        autoApply: dto.autoApply ?? false,
      },
    });
  }

  /**
   * Update a pricing rule
   */
  async updateRule(
    ruleId: string,
    dto: Partial<{
      isActive: boolean;
      strategy: string;
      minPrice: number;
      maxPrice: number;
      targetMargin: number;
      undercutAmount: number;
      autoApply: boolean;
    }>,
  ) {
    return this.prisma.pricingRule.update({
      where: { id: ruleId },
      data: dto,
    });
  }

  /**
   * Get all pricing rules for a tenant
   */
  async getRules(tenantId: string) {
    return this.prisma.pricingRule.findMany({
      where: { tenantId },
      include: {
        product: { select: { id: true, title: true, barcode: true } },
        actions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get pricing action log for a rule
   */
  async getActionLog(ruleId: string, limit = 50) {
    return this.prisma.pricingAction.findMany({
      where: { ruleId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * CRON: Her 15 dakikada fiyatlama kurallarını değerlendir
   */
  @Cron("*/15 * * * *")
  async evaluateAllRules() {
    if (process.env.AUTO_PRICING_ENABLED !== "true") {
      return; // Otomatik fiyatlama devre dışı
    }

    const activeRules = await this.prisma.pricingRule.findMany({
      where: { isActive: true },
      include: {
        product: {
          include: {
            variants: { take: 1 },
          },
        },
      },
    });

    this.logger.log(`Evaluating ${activeRules.length} pricing rules...`);

    for (const rule of activeRules) {
      try {
        await this.evaluateRule(rule);
      } catch (error: any) {
        this.logger.error(
          `Pricing rule evaluation failed (${rule.id}): ${error.message}`,
        );
      }
    }
  }

  /**
   * Evaluate a single pricing rule against current competitor data
   */
  async evaluateRule(rule: any) {
    // Get the latest competitor prices for products matching ours
    const competitorSnapshots = await this.prisma.competitorSnapshot.findMany({
      where: {
        competitorProduct: {
          tenantId: rule.tenantId,
        },
        time: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      },
      orderBy: { time: "desc" },
    });

    if (competitorSnapshots.length === 0) return;

    // Get lowest competitor price
    const lowestCompetitorPrice = Math.min(
      ...competitorSnapshots
        .filter((s) => s.price !== null)
        .map((s) => Number(s.price)),
    );

    // Current product price
    const currentPrice = rule.product?.variants?.[0]
      ? Number(rule.product.variants[0].salePrice)
      : null;

    if (!currentPrice || !lowestCompetitorPrice) return;

    let suggestedPrice: number | null = null;
    let reason = "";

    switch (rule.strategy) {
      case "undercut":
        // Rakibin altına in
        const undercutAmount = Number(rule.undercutAmount) || 0.2;
        suggestedPrice = lowestCompetitorPrice - undercutAmount;
        reason = "competitor_undercut";
        break;

      case "match":
        // Rakiple eşle
        suggestedPrice = lowestCompetitorPrice;
        reason = "price_match";
        break;

      case "margin_target":
        // Hedef marj koru
        const costPrice = rule.product?.costPrice
          ? Number(rule.product.costPrice)
          : null;
        if (costPrice && rule.targetMargin) {
          suggestedPrice = costPrice * (1 + Number(rule.targetMargin) / 100);
          reason = "margin_adjustment";
        }
        break;
    }

    if (suggestedPrice === null) return;

    // ⚠️ ENFORCE MIN/MAX BOUNDS — NEVER go outside!
    const minPrice = Number(rule.minPrice);
    const maxPrice = Number(rule.maxPrice);
    suggestedPrice = Math.max(minPrice, Math.min(maxPrice, suggestedPrice));

    // Round to 2 decimal places
    suggestedPrice = Math.round(suggestedPrice * 100) / 100;

    // Check if price actually needs to change
    if (Math.abs(suggestedPrice - currentPrice) < 0.01) return;

    // Create pricing action
    const action = await this.prisma.pricingAction.create({
      data: {
        ruleId: rule.id,
        oldPrice: currentPrice,
        newPrice: suggestedPrice,
        reason,
        status: rule.autoApply ? "pending" : "pending",
      },
    });

    // Auto-apply if enabled
    if (rule.autoApply) {
      await this.applyPriceChange(rule.tenantId, action.id);
    } else {
      this.logger.log(
        `💰 Fiyat önerisi: ${rule.product?.title} — ${currentPrice} TL → ${suggestedPrice} TL (onay bekliyor)`,
      );
    }

    return action;
  }

  /**
   * Apply a pending price change via Trendyol API
   */
  async applyPriceChange(tenantId: string, actionId: string) {
    const action = await this.prisma.pricingAction.findUnique({
      where: { id: actionId },
      include: {
        rule: {
          include: {
            product: {
              include: { variants: { take: 1 } },
            },
          },
        },
      },
    });

    if (!action || action.status !== "pending") {
      throw new Error("Action not found or not in pending status");
    }

    try {
      const { client, sellerId } =
        await this.trendyolService.getClient(tenantId);
      const barcode =
        action.rule.product.variants?.[0]?.barcode ||
        action.rule.product.barcode;

      if (!barcode) throw new Error("Product barcode not found");

      // Update price via Trendyol API
      await client.put(
        `/integration/sellers/${sellerId}/products/price-and-inventory`,
        {
          items: [
            {
              barcode,
              salePrice: Number(action.newPrice),
              listPrice: Number(action.newPrice) * 1.1, // listPrice %10 üstü
            },
          ],
        },
      );

      await this.prisma.pricingAction.update({
        where: { id: actionId },
        data: { status: "applied", appliedAt: new Date() },
      });

      this.logger.log(
        `✅ Price applied: ${action.rule.product.title} — ${action.oldPrice} TL → ${action.newPrice} TL`,
      );
    } catch (error: any) {
      await this.prisma.pricingAction.update({
        where: { id: actionId },
        data: { status: "failed" },
      });

      this.logger.error(`❌ Price change failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reject a pending price change
   */
  async rejectPriceChange(actionId: string) {
    return this.prisma.pricingAction.update({
      where: { id: actionId },
      data: { status: "rejected" },
    });
  }

  /**
   * Get pending price changes for a tenant
   */
  async getPendingActions(tenantId: string) {
    return this.prisma.pricingAction.findMany({
      where: {
        status: "pending",
        rule: { tenantId },
      },
      include: {
        rule: {
          include: {
            product: { select: { id: true, title: true, barcode: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Delete a pricing rule (and all its actions)
   */
  async deleteRule(ruleId: string) {
    await this.prisma.pricingAction.deleteMany({
      where: { ruleId },
    });
    return this.prisma.pricingRule.delete({
      where: { id: ruleId },
    });
  }
}

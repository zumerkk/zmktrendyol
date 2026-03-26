import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * AutomationEngineV2 — İleri Otomasyon Kural Motoru
 *
 * IF-THEN kuralları ile otomatik aksiyonlar:
 * - Stok X'in altına düştüğünde → bildirim gönder
 * - Rakip fiyat düşürdüğünde → uyarı + fiyat önerisi
 * - ACoS hedifi aşıldığında → kampanyayı durdur
 * - Yorum ortalaması düştüğünde → aksiyon planı oluştur
 * - Satış hedefi tutmadığında → reklam bütçesi artır
 */
@Injectable()
export class AutomationEngineV2Service {
  private readonly logger = new Logger(AutomationEngineV2Service.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all automation rules for a tenant
   */
  async getRules(tenantId: string) {
    return this.prisma.automationRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create a new automation rule
   */
  async createRule(
    tenantId: string,
    dto: {
      name: string;
      trigger: string;
      condition: Record<string, any>;
      action: string;
      actionParams?: Record<string, any>;
      enabled?: boolean;
    },
  ) {
    return this.prisma.automationRule.create({
      data: {
        tenantId,
        name: dto.name,
        triggerType: dto.trigger,
        conditions: dto.condition,
        actionType: dto.action,
        actionData: dto.actionParams || {},
        isActive: dto.enabled ?? true,
      },
    });
  }

  /**
   * Toggle rule on/off
   */
  async toggleRule(ruleId: string, enabled: boolean) {
    return this.prisma.automationRule.update({
      where: { id: ruleId },
      data: { isActive: enabled },
    });
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string) {
    return this.prisma.automationRule.delete({
      where: { id: ruleId },
    });
  }

  /**
   * Get rule templates — ready-made automation scenarios
   */
  getRuleTemplates() {
    return [
      {
        id: "low_stock_alert",
        name: "Düşük Stok Uyarısı",
        description: "Stok belirlenen seviyenin altına düştüğünde bildirim gönder",
        trigger: "stock_change",
        condition: { field: "quantity", operator: "lte", value: 5 },
        action: "send_notification",
        actionParams: { channel: "telegram", urgency: "high" },
        category: "stock",
      },
      {
        id: "competitor_price_drop",
        name: "Rakip Fiyat Düşüşü",
        description: "Rakip fiyatı %10'dan fazla düşürdüğünde uyar",
        trigger: "competitor_price_change",
        condition: { field: "priceChangePercent", operator: "lte", value: -10 },
        action: "send_notification",
        actionParams: { channel: "telegram", includeSuggestion: true },
        category: "competitor",
      },
      {
        id: "acos_exceeded",
        name: "ACoS Hedef Aşımı",
        description: "ACoS belirlenen hedefin üstüne çıktığında kampanyayı durdur",
        trigger: "acos_change",
        condition: { field: "acos", operator: "gte", value: 30 },
        action: "pause_campaign",
        actionParams: { sendAlert: true },
        category: "ads",
      },
      {
        id: "daily_sales_target",
        name: "Günlük Satış Hedefi",
        description: "Günlük satış hedefine ulaşıldığında veya ulaşılamadığında bildir",
        trigger: "daily_sales_check",
        condition: { field: "orderCount", operator: "lt", value: 10 },
        action: "send_notification",
        actionParams: { channel: "telegram", message: "Günlük hedef tutmuyor!" },
        category: "sales",
      },
      {
        id: "review_rating_drop",
        name: "Yorum Ortalaması Düşüşü",
        description: "Ürün puanı 4'ün altına düştüğünde uyar",
        trigger: "review_rating_change",
        condition: { field: "avgRating", operator: "lt", value: 4.0 },
        action: "send_notification",
        actionParams: { channel: "email", priority: "medium" },
        category: "reviews",
      },
      {
        id: "auto_reprice",
        name: "Otomatik Fiyat Güncelleme",
        description: "Rakip fiyat değiştirdiğinde otomatik fiyat ayarla",
        trigger: "competitor_price_change",
        condition: { field: "priceDifference", operator: "gte", value: 5 },
        action: "adjust_price",
        actionParams: { strategy: "match_lowest_plus_1", maxDiscount: 15 },
        category: "pricing",
      },
      {
        id: "stock_reorder",
        name: "Otomatik Stok Yenileme Hatırlatıcı",
        description: "Stok tükenme tahminine göre sipariş zamanı hatırlat",
        trigger: "stock_forecast",
        condition: { field: "daysOfStockLeft", operator: "lte", value: 14 },
        action: "send_notification",
        actionParams: { channel: "email", includeOrderSuggestion: true },
        category: "stock",
      },
      {
        id: "profit_margin_alert",
        name: "Kâr Marjı Alarmı",
        description: "Ürün kâr marjı minimum seviyenin altına düştüğünde uyar",
        trigger: "margin_check",
        condition: { field: "marginPercent", operator: "lt", value: 10 },
        action: "send_notification",
        actionParams: { channel: "telegram", urgency: "high" },
        category: "finance",
      },
    ];
  }

  /**
   * Execute all active rules for a tenant
   */
  async executeRules(tenantId: string) {
    const rules = await this.prisma.automationRule.findMany({
      where: { tenantId, isActive: true },
    });

    const results: Array<{
      ruleId: string;
      ruleName: string;
      triggered: boolean;
      action?: string;
    }> = [];

    for (const rule of rules) {
      try {
        const triggered = await this.evaluateRule(tenantId, rule);
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          triggered,
          action: triggered ? rule.actionType : undefined,
        });

        if (triggered) {
          // Log execution
          await (this.prisma as any).automationLog?.create({
            data: {
              ruleId: rule.id,
              tenantId,
              triggered: true,
              action: rule.actionType,
              details: { trigger: rule.triggerType, condition: rule.conditions },
            },
          });
        }
      } catch (error: any) {
        this.logger.error(
          `Rule ${rule.name} execution failed: ${error.message}`,
        );
      }
    }

    return {
      totalRules: rules.length,
      triggered: results.filter((r) => r.triggered).length,
      results,
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * Get automation execution history
   */
  async getExecutionHistory(tenantId: string, limit = 50) {
    return (this.prisma as any).automationLog?.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { rule: { select: { name: true, triggerType: true } } },
    }) || [];
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runAutomationCycle() {
    this.logger.log("Running automation engine cycle...");
    // In production: iterate all tenants and execute rules
  }

  // ─── Private ─────────────────────

  private async evaluateRule(tenantId: string, rule: any): Promise<boolean> {
    const condition = (rule.conditions || {}) as any;
    if (!condition?.field || !condition?.operator || condition?.value === undefined) {
      return false;
    }

    // Simplified evaluation — in production this would check actual data
    switch (rule.triggerType) {
      case "stock_change": {
        const lowStock = await this.prisma.product.count({
          where: {
            tenantId,
            status: "active",
          },
        });
        return lowStock > 0; // simplified — would check inventory history in production
      }
      case "daily_sales_check": {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const orderCount = await this.prisma.order.count({
          where: { tenantId, orderDate: { gte: today } },
        });
        return this.compare(orderCount, condition.operator, condition.value);
      }
      default:
        return false;
    }
  }

  private compare(value: number, operator: string, target: number): boolean {
    switch (operator) {
      case "lt": return value < target;
      case "lte": return value <= target;
      case "gt": return value > target;
      case "gte": return value >= target;
      case "eq": return value === target;
      default: return false;
    }
  }
}

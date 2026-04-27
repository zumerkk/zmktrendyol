import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { ShadowAlertDispatcher } from './shadow-alert-dispatcher.service';

export type AgentType = 'stock_sentinel' | 'price_hawk' | 'sales_analyst' | 'trend_scout' | 'oos_sniper';

export interface AgentStatus {
  type: AgentType;
  name: string;
  emoji: string;
  description: string;
  enabled: boolean;
  isRunning: boolean;
  lastRunAt: Date | null;
  totalRuns: number;
  totalFindings: number;
}

/**
 * ShadowAgentFleet — 5 Uzman Ajan Filosu 🤖
 *
 * GÖZLEMLE → DÜŞÜN → KARAR AL → BİLDİR → KAYDET
 */
@Injectable()
export class ShadowAgentFleet {
  private readonly logger = new Logger(ShadowAgentFleet.name);

  private agentStates: Record<AgentType, {
    enabled: boolean;
    isRunning: boolean;
    lastRunAt: Date | null;
    totalRuns: number;
    totalFindings: number;
  }> = {
    stock_sentinel: { enabled: true, isRunning: false, lastRunAt: null, totalRuns: 0, totalFindings: 0 },
    price_hawk: { enabled: true, isRunning: false, lastRunAt: null, totalRuns: 0, totalFindings: 0 },
    sales_analyst: { enabled: true, isRunning: false, lastRunAt: null, totalRuns: 0, totalFindings: 0 },
    trend_scout: { enabled: true, isRunning: false, lastRunAt: null, totalRuns: 0, totalFindings: 0 },
    oos_sniper: { enabled: true, isRunning: false, lastRunAt: null, totalRuns: 0, totalFindings: 0 },
  };

  private readonly agentMeta: Record<AgentType, { name: string; emoji: string; description: string }> = {
    stock_sentinel: { name: 'Stock Sentinel', emoji: '🛡️', description: 'Stok seviyelerini izler, son ürün alarmı verir' },
    price_hawk: { name: 'Price Hawk', emoji: '🦅', description: 'Fiyat değişimlerini anında yakalar' },
    sales_analyst: { name: 'Sales Analyst', emoji: '📊', description: 'Satış hacmi ve trendleri analiz eder' },
    trend_scout: { name: 'Trend Scout', emoji: '🔭', description: 'Yeni kampanya ve ürün fırsatlarını keşfeder' },
    oos_sniper: { name: 'OOS Sniper', emoji: '🎯', description: 'Rakip stoğu bittiğinde fırsat alarma geçer' },
  };

  constructor(
    private prisma: PrismaService,
    private alertDispatcher: ShadowAlertDispatcher,
  ) {}

  getFleetStatus(): AgentStatus[] {
    return (Object.keys(this.agentStates) as AgentType[]).map((type: AgentType) => ({
      type,
      ...this.agentMeta[type],
      ...this.agentStates[type],
    }));
  }

  toggleAgent(type: AgentType, enabled: boolean) {
    if (!this.agentStates[type]) return { error: 'Unknown agent type' };
    this.agentStates[type].enabled = enabled;
    this.logger.log(`${this.agentMeta[type].emoji} ${this.agentMeta[type].name} ${enabled ? 'ENABLED ✅' : 'DISABLED ⛔'}`);
    return { type, enabled };
  }

  @Cron('*/15 * * * *')
  async runPriceHawk() {
    if (!this.agentStates.price_hawk.enabled || this.agentStates.price_hawk.isRunning) return;
    await this.executeAgent('price_hawk');
  }

  @Cron('*/15 * * * *')
  async runOOSSniper() {
    if (!this.agentStates.oos_sniper.enabled || this.agentStates.oos_sniper.isRunning) return;
    await this.executeAgent('oos_sniper');
  }

  @Cron('0 */6 * * *')
  async runSalesAnalyst() {
    if (!this.agentStates.sales_analyst.enabled || this.agentStates.sales_analyst.isRunning) return;
    await this.executeAgent('sales_analyst');
  }

  @Cron('0 */12 * * *')
  async runTrendScout() {
    if (!this.agentStates.trend_scout.enabled || this.agentStates.trend_scout.isRunning) return;
    await this.executeAgent('trend_scout');
  }

  async runAgent(type: AgentType, tenantId?: string) {
    return this.executeAgent(type, tenantId);
  }

  private async executeAgent(type: AgentType, tenantId?: string) {
    const state = this.agentStates[type];
    state.isRunning = true;
    const startTime = Date.now();
    const meta = this.agentMeta[type];

    this.logger.log(`${meta.emoji} ${meta.name} başlatılıyor...`);

    const task = await (this.prisma as any).shadowAgentTask.create({
      data: {
        tenantId: tenantId || 'system',
        agentType: type,
        status: 'running',
        input: { tenantId, manual: !!tenantId },
        startedAt: new Date(),
      },
    });

    try {
      let result: any;
      const tenants: Array<{ id: string }> = tenantId
        ? [{ id: tenantId }]
        : await this.prisma.tenant.findMany({ select: { id: true } });

      switch (type) {
        case 'price_hawk':
          result = await this.priceHawkLogic(tenants);
          break;
        case 'oos_sniper':
          result = await this.oosSniperLogic(tenants);
          break;
        case 'sales_analyst':
          result = await this.salesAnalystLogic(tenants);
          break;
        case 'trend_scout':
          result = await this.trendScoutLogic(tenants);
          break;
        default:
          result = { message: 'Agent type handled by separate service', findings: 0 };
      }

      state.totalRuns++;
      state.totalFindings += result.findings || 0;
      state.lastRunAt = new Date();

      await (this.prisma as any).shadowAgentTask.update({
        where: { id: task.id },
        data: { status: 'completed', output: result, completedAt: new Date() },
      });

      const duration = Date.now() - startTime;
      this.logger.log(`${meta.emoji} ${meta.name} tamamlandı: ${duration}ms, ${result.findings || 0} bulgu`);
      return result;
    } catch (error: any) {
      state.lastRunAt = new Date();
      await (this.prisma as any).shadowAgentTask.update({
        where: { id: task.id },
        data: { status: 'failed', error: error.message, completedAt: new Date() },
      });
      this.logger.error(`${meta.emoji} ${meta.name} HATA: ${error.message}`);
      throw error;
    } finally {
      state.isRunning = false;
    }
  }

  /** 🦅 Price Hawk — Fiyat değişim avcısı */
  private async priceHawkLogic(tenants: Array<{ id: string }>) {
    let findings = 0;
    const fifteenMin = 15 * 60 * 1000;

    for (const tenant of tenants) {
      const targets: any[] = await (this.prisma as any).shadowTarget.findMany({
        where: { tenantId: tenant.id, isActive: true, priceAlertEnabled: true },
        select: { id: true, tenantId: true, productName: true, trendyolUrl: true, currentPrice: true },
      });

      for (const target of targets) {
        const snapshots: any[] = await (this.prisma as any).shadowSnapshot.findMany({
          where: { targetId: target.id, fetchedAt: { gte: new Date(Date.now() - fifteenMin * 2) } },
          orderBy: { fetchedAt: 'desc' },
          take: 2,
          select: { price: true, fetchedAt: true },
        });

        if (snapshots.length < 2 || !snapshots[0].price || !snapshots[1].price) continue;

        const newPrice = Number(snapshots[0].price);
        const oldPrice = Number(snapshots[1].price);
        const change = newPrice - oldPrice;
        const changePercent = (change / oldPrice) * 100;

        if (Math.abs(changePercent) >= 3) {
          const isDropped = change < 0;
          await this.alertDispatcher.dispatch(tenant.id, {
            targetId: target.id,
            type: isDropped ? 'price_drop' : 'price_increase',
            severity: Math.abs(changePercent) >= 10 ? 'critical' : 'warning',
            title: `${isDropped ? '📉' : '📈'} Fiyat ${isDropped ? 'DÜŞTÜ' : 'ARTTI'}: ${target.productName || 'Ürün'}`,
            message: `₺${oldPrice.toFixed(2)} → ₺${newPrice.toFixed(2)} (%${changePercent.toFixed(1)})`,
            payload: { oldPrice, newPrice, changePercent, url: target.trendyolUrl },
          });
          findings++;
        }
      }
    }
    return { findings, agent: 'price_hawk' };
  }

  /** 🎯 OOS Sniper — Rakip stok bitti fırsatçısı */
  private async oosSniperLogic(tenants: Array<{ id: string }>) {
    let findings = 0;

    for (const tenant of tenants) {
      const oosTargets: any[] = await (this.prisma as any).shadowTarget.findMany({
        where: {
          tenantId: tenant.id, isActive: true,
          lastStockSignal: 'out_of_stock', ourProductId: { not: null },
        },
        select: { id: true, tenantId: true, productName: true, trendyolUrl: true, ourProductId: true, currentPrice: true },
      });

      for (const target of oosTargets) {
        const ourProduct = await this.prisma.product.findFirst({
          where: { id: target.ourProductId!, tenantId: tenant.id },
          include: { variants: { select: { quantity: true, salePrice: true } } },
        });

        if (ourProduct) {
          const ourStock = ourProduct.variants.reduce((s: number, v: any) => s + v.quantity, 0);
          if (ourStock > 0) {
            await this.alertDispatcher.dispatch(tenant.id, {
              targetId: target.id, type: 'oos_sniper_opportunity', severity: 'warning',
              title: `🎯 OOS FIRSAT: ${target.productName || 'Rakip Ürün'}`,
              message: `Rakip stoğu bitti! Bizim stok: ${ourStock} adet. Fiyat artırma fırsatı.`,
              payload: { competitorUrl: target.trendyolUrl, ourProductId: target.ourProductId, ourStock, competitorPrice: target.currentPrice },
            });
            findings++;
          }
        }
      }
    }
    return { findings, agent: 'oos_sniper' };
  }

  /** 📊 Sales Analyst — Satış hacim analisti */
  private async salesAnalystLogic(tenants: Array<{ id: string }>) {
    let findings = 0;

    for (const tenant of tenants) {
      const targets: any[] = await (this.prisma as any).shadowTarget.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, tenantId: true, productName: true },
      });

      for (const target of targets) {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const logs: any[] = await (this.prisma as any).shadowStockLog.findMany({
          where: { targetId: target.id, eventType: 'sale', detectedAt: { gte: sixHoursAgo } },
        });

        const sales6h = logs.reduce((s: number, l: any) => s + Math.abs(l.delta || 0), 0);

        if (sales6h >= 10) {
          await this.alertDispatcher.dispatch(tenant.id, {
            targetId: target.id, type: 'high_sales_velocity', severity: 'info',
            title: `📊 YÜKSEK SATIŞ: ${target.productName || 'Ürün'}`,
            message: `Son 6 saatte ${sales6h} adet satış. Günlük tahmin: ~${Math.round(sales6h * 4)} adet.`,
            payload: { sales6h, dailyEstimate: Math.round(sales6h * 4) },
          });
          findings++;
        }
      }
    }
    return { findings, agent: 'sales_analyst' };
  }

  /** 🔭 Trend Scout — Kampanya ve fırsat keşifçi */
  private async trendScoutLogic(tenants: Array<{ id: string }>) {
    let findings = 0;

    for (const tenant of tenants) {
      const targets: any[] = await (this.prisma as any).shadowTarget.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, tenantId: true, productName: true },
      });

      for (const target of targets) {
        const latestSnapshot = await (this.prisma as any).shadowSnapshot.findFirst({
          where: { targetId: target.id },
          orderBy: { fetchedAt: 'desc' },
          select: { hasPromotion: true, promotionText: true, fetchedAt: true },
        });

        if (latestSnapshot?.hasPromotion) {
          await this.alertDispatcher.dispatch(tenant.id, {
            targetId: target.id, type: 'new_promotion', severity: 'info',
            title: `🔭 KAMPANYA TESPİT: ${target.productName || 'Ürün'}`,
            message: `Kampanya: ${latestSnapshot.promotionText || 'Kampanya aktif'}`,
            payload: { promotionText: latestSnapshot.promotionText },
          });
          findings++;
        }
      }
    }
    return { findings, agent: 'trend_scout' };
  }

  async getAgentLog(tenantId: string, limit = 50) {
    return (this.prisma as any).shadowAgentTask.findMany({
      where: { OR: [{ tenantId }, { tenantId: 'system' }] },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

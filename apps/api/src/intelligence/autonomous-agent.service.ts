import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { OrchestratorService } from "../ai/orchestrator.service";

/**
 * AutonomousAgentService — 7/24 Çalışan Otonom Rakip Takip Ajanı
 *
 * Döngü: GÖZLEMLE → DÜŞÜN → KARAR AL → UYGULA → ÖĞREN
 *
 * Her 15 dakikada bir:
 * 1. Rakip fiyat, stok, buybox değişimlerini gözlemler
 * 2. AI ile analiz eder (Groq = ultra hızlı)
 * 3. Ne yapılması gerektiğine karar verir
 * 4. Bildirim gönderir, insight oluşturur
 * 5. Kararları ve sonuçları kaydederek öğrenir
 */
@Injectable()
export class AutonomousAgentService {
  private readonly logger = new Logger(AutonomousAgentService.name);

  private agentEnabled = true;
  private lastRunAt: Date | null = null;
  private totalDecisions = 0;
  private totalActions = 0;
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private ai: OrchestratorService,
  ) {}

  // ─── PUBLIC API ──────────────────────────────

  getStatus() {
    return {
      enabled: this.agentEnabled,
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt?.toISOString() || null,
      stats: {
        totalDecisions: this.totalDecisions,
        totalActions: this.totalActions,
        uptime: this.lastRunAt
          ? `${Math.round((Date.now() - this.lastRunAt.getTime()) / 1000)}s ago`
          : "Never run",
      },
    };
  }

  toggle(enabled: boolean) {
    this.agentEnabled = enabled;
    this.logger.log(`Agent ${enabled ? "ENABLED ✅" : "DISABLED ⛔"}`);
    return { enabled: this.agentEnabled };
  }

  // ─── CRON: Every 15 minutes ──────────────────

  @Cron("*/15 * * * *")
  async scheduledRun() {
    if (!this.agentEnabled) return;
    await this.runAgentLoop();
  }

  /**
   * Manuel tetikleme veya Cron tarafından çağrılır
   */
  async runAgentLoop(tenantId?: string) {
    if (this.isRunning) {
      return { message: "Agent is already running", skipped: true };
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.logger.log("🤖 Agent loop starting...");

    try {
      // Get all active tenants (or specific one)
      const tenants = tenantId
        ? [{ id: tenantId }]
        : await this.prisma.tenant.findMany({ select: { id: true } });

      const allResults: any[] = [];

      for (const tenant of tenants) {
        try {
          const result = await this.runForTenant(tenant.id);
          allResults.push({ tenantId: tenant.id, ...result });
        } catch (error: any) {
          this.logger.error(`Agent failed for tenant ${tenant.id}: ${error.message}`);
          allResults.push({ tenantId: tenant.id, error: error.message });
        }
      }

      this.lastRunAt = new Date();
      const duration = Date.now() - startTime;

      this.logger.log(`🤖 Agent loop completed in ${duration}ms for ${tenants.length} tenant(s)`);

      return {
        success: true,
        duration: `${duration}ms`,
        tenantsProcessed: tenants.length,
        results: allResults,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.isRunning = false;
    }
  }

  // ─── CORE AGENT LOOP ─────────────────────────

  private async runForTenant(tenantId: string) {
    // ── 1. GÖZLEMLE (Observe) ──────────────────
    const observations = await this.observe(tenantId);

    if (observations.totalChanges === 0) {
      return { phase: "observe", message: "No changes detected", actions: [] };
    }

    // ── 2. DÜŞÜN (Think) ───────────────────────
    const analysis = await this.think(tenantId, observations);

    // ── 3. KARAR AL (Decide) ───────────────────
    const decisions = this.decide(analysis);

    // ── 4. UYGULA (Act) ────────────────────────
    const actions = await this.act(tenantId, decisions);

    // ── 5. ÖĞREN (Learn) ───────────────────────
    await this.learn(tenantId, observations, decisions, actions);

    this.totalDecisions += decisions.length;
    this.totalActions += actions.length;

    return {
      observations: observations.summary,
      decisions: decisions.length,
      actions: actions.length,
      details: actions,
    };
  }

  // ─── PHASE 1: OBSERVE ────────────────────────

  private async observe(tenantId: string) {
    const now = new Date();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Rakip fiyat değişimleri (son 15 dk)
    const recentSnapshots = await this.prisma.competitorSnapshot.findMany({
      where: { time: { gte: fifteenMinAgo } },
      include: { competitorProduct: { select: { title: true, tenantId: true } } },
      orderBy: { time: "desc" },
    });

    const competitorPriceChanges = recentSnapshots.filter(
      (s) => s.competitorProduct.tenantId === tenantId && s.price !== null,
    );

    // 2. Buybox durumu
    const buyboxChanges = await this.prisma.buyboxSnapshot.findMany({
      where: { time: { gte: fifteenMinAgo } },
      include: { competitorProduct: { select: { title: true, tenantId: true } } },
      orderBy: { time: "desc" },
    });

    const buyboxLost = buyboxChanges.filter(
      (b) => b.competitorProduct.tenantId === tenantId && !b.isOurBuybox,
    );

    // 3. Stok durumu — düşük stoklu ürünler
    const lowStockProducts = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
      include: {
        variants: { where: { quantity: { lte: 5 } } },
      },
    });

    const lowStock = lowStockProducts.filter((p) =>
      p.variants.some((v) => v.quantity <= 5),
    );

    // 4. Günlük sipariş performansı
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = await this.prisma.order.count({
      where: { tenantId, orderDate: { gte: todayStart } },
    });

    // 5. Rakip stok biten — OOS Sniper fırsatı
    const recentStockProbes = await this.prisma.stockProbeResult.findMany({
      where: {
        time: { gte: fifteenMinAgo },
        isAvailable: false,
      },
      include: {
        probe: {
          include: {
            competitorProduct: { select: { title: true, tenantId: true } },
          },
        },
      },
    });

    const competitorOOS = recentStockProbes.filter(
      (p) => p.probe.competitorProduct.tenantId === tenantId,
    );

    const totalChanges =
      competitorPriceChanges.length +
      buyboxLost.length +
      lowStock.length +
      competitorOOS.length;

    return {
      totalChanges,
      summary: {
        competitorPriceChanges: competitorPriceChanges.length,
        buyboxLost: buyboxLost.length,
        lowStockAlerts: lowStock.length,
        competitorOutOfStock: competitorOOS.length,
        todayOrders,
      },
      data: {
        competitorPriceChanges,
        buyboxLost,
        lowStock,
        competitorOOS,
        todayOrders,
      },
    };
  }

  // ─── PHASE 2: THINK (AI Analysis) ────────────

  private async think(tenantId: string, observations: any) {
    const prompt = `Sen bir e-ticaret otonom ajanısın. Rakip takip, fiyat analizi ve stok izleme yapıyorsun. 
Aşağıdaki gözlemlerini analiz et ve her biri için aciliyet seviyesi (kritik/yüksek/orta/düşük) ve önerilen aksiyon belirle.

GÖZLEMLER:
- Rakip fiyat değişimi: ${observations.summary.competitorPriceChanges} adet
- Buybox kaybı: ${observations.summary.buyboxLost} adet
- Düşük stok uyarısı: ${observations.summary.lowStockAlerts} adet
- Rakip stok bitti (OOS fırsatı): ${observations.summary.competitorOutOfStock} adet
- Bugünkü sipariş sayısı: ${observations.summary.todayOrders}

Her gözlem için JSON formatında yanıt ver:
[
  {
    "type": "observation_type",
    "urgency": "kritik|yüksek|orta|düşük",
    "action": "önerilen aksiyon",
    "reasoning": "kısa gerekçe"
  }
]

Sadece JSON döndür, başka bir şey yazma.`;

    try {
      const result = await this.ai.generate(tenantId, {
        scenario: "competitive_insight",
        input: { observations: observations.summary, prompt },
        provider: "groq", // Ultra hızlı — ms seviyesinde yanıt
      });

      // Try to parse AI response as JSON
      const text = result.variations?.[0] || "";
      try {
        return JSON.parse(text);
      } catch {
        // AI didn't return valid JSON, create structured response manually
        return this.createFallbackAnalysis(observations);
      }
    } catch (error: any) {
      this.logger.warn(`AI think phase failed: ${error.message}`);
      return this.createFallbackAnalysis(observations);
    }
  }

  private createFallbackAnalysis(observations: any): any[] {
    const analysis: any[] = [];

    if (observations.summary.buyboxLost > 0) {
      analysis.push({
        type: "buybox_lost",
        urgency: "kritik",
        action: "Fiyatı gözden geçir ve stratejik indirim uygula",
        reasoning: `${observations.summary.buyboxLost} üründe Buybox kaybedildi`,
      });
    }

    if (observations.summary.competitorPriceChanges > 0) {
      analysis.push({
        type: "competitor_price_change",
        urgency: "yüksek",
        action: "Rakip fiyat hareketlerini analiz et, gerekirse fiyat güncelle",
        reasoning: `${observations.summary.competitorPriceChanges} rakip fiyat değiştirdi`,
      });
    }

    if (observations.summary.lowStockAlerts > 0) {
      analysis.push({
        type: "low_stock",
        urgency: "yüksek",
        action: "Tedarikçiye sipariş ver, stok yenile",
        reasoning: `${observations.summary.lowStockAlerts} üründe stok kritik seviyede`,
      });
    }

    if (observations.summary.competitorOutOfStock > 0) {
      analysis.push({
        type: "competitor_oos",
        urgency: "orta",
        action: "Fiyatı hafif artır — rakip stokta yok, fırsatı değerlendir",
        reasoning: `${observations.summary.competitorOutOfStock} rakip ürünün stoğu bitti — OOS Sniper fırsatı`,
      });
    }

    return analysis;
  }

  // ─── PHASE 3: DECIDE ─────────────────────────

  private decide(analysis: any[]): any[] {
    if (!Array.isArray(analysis)) return [];

    // Sort by urgency priority
    const urgencyMap: Record<string, number> = {
      kritik: 1, critical: 1,
      yüksek: 2, high: 2,
      orta: 3, medium: 3,
      düşük: 4, low: 4,
    };

    return analysis
      .map((a) => ({
        ...a,
        priority: urgencyMap[a.urgency?.toLowerCase()] || 3,
        decidedAt: new Date().toISOString(),
      }))
      .sort((a, b) => a.priority - b.priority);
  }

  // ─── PHASE 4: ACT ────────────────────────────

  private async act(tenantId: string, decisions: any[]) {
    const actions: any[] = [];

    for (const decision of decisions) {
      try {
        // Create an ActionableInsight for each decision
        const insight = await this.prisma.actionableInsight.create({
          data: {
            tenantId,
            type: decision.type || "agent_observation",
            priority: decision.priority || 3,
            title: `🤖 Ajan: ${this.getDecisionTitle(decision)}`,
            description: decision.reasoning || "Otonom ajan tarafından tespit edildi",
            suggestedAction: decision.action || "İnceleme gerekli",
            metadata: {
              source: "autonomous_agent",
              urgency: decision.urgency,
              decidedAt: decision.decidedAt,
            },
          },
        });

        actions.push({
          insightId: insight.id,
          type: decision.type,
          urgency: decision.urgency,
          action: decision.action,
          status: "insight_created",
        });

        // Create notification for critical/high urgency
        if (decision.priority <= 2) {
          await this.prisma.notification.create({
            data: {
              tenantId,
              type: decision.type || "agent_alert",
              channel: "websocket",
              title: `🤖 Ajan Uyarısı: ${this.getDecisionTitle(decision)}`,
              message: `${decision.reasoning}\n\n💡 Önerilen Aksiyon: ${decision.action}`,
              severity: decision.priority === 1 ? "critical" : "warning",
              data: { source: "autonomous_agent", decision },
            },
          });

          actions[actions.length - 1].notification = "sent";
        }
      } catch (error: any) {
        this.logger.error(`Action failed for decision ${decision.type}: ${error.message}`);
        actions.push({
          type: decision.type,
          status: "failed",
          error: error.message,
        });
      }
    }

    return actions;
  }

  private getDecisionTitle(decision: any): string {
    const titles: Record<string, string> = {
      buybox_lost: "Buybox Kaybedildi!",
      competitor_price_change: "Rakip Fiyat Hareketi",
      low_stock: "Stok Kritik Seviyede",
      competitor_oos: "Rakip Stoğu Bitti — Fırsat!",
      competitor_price_drop: "Rakip Fiyat Düşürdü",
      acos_exceeded: "Reklam Maliyeti Aştı",
    };
    return titles[decision.type] || "Yeni Tespit";
  }

  // ─── PHASE 5: LEARN ──────────────────────────

  private async learn(
    tenantId: string,
    observations: any,
    decisions: any[],
    actions: any[],
  ) {
    // Log the agent run to audit
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: "AGENT_RUN",
          entityType: "autonomous_agent",
          afterValue: {
            observations: observations.summary,
            decisionsCount: decisions.length,
            actionsCount: actions.length,
            actions: actions.map((a) => ({
              type: a.type,
              urgency: a.urgency,
              status: a.status,
            })),
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error: any) {
      this.logger.warn(`Learn phase audit log failed: ${error.message}`);
    }
  }

  // ─── HISTORY ──────────────────────────────────

  async getAgentLog(tenantId: string, limit = 50) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: "AGENT_RUN",
        entityType: "autonomous_agent",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      data: log.afterValue,
    }));
  }

  async getRecentInsights(tenantId: string, limit = 20) {
    return this.prisma.actionableInsight.findMany({
      where: {
        tenantId,
        metadata: { path: ["source"], equals: "autonomous_agent" },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

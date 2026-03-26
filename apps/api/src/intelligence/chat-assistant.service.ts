import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { OrchestratorService } from "../ai/orchestrator.service";

/**
 * ChatAssistantService — Conversational Commerce Assistant
 *
 * ChatGPT benzeri asistan:
 * "Geçen hafta en çok ne sattım?" → Grafik + tablo
 * "Rakip X'in fiyatını düşürmesine karşı ne yapmalıyım?" → Analiz + aksiyon
 * "Bu ürünün başlığını optimize et" → Anında 3 varyasyon
 *
 * Doğal dil ile dashboard yönetimi.
 */
@Injectable()
export class ChatAssistantService {
  private readonly logger = new Logger(ChatAssistantService.name);

  // System prompt that teaches the AI about available data
  private readonly systemPrompt = `Sen ZMK Trendyol platformunun AI asistanısın. Satıcılara yardım ediyorsun.

Yapabileceklerin:
- Satış verileri sorgulama (son 7/30 gün ciro, sipariş, iade)
- Ürün performansı analizi
- Rakibi takip ve karşılaştırma
- Fiyat önerisi
- Başlık ve açıklama optimizasyonu
- Stok uyarıları
- Reklam performansı (ACOS, ROAS)
- Buybox durumu

Kurallar:
- Kısa ve öz yanıt ver
- Sayısal verileri tablo formatında göster
- Her veri için kaynağını belirt (API, estimate, scrape)
- Türkçe yanıt ver
- Samimi ol ama profesyonel kal
- Emin olmadığın verileri TAHMİN olarak belirt`;

  constructor(
    private prisma: PrismaService,
    private orchestrator: OrchestratorService,
  ) {}

  /**
   * Create a new chat session
   */
  async createSession(tenantId: string, userId: string) {
    return this.prisma.chatSession.create({
      data: {
        tenantId,
        userId,
        title: "Yeni Sohbet",
      },
    });
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(tenantId: string, sessionId: string, userMessage: string) {
    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: "user",
        content: userMessage,
      },
    });

    // Get conversation history (last 10 messages)
    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    // Detect intent and gather context data
    const contextData = await this.gatherContext(tenantId, userMessage);

    // Generate AI response
    const result = await this.orchestrator.generate(tenantId, {
      scenario: "chat_assistant",
      input: {
        systemPrompt: this.systemPrompt,
        conversationHistory: history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        userMessage,
        contextData,
      },
    });

    const assistantMessage =
      result.variations?.[0] || "Üzgünüm, şu an yanıt üretemiyorum.";

    // Save assistant message
    const saved = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: assistantMessage,
        data: contextData ? (contextData as any) : undefined,
        tokensUsed: result.metadata?.tokensUsed,
      },
    });

    // Update session title if first message
    if (history.length <= 1) {
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { title: userMessage.substring(0, 50) },
      });
    }

    return {
      message: saved,
      contextData,
    };
  }

  /**
   * Get chat sessions for a user
   */
  async getSessions(tenantId: string, userId: string) {
    return this.prisma.chatSession.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true },
        },
      },
    });
  }

  /**
   * Get messages for a session
   */
  async getMessages(sessionId: string, limit = 50) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  /**
   * Gather relevant context data based on user intent
   */
  private async gatherContext(tenantId: string, message: string): Promise<any> {
    const lowerMsg = message.toLowerCase();
    const context: any = {};

    // Sales data
    if (lowerMsg.match(/sat[ıi][şs]|ciro|sipariş|gelir|revenue/)) {
      const days = lowerMsg.includes("hafta") ? 7 : 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const orders = await this.prisma.order.findMany({
        where: { tenantId, orderDate: { gte: startDate } },
      });

      context.salesData = {
        period: `Son ${days} gün`,
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + Number(o.totalPrice), 0),
        source: "api",
      };
    }

    // Product queries
    if (lowerMsg.match(/ürün|stok|envanter|product/)) {
      const products = await this.prisma.product.findMany({
        where: { tenantId, status: "active" },
        select: { id: true, title: true, costPrice: true, barcode: true },
        take: 10,
      });
      context.products = { items: products, source: "api" };
    }

    // Competitor queries
    if (lowerMsg.match(/rakip|competitor|buybox|fiyat/)) {
      const competitors = await this.prisma.competitorProduct.findMany({
        where: { tenantId },
        take: 5,
        include: {
          snapshots: { orderBy: { time: "desc" }, take: 1 },
        },
      });
      context.competitors = {
        items: competitors.map((c) => ({
          title: c.title,
          latestPrice: c.snapshots[0]?.price
            ? Number(c.snapshots[0].price)
            : null,
          latestRating: c.snapshots[0]?.rating
            ? Number(c.snapshots[0].rating)
            : null,
        })),
        source: "public",
      };
    }

    // Ad performance
    if (lowerMsg.match(/reklam|acos|roas|kampanya|ad/)) {
      const campaigns = await this.prisma.adCampaign.findMany({
        where: { tenantId },
        include: {
          dailyMetrics: { orderBy: { date: "desc" }, take: 7 },
        },
        take: 5,
      });
      context.adData = {
        campaigns: campaigns.map((c) => ({
          name: c.name,
          status: c.status,
          lastWeekSpend: c.dailyMetrics.reduce(
            (sum, m) => sum + Number(m.spend),
            0,
          ),
          lastWeekSales: c.dailyMetrics.reduce(
            (sum, m) => sum + Number(m.sales),
            0,
          ),
        })),
        source: "api",
      };
    }

    return Object.keys(context).length > 0 ? context : null;
  }
}

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { OrchestratorService } from "../ai/orchestrator.service";
import { OosSniperService } from "../god-mode/oos-sniper.service";
import { ZeusAdsService } from "../god-mode/zeus-ads.service";

/**
 * TelegramBotService — Telegram ile Anlık Bildirim & AI Agent
 *
 * Satıcılar dashboard'a 7/24 bakamaz. Telegram AI Ajanı (OpenClaw/Claude):
 * - Buybox kaybı → Kuru mesaj değil, AI yorumlu tetikleyici
 * - Doğal dil istekleri (Intent Parser) -> "God mode aç", "Bütçe kıs"
 *
 * Telegraf.js kullanır.
 */
@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: any = null;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsGateway,
    private orchestrator: OrchestratorService,
    private oosSniper: OosSniperService,
    private zeusAds: ZeusAdsService
  ) {}

  async onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
      return;
    }

    try {
      const { Telegraf } = require("telegraf");
      this.bot = new Telegraf(token);

      this.setupCommands();
      await this.bot.launch();
      this.logger.log("🤖 Telegram bot started successfully");
    } catch (error: any) {
      this.logger.warn(`Telegram bot failed to start: ${error.message}`);
    }
  }

  private setupCommands() {
    if (!this.bot) return;

    // /start — Register chat
    this.bot.start(async (ctx: any) => {
      const chatId = String(ctx.chat.id);
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      ctx.reply(
        `🚀 ZMK Trendyol Bot'a hoş geldin, ${username}!\n\n` +
          `Komutlar:\n` +
          `/bagla <tenant_code> — Mağazanı bağla\n` +
          `/durum — KPI özeti\n` +
          `/buybox — Buybox durumu\n` +
          `/fiyat — Fiyat değişiklikleri\n` +
          `/stok — Stok uyarıları\n` +
          `/yardim — Tüm komutlar\n\n` +
          `Buybox kaybettiğinde sana haber vereceğim! 💪`,
      );
    });

    // /bagla — Link Telegram to tenant
    this.bot.command("bagla", async (ctx: any) => {
      const chatId = String(ctx.chat.id);
      const args = ctx.message.text.split(" ");
      const tenantCode = args[1];

      if (!tenantCode) {
        return ctx.reply(
          "Kullanım: /bagla <tenant_code>\nTenant kodunu dashboard ayarlarından alabilirsin.",
        );
      }

      const tenant = await this.prisma.tenant.findFirst({
        where: { id: tenantCode },
      });

      if (!tenant) {
        return ctx.reply("❌ Tenant bulunamadı. Kodu kontrol et.");
      }

      await this.prisma.telegramChat.upsert({
        where: { chatId },
        create: {
          chatId,
          tenantId: tenant.id,
          username: ctx.from?.username,
          alertTypes: [
            "buybox_lost",
            "stock_drop",
            "price_change",
            "restock_alert",
          ],
        },
        update: {
          tenantId: tenant.id,
          isActive: true,
        },
      });

      ctx.reply(
        `✅ Bağlandı! Mağaza: ${tenant.name}\nTüm uyarılar bu sohbete gelecek.`,
      );
    });

    // /durum — Quick KPI summary
    this.bot.command("durum", async (ctx: any) => {
      const chat = await this.getChatTenant(String(ctx.chat.id));
      if (!chat) return ctx.reply("❌ Önce /bagla komutu ile mağazanı bağla.");

      const summary = await this.getQuickSummary(chat.tenantId);
      ctx.reply(summary, { parse_mode: "HTML" });
    });

    // /buybox — Buybox status
    this.bot.command("buybox", async (ctx: any) => {
      const chat = await this.getChatTenant(String(ctx.chat.id));
      if (!chat) return ctx.reply("❌ Önce /bagla komutu ile mağazanı bağla.");

      ctx.reply("📊 Buybox durumu kontrol ediliyor...");
      const status = await this.getBuyboxSummary(chat.tenantId);
      ctx.reply(status, { parse_mode: "HTML" });
    });

    // /yardim — Help
    this.bot.command("yardim", async (ctx: any) => {
      ctx.reply(
        `📚 <b>ZMK Bot Komutları</b>\n\n` +
          `/bagla <kod> — Mağaza bağla\n` +
          `/durum — Son 30 gün KPI\n` +
          `/buybox — Buybox durumu\n` +
          `/fiyat — Son fiyat değişiklikleri\n` +
          `/stok — Stok durumu\n\n` +
          `<b>Otomatik Uyarılar:</b>\n` +
          `🚨 Buybox kaybı\n` +
          `📉 Stok düşüşü\n` +
          `💰 Rakip fiyat değişimi\n` +
          `📦 Restock uyarısı`,
        { parse_mode: "HTML" },
      );
    });

    // Text handler for AI Intent Parsing (Saha Ajanı)
    this.bot.on("text", async (ctx: any) => {
      const text = ctx.message.text?.trim();
      if (!text || text.startsWith('/')) return; // Ignore commands

      const chat = await this.getChatTenant(String(ctx.chat.id));
      if (!chat) return;

      // Typing simulation
      ctx.replyWithChatAction("typing");
      
      try {
        const aiIntent = await this.orchestrator.generate(chat.tenantId, {
          scenario: 'telegram_intent_parser',
          input: { text }
        });
        
        let intentJsonStr = aiIntent.variations?.[0] || "{}";
        // Clean markdown JSON wrapper
        intentJsonStr = intentJsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const intent = JSON.parse(intentJsonStr);
        
        if (intent.action === 'ACTIVATE_ZEUS') {
          await this.zeusAds.executeZeusStrike(chat.tenantId, "ALL_CAMPAIGNS");
          ctx.reply("⚡🌩️ Anlaşıldı Kanka! Zeus'u ateşledim. Prime-Time saatindeki rakiplerin reklam bütçesini yakıyorum, sen çayını demle.");
        } else if (intent.action === 'ACTIVATE_OOS_SNIPER') {
          await this.oosSniper.snipeCompetitorOos(chat.tenantId, "TARGET_ALL");
          ctx.reply("🎯 OOS Yağmacı emir aldı! Rakip stoksuz kaldığı an fiyatları tavana vuracağım.");
        } else if (intent.action === 'GET_SUMMARY') {
          const summary = await this.getQuickSummary(chat.tenantId);
          ctx.reply(summary, { parse_mode: "HTML" });
        } else if (intent.action === 'PRICE_DROP') {
          ctx.reply("📉 AI onayı: Fiyat düşürme talebini okudum, Dashboard'a akıllı onay için düşürdüm.");
          await this.notifications.pushNotification(chat.tenantId, {
            type: "telegram_price_action",
            title: "Telegram Akıllı Fiyat İsteği",
            message: `Telegram Ajanı (AI) bir fiyat düşüşü yakaladı İstek: "${text}"`,
            severity: "warning",
          });
        } else {
          ctx.reply("🤷‍♂️ Kanka ne demek istediğini tam çıkaramadım, bana Zeus'u aç falan gibi yetkim olan şeyler söyle.");
        }
      } catch (err: any) {
        this.logger.error(`Intent parsing error: ${err.message}`);
        ctx.reply("Sistemde geçici bir kesinti var patron, sonra tekrar konuşalım.");
      }
    });
  }

  /**
   * Send alert to all registered Telegram chats for a tenant
   */
  async sendAlert(
    tenantId: string,
    alert: {
      type: string;
      title: string;
      message: string;
      severity?: string;
    },
  ) {
    if (!this.bot) return;

    const chats = await this.prisma.telegramChat.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    const severityEmoji: Record<string, string> = {
      info: "ℹ️",
      warning: "⚠️",
      critical: "🚨",
    };

    const emoji = severityEmoji[alert.severity || "info"] || "ℹ️";
    const rawMessage = `${emoji} <b>${alert.title}</b>\n\n${alert.message}`;

    // Pass through AI Formatter
    let formattedMessage = rawMessage;
    try {
      const aiResult = await this.orchestrator.generate(tenantId, {
        scenario: 'telegram_alert_formatter',
        input: {
          type: alert.type,
          title: alert.title,
          message: alert.message
        }
      });
      if (aiResult.variations && aiResult.variations.length > 0) {
        formattedMessage = aiResult.variations[0];
      }
    } catch (err: any) {
      this.logger.error(`AI formatting failed: ${err.message}`);
    }

    // Since AI output might be markdown, we just send it as raw text or HTML carefully
    // To prevent HTML parse errors if AI uses weird characters, we'll disable HTML parse for AI responses
    // or keep it simple.
    
    for (const chat of chats) {
      // Check if this alert type is in the user's preferences
      const alertTypes = (chat.alertTypes as string[]) || [];
      if (alertTypes.length > 0 && !alertTypes.includes(alert.type)) continue;

      try {
        await this.bot.telegram.sendMessage(chat.chatId, formattedMessage);
      } catch (error: any) {
        this.logger.error(
          `Failed to send Telegram message to ${chat.chatId}: ${error.message}`,
        );
      }
    }
  }

  private async getChatTenant(chatId: string) {
    return this.prisma.telegramChat.findUnique({ where: { chatId } });
  }

  private async getQuickSummary(tenantId: string): Promise<string> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [orders, products] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId, orderDate: { gte: thirtyDaysAgo } },
      }),
      this.prisma.product.count({ where: { tenantId, status: "active" } }),
    ]);

    const revenue = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

    return (
      `📊 <b>Son 30 Gün Özeti</b>\n\n` +
      `💰 Ciro: ₺${revenue.toLocaleString("tr-TR")}\n` +
      `📦 Sipariş: ${orders.length}\n` +
      `🛒 Aktif Ürün: ${products}\n` +
      `📏 Ort. Sepet: ₺${orders.length > 0 ? Math.round(revenue / orders.length).toLocaleString("tr-TR") : "0"}`
    );
  }

  private async getBuyboxSummary(tenantId: string): Promise<string> {
    const products = await this.prisma.competitorProduct.findMany({
      where: { tenantId },
      include: {
        buyboxSnapshots: { orderBy: { time: "desc" }, take: 1 },
      },
    });

    const monitored = products.filter((p) => p.buyboxSnapshots.length > 0);
    const ours = monitored.filter((p) => p.buyboxSnapshots[0]?.isOurBuybox);

    return (
      `🏆 <b>Buybox Durumu</b>\n\n` +
      `📊 Takip: ${monitored.length} ürün\n` +
      `✅ Bizde: ${ours.length}\n` +
      `❌ Rakipte: ${monitored.length - ours.length}\n` +
      `📈 Sahiplik: %${monitored.length > 0 ? Math.round((ours.length / monitored.length) * 100) : 0}`
    );
  }
}

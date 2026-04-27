import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

type AlertPayload = {
  targetId: string;
  type: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  message: string;
  payload?: any;
};

/**
 * ShadowAlertDispatcher — Anlık Bildirim Dağıtıcısı 📢
 *
 * Alarmları veritabanına kaydeder ve çoklu kanala dağıtır:
 * - WebSocket (Socket.io → Dashboard'a anlık push)
 * - Telegram (kritik/emergency seviyesinde)
 * - Duplicate filtreleme (aynı tip, aynı hedef, 30dk içinde tekrar gönderme)
 */
@Injectable()
export class ShadowAlertDispatcher {
  private readonly logger = new Logger(ShadowAlertDispatcher.name);
  private recentAlerts = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  async dispatch(tenantId: string, alert: AlertPayload) {
    // Duplicate filter (30 dk)
    const dedupeKey = `${alert.type}:${alert.targetId}`;
    const lastSent = this.recentAlerts.get(dedupeKey);
    const thirtyMinutes = 30 * 60 * 1000;

    if (lastSent && Date.now() - lastSent < thirtyMinutes) {
      this.logger.debug(`Duplicate alert skipped: ${dedupeKey}`);
      return null;
    }

    // Persist to DB
    const sentVia: string[] = ['database'];

    const dbAlert = await (this.prisma as any).shadowAlert.create({
      data: {
        targetId: alert.targetId,
        tenantId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        payload: alert.payload,
        sentVia: sentVia as any,
      },
    });

    // WebSocket Push
    try {
      this.pushWebSocket(tenantId, alert);
      sentVia.push('websocket');
    } catch (e: any) {
      this.logger.warn(`WebSocket push failed: ${e.message}`);
    }

    // Telegram Push (critical + emergency only)
    if (alert.severity === 'critical' || alert.severity === 'emergency') {
      try {
        await this.pushTelegram(tenantId, alert);
        sentVia.push('telegram');
      } catch (e: any) {
        this.logger.warn(`Telegram push failed: ${e.message}`);
      }
    }

    // Update sent channels
    await (this.prisma as any).shadowAlert.update({
      where: { id: dbAlert.id },
      data: { sentVia: sentVia as any },
    });

    // Update dedupe cache
    this.recentAlerts.set(dedupeKey, Date.now());

    // Cleanup old cache entries
    if (this.recentAlerts.size > 1000) {
      const cutoff = Date.now() - thirtyMinutes;
      for (const [key, ts] of this.recentAlerts) {
        if (ts < cutoff) this.recentAlerts.delete(key);
      }
    }

    this.logger.log(`${this.getSeverityIcon(alert.severity)} Alert dispatched: ${alert.title} [${sentVia.join(',')}]`);
    return dbAlert;
  }

  private pushWebSocket(tenantId: string, alert: AlertPayload) {
    this.prisma.notification.create({
      data: {
        tenantId,
        type: `shadow:${alert.type}`,
        channel: 'websocket',
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        data: { source: 'shadow_intelligence', targetId: alert.targetId, ...alert.payload },
      },
    }).catch((err: any) => {
      this.logger.warn(`Notification create failed: ${err.message}`);
    });
  }

  private async pushTelegram(tenantId: string, alert: AlertPayload) {
    const chats: any[] = await this.prisma.telegramChat.findMany({
      where: { tenantId, isActive: true },
      select: { chatId: true },
    });

    if (chats.length === 0) return;

    const emoji = this.getSeverityIcon(alert.severity);
    const text = `${emoji} *${alert.title}*\n\n${alert.message}\n\n🕐 ${new Date().toLocaleString('tr-TR')}`;

    try {
      const telegraf = require('telegraf');
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const bot = new telegraf.Telegraf(botToken);
        for (const chat of chats) {
          await bot.telegram.sendMessage(chat.chatId, text, { parse_mode: 'Markdown' }).catch(() => {});
        }
      }
    } catch {
      this.logger.debug('Telegraf not available for push');
    }
  }

  async markAllRead(tenantId: string) {
    return (this.prisma as any).shadowAlert.updateMany({
      where: { tenantId, isRead: false },
      data: { isRead: true },
    });
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'emergency': return '🚨';
      case 'critical': return '💀';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { ShadowAlertDispatcher } from './shadow-alert-dispatcher.service';

/**
 * ShadowStockSentinel — Gölge Stok Nöbetçisi 🛡️
 *
 * Hedef ürünlerin stok seviyelerini izler ve kritik durumları tespit eder.
 * CRON: Her 30 dakika
 */
@Injectable()
export class ShadowStockSentinel {
  private readonly logger = new Logger(ShadowStockSentinel.name);
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private alertDispatcher: ShadowAlertDispatcher,
  ) {}

  @Cron('*/30 * * * *')
  async scheduledCheck() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.runStockSentinel();
    } catch (error: any) {
      this.logger.error(`Stock sentinel failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  async runStockSentinel(tenantId?: string) {
    const where: any = { isActive: true };
    if (tenantId) where.tenantId = tenantId;

    const targets: any[] = await (this.prisma as any).shadowTarget.findMany({
      where,
      select: {
        id: true, tenantId: true, productName: true, trendyolUrl: true,
        lastStockCount: true, lastStockSignal: true, stockAlertThreshold: true, currentPrice: true,
      },
    });

    this.logger.log(`🛡️ Stock Sentinel: ${targets.length} hedef kontrol ediliyor...`);
    const findings: Array<{ targetId: string; alert: string; qty?: number }> = [];

    for (const target of targets) {
      const snapshots: any[] = await (this.prisma as any).shadowSnapshot.findMany({
        where: { targetId: target.id },
        orderBy: { fetchedAt: 'desc' },
        take: 2,
        select: { stockCount: true, stockSignal: true, fetchedAt: true },
      });

      if (snapshots.length < 1) continue;
      const current = snapshots[0];
      const previous = snapshots.length > 1 ? snapshots[1] : null;
      const stock = current.stockCount;
      if (stock === null || stock === undefined) continue;

      // EMERGENCY: Son 1 ürün
      if (stock === 1) {
        await this.alertDispatcher.dispatch(target.tenantId, {
          targetId: target.id, type: 'stock_last_one', severity: 'emergency',
          title: `🚨 SON 1 ÜRÜN: ${target.productName || 'Bilinmeyen'}`,
          message: `${target.productName || target.trendyolUrl} ürününde sadece 1 adet kaldı!`,
          payload: { stockCount: stock, url: target.trendyolUrl, price: target.currentPrice },
        });
        findings.push({ targetId: target.id, alert: 'stock_last_one' });
      }

      // CRITICAL: Stok bitti
      if (stock === 0 && previous?.stockCount && previous.stockCount > 0) {
        await this.alertDispatcher.dispatch(target.tenantId, {
          targetId: target.id, type: 'stock_depleted', severity: 'critical',
          title: `💀 STOK TÜKENDİ: ${target.productName || 'Bilinmeyen'}`,
          message: `${target.productName || target.trendyolUrl} stoğu tamamen bitti! OOS Sniper fırsatı.`,
          payload: { previousStock: previous.stockCount, url: target.trendyolUrl },
        });
        findings.push({ targetId: target.id, alert: 'stock_depleted' });
      }

      // WARNING: Düşük stok
      if (stock > 0 && stock <= (target.stockAlertThreshold || 5) && stock > 1) {
        await this.alertDispatcher.dispatch(target.tenantId, {
          targetId: target.id, type: 'stock_critical', severity: 'warning',
          title: `⚠️ KRİTİK STOK: ${target.productName || 'Bilinmeyen'}`,
          message: `${target.productName || target.trendyolUrl} sadece ${stock} adet kaldı!`,
          payload: { stockCount: stock, threshold: target.stockAlertThreshold, url: target.trendyolUrl },
        });
        findings.push({ targetId: target.id, alert: 'stock_critical' });
      }

      // INFO: Stok yenileme
      if (previous?.stockCount !== null && previous?.stockCount !== undefined && stock > previous.stockCount) {
        const restock = stock - previous.stockCount;
        await this.alertDispatcher.dispatch(target.tenantId, {
          targetId: target.id, type: 'stock_restocked', severity: 'info',
          title: `📦 STOK YENİLENDİ: ${target.productName || 'Bilinmeyen'}`,
          message: `+${restock} adet stok eklendi. Yeni stok: ${stock}`,
          payload: { previousStock: previous.stockCount, newStock: stock, restocked: restock },
        });
        findings.push({ targetId: target.id, alert: 'stock_restocked', qty: restock });
      }

      // Update stock signal
      let signal = 'high';
      if (stock === 0) signal = 'out_of_stock';
      else if (stock <= 3) signal = 'critical';
      else if (stock <= 10) signal = 'low';
      else if (stock <= 50) signal = 'medium';

      if (signal !== target.lastStockSignal) {
        await (this.prisma as any).shadowTarget.update({
          where: { id: target.id },
          data: { lastStockSignal: signal },
        });
      }
    }

    this.logger.log(`🛡️ Stock Sentinel tamamlandı: ${findings.length} bulgu`);
    return { checked: targets.length, findings };
  }

  async getSalesVelocity(targetId: string, hours = 24) {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const logs: any[] = await (this.prisma as any).shadowStockLog.findMany({
      where: { targetId, eventType: 'sale', detectedAt: { gte: startDate } },
      orderBy: { detectedAt: 'asc' },
    });

    const totalSales = logs.reduce((s: number, l: any) => s + Math.abs(l.delta || 0), 0);
    const salesPerHour = hours > 0 ? totalSales / hours : 0;

    const target = await (this.prisma as any).shadowTarget.findUnique({
      where: { id: targetId },
      select: { lastStockCount: true },
    });

    const currentStock = target?.lastStockCount || 0;
    const hoursUntilOOS = salesPerHour > 0 ? currentStock / salesPerHour : null;

    return {
      totalSales,
      salesPerHour: Math.round(salesPerHour * 100) / 100,
      salesPerDay: Math.round(salesPerHour * 24 * 100) / 100,
      currentStock,
      hoursUntilOOS: hoursUntilOOS ? Math.round(hoursUntilOOS) : null,
      daysUntilOOS: hoursUntilOOS ? Math.round(hoursUntilOOS / 24) : null,
    };
  }
}

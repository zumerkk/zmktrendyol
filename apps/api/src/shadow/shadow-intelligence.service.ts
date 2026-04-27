import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateShadowTargetDto, UpdateShadowTargetDto, BatchAddTargetsDto, TargetFilterDto } from './dto/shadow.dto';

/**
 * ShadowIntelligenceService — Gölge İstihbarat Ana Servisi 🕵️‍♂️
 *
 * Tüm hedef yönetimi, tarama, stok/fiyat zaman serisi ve
 * karşılaştırmalı analiz işlemlerini yönetir.
 */
@Injectable()
export class ShadowIntelligenceService {
  private readonly logger = new Logger(ShadowIntelligenceService.name);

  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════
  //  TARGET MANAGEMENT
  // ═══════════════════════════════════════════════════

  async addTarget(tenantId: string, dto: CreateShadowTargetDto) {
    const url = dto.url.trim();
    if (!url.includes('trendyol.com')) {
      throw new BadRequestException('Sadece Trendyol URL desteklenmektedir.');
    }

    const existing = await (this.prisma as any).shadowTarget.findFirst({
      where: { tenantId, trendyolUrl: url },
    });
    if (existing) {
      throw new BadRequestException('Bu URL zaten izleme listesinde.');
    }

    return (this.prisma as any).shadowTarget.create({
      data: {
        tenantId,
        trendyolUrl: url,
        productName: dto.productName,
        brand: dto.brand,
        category: dto.category,
        watchlistId: dto.watchlistId,
        ourProductId: dto.ourProductId,
        scanInterval: dto.scanInterval ?? 15,
        stockProbeEnabled: dto.stockProbeEnabled ?? false,
        stockAlertThreshold: dto.stockAlertThreshold ?? 5,
      },
    });
  }

  async batchAddTargets(tenantId: string, dto: BatchAddTargetsDto) {
    const results: Array<{ url: string; success: boolean; targetId?: string; error?: string }> = [];
    for (const url of dto.urls) {
      try {
        const target = await this.addTarget(tenantId, { url, watchlistId: dto.watchlistId } as CreateShadowTargetDto);
        results.push({ url, success: true, targetId: target.id });
      } catch (error: any) {
        results.push({ url, success: false, error: error.message });
      }
    }
    return { total: dto.urls.length, added: results.filter((r: any) => r.success).length, results };
  }

  async updateTarget(tenantId: string, targetId: string, dto: UpdateShadowTargetDto) {
    await this.assertOwned(tenantId, targetId);
    return (this.prisma as any).shadowTarget.update({
      where: { id: targetId },
      data: {
        productName: dto.productName,
        ourProductId: dto.ourProductId,
        watchlistId: dto.watchlistId,
        scanInterval: dto.scanInterval,
        stockProbeEnabled: dto.stockProbeEnabled,
        stockAlertThreshold: dto.stockAlertThreshold,
        priceAlertEnabled: dto.priceAlertEnabled,
        isActive: dto.isActive,
      },
    });
  }

  async removeTarget(tenantId: string, targetId: string) {
    await this.assertOwned(tenantId, targetId);
    await (this.prisma as any).shadowTarget.delete({ where: { id: targetId } });
    return { success: true };
  }

  async getTargets(tenantId: string, filters: TargetFilterDto) {
    const where: any = { tenantId };
    if (filters.watchlistId) where.watchlistId = filters.watchlistId;
    if (filters.stockSignal) where.lastStockSignal = filters.stockSignal;
    if (filters.brand) where.brand = { contains: filters.brand, mode: 'insensitive' };
    if (filters.isActive !== undefined) where.isActive = filters.isActive === 'true';

    const limit = Math.min(parseInt(filters.limit || '50'), 200);
    const offset = parseInt(filters.offset || '0');

    const [targets, total] = await Promise.all([
      (this.prisma as any).shadowTarget.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          watchlist: { select: { id: true, name: true } },
          alerts: { where: { isRead: false }, orderBy: { createdAt: 'desc' }, take: 3 },
        },
      }),
      (this.prisma as any).shadowTarget.count({ where }),
    ]);

    return { targets, total, limit, offset };
  }

  async getTargetDetail(tenantId: string, targetId: string) {
    const target = await (this.prisma as any).shadowTarget.findFirst({
      where: { id: targetId, tenantId },
      include: {
        watchlist: { select: { id: true, name: true } },
        snapshots: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        alerts: { where: { isRead: false }, orderBy: { createdAt: 'desc' }, take: 10 },
        stockLogs: { orderBy: { detectedAt: 'desc' }, take: 20 },
      },
    });
    if (!target) throw new NotFoundException('Hedef bulunamadı');
    return target;
  }

  // ═══════════════════════════════════════════════════
  //  SCANNING — Record snapshot data
  // ═══════════════════════════════════════════════════

  async recordSnapshot(tenantId: string, targetId: string, data: {
    price?: number;
    originalPrice?: number;
    stockCount?: number;
    stockSignal?: string;
    reviewCount?: number;
    rating?: number;
    sellerName?: string;
    buyboxHolder?: string;
    totalSellers?: number;
    hasPromotion?: boolean;
    promotionText?: string;
    variants?: any;
    rawData?: any;
  }) {
    const target = await (this.prisma as any).shadowTarget.findFirst({
      where: { id: targetId, tenantId },
    });
    if (!target) throw new NotFoundException('Hedef bulunamadı');

    // Get previous snapshot for stock delta
    const prevSnapshot = await (this.prisma as any).shadowSnapshot.findFirst({
      where: { targetId },
      orderBy: { fetchedAt: 'desc' },
    });

    const snapshot = await (this.prisma as any).shadowSnapshot.create({
      data: {
        targetId,
        tenantId,
        price: data.price as any,
        originalPrice: data.originalPrice as any,
        stockCount: data.stockCount,
        stockSignal: data.stockSignal || 'unknown',
        reviewCount: data.reviewCount,
        rating: data.rating as any,
        sellerName: data.sellerName,
        buyboxHolder: data.buyboxHolder,
        totalSellers: data.totalSellers,
        hasPromotion: data.hasPromotion || false,
        promotionText: data.promotionText,
        variants: data.variants,
        rawData: data.rawData,
      },
    });

    // Update target's current state
    const updateData: any = { lastScanAt: new Date() };
    if (data.price !== undefined) updateData.currentPrice = data.price;
    if (data.stockCount !== undefined) updateData.lastStockCount = data.stockCount;
    if (data.stockSignal) updateData.lastStockSignal = data.stockSignal;
    if (data.reviewCount !== undefined) updateData.reviewCount = data.reviewCount;
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.sellerName) updateData.sellerName = data.sellerName;

    await (this.prisma as any).shadowTarget.update({
      where: { id: targetId },
      data: updateData,
    });

    // Create stock log if stock changed
    if (data.stockCount !== undefined && prevSnapshot?.stockCount !== undefined && prevSnapshot.stockCount !== null) {
      const delta = data.stockCount - prevSnapshot.stockCount;
      if (delta !== 0) {
        let eventType = 'sale';
        if (delta > 0) eventType = 'restock';
        if (data.stockCount === 0) eventType = 'out_of_stock';
        if (prevSnapshot.stockCount === 0 && data.stockCount > 0) eventType = 'back_in_stock';

        await (this.prisma as any).shadowStockLog.create({
          data: { targetId, tenantId, stockBefore: prevSnapshot.stockCount, stockAfter: data.stockCount, delta, eventType },
        });
      }
    }

    return snapshot;
  }

  // ═══════════════════════════════════════════════════
  //  TIMELINES & ANALYTICS
  // ═══════════════════════════════════════════════════

  async getStockTimeline(targetId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return (this.prisma as any).shadowSnapshot.findMany({
      where: { targetId, fetchedAt: { gte: startDate } },
      select: { fetchedAt: true, stockCount: true, stockSignal: true },
      orderBy: { fetchedAt: 'asc' },
    });
  }

  async getPriceTimeline(targetId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return (this.prisma as any).shadowSnapshot.findMany({
      where: { targetId, fetchedAt: { gte: startDate }, price: { not: null } },
      select: { fetchedAt: true, price: true, originalPrice: true },
      orderBy: { fetchedAt: 'asc' },
    });
  }

  async getSalesAnalysis(tenantId: string, targetId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    await this.assertOwned(tenantId, targetId);

    const days = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stockLogs: any[] = await (this.prisma as any).shadowStockLog.findMany({
      where: { targetId, detectedAt: { gte: startDate } },
      orderBy: { detectedAt: 'asc' },
    });

    const salesLogs = stockLogs.filter((l: any) => l.eventType === 'sale');
    const restockLogs = stockLogs.filter((l: any) => l.eventType === 'restock');

    const totalSales = salesLogs.reduce((sum: number, l: any) => sum + Math.abs(l.delta || 0), 0);
    const totalRestock = restockLogs.reduce((sum: number, l: any) => sum + (l.delta || 0), 0);

    const hoursOfData = stockLogs.length > 1
      ? (stockLogs[stockLogs.length - 1].detectedAt.getTime() - stockLogs[0].detectedAt.getTime()) / (1000 * 60 * 60)
      : days * 24;
    const salesPerHour = hoursOfData > 0 ? totalSales / hoursOfData : 0;
    const salesPerDay = salesPerHour * 24;

    const target = await (this.prisma as any).shadowTarget.findUnique({
      where: { id: targetId },
      select: { lastStockCount: true, currentPrice: true },
    });
    const currentStock = target?.lastStockCount || 0;
    const daysUntilDepletion = salesPerDay > 0 ? Math.round(currentStock / salesPerDay) : null;
    const avgPrice = target?.currentPrice ? Number(target.currentPrice) : 0;
    const estimatedRevenue = totalSales * avgPrice;

    return {
      period,
      periodDays: days,
      totalSales,
      totalRestock,
      currentStock,
      salesPerHour: Math.round(salesPerHour * 100) / 100,
      salesPerDay: Math.round(salesPerDay * 100) / 100,
      estimatedMonthlySales: Math.round(salesPerDay * 30),
      daysUntilDepletion,
      estimatedRevenue: Math.round(estimatedRevenue),
      salesBreakdown: salesLogs.map((l: any) => ({
        time: l.detectedAt,
        unitsSold: Math.abs(l.delta || 0),
        stockAfter: l.stockAfter,
      })),
      restockBreakdown: restockLogs.map((l: any) => ({
        time: l.detectedAt,
        unitsAdded: l.delta || 0,
        stockAfter: l.stockAfter,
      })),
      dataPoints: stockLogs.length,
      confidence: stockLogs.length >= 10 ? 95 : stockLogs.length >= 5 ? 85 : stockLogs.length >= 2 ? 70 : 30,
    };
  }

  async comparePriceWithOurs(tenantId: string, targetId: string) {
    const target = await (this.prisma as any).shadowTarget.findFirst({
      where: { id: targetId, tenantId },
    });
    if (!target) throw new NotFoundException('Hedef bulunamadı');
    if (!target.ourProductId) return { mapped: false, message: 'Henüz bizim bir ürünle eşleştirilmemiş' };

    const ourProduct = await this.prisma.product.findFirst({
      where: { id: target.ourProductId, tenantId },
      select: {
        id: true, title: true, costPrice: true, commissionRate: true,
        shippingCost: true, packagingCost: true,
        variants: { select: { salePrice: true, listPrice: true, quantity: true } },
      },
    });

    if (!ourProduct) return { mapped: false, message: 'Eşleşen ürün bulunamadı' };

    const ourMinPrice = ourProduct.variants.length
      ? Math.min(...ourProduct.variants.map((v: any) => Number(v.salePrice || 0)).filter((p: number) => p > 0))
      : 0;
    const competitorPrice = target.currentPrice ? Number(target.currentPrice) : 0;
    const priceDiff = ourMinPrice - competitorPrice;
    const priceDiffPercent = competitorPrice > 0 ? (priceDiff / competitorPrice) * 100 : 0;

    return {
      mapped: true,
      our: {
        id: ourProduct.id,
        title: ourProduct.title,
        minPrice: ourMinPrice,
        costPrice: ourProduct.costPrice ? Number(ourProduct.costPrice) : 0,
        totalStock: ourProduct.variants.reduce((s: number, v: any) => s + v.quantity, 0),
      },
      competitor: {
        url: target.trendyolUrl,
        name: target.productName,
        price: competitorPrice,
        stock: target.lastStockCount,
        seller: target.sellerName,
      },
      comparison: {
        priceDiff: Math.round(priceDiff * 100) / 100,
        priceDiffPercent: Math.round(priceDiffPercent * 100) / 100,
        weAreCheaper: priceDiff < 0,
        recommendation: priceDiff > 0
          ? `Rakip bizden ₺${Math.abs(priceDiff).toFixed(2)} daha ucuz! Fiyat indirimi düşünün.`
          : priceDiff < 0
            ? `Biz rakipten ₺${Math.abs(priceDiff).toFixed(2)} daha ucuzuz. Marjı artırma fırsatı.`
            : 'Fiyatlar eşit.',
      },
    };
  }

  // ═══════════════════════════════════════════════════
  //  DASHBOARD SUMMARY
  // ═══════════════════════════════════════════════════

  async getDashboardSummary(tenantId: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalTargets,
      activeTargets,
      unreadAlerts,
      criticalAlerts,
      oosTargets,
      lowStockTargets,
      recentAlerts,
      recentSalesLogs,
    ] = await Promise.all([
      (this.prisma as any).shadowTarget.count({ where: { tenantId } }),
      (this.prisma as any).shadowTarget.count({ where: { tenantId, isActive: true } }),
      (this.prisma as any).shadowAlert.count({ where: { tenantId, isRead: false } }),
      (this.prisma as any).shadowAlert.count({ where: { tenantId, severity: { in: ['critical', 'emergency'] }, createdAt: { gte: oneDayAgo } } }),
      (this.prisma as any).shadowTarget.count({ where: { tenantId, lastStockSignal: 'out_of_stock' } }),
      (this.prisma as any).shadowTarget.count({ where: { tenantId, lastStockSignal: { in: ['low', 'critical'] } } }),
      (this.prisma as any).shadowAlert.findMany({
        where: { tenantId, createdAt: { gte: oneDayAgo } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { target: { select: { productName: true, trendyolUrl: true } } },
      }),
      (this.prisma as any).shadowStockLog.findMany({
        where: { tenantId, eventType: 'sale', detectedAt: { gte: oneDayAgo } },
      }),
    ]);

    const totalEstimatedSales = (recentSalesLogs as any[]).reduce((s: number, l: any) => s + Math.abs(l.delta || 0), 0);

    return {
      kpi: {
        totalTargets,
        activeTargets,
        unreadAlerts,
        criticalAlerts24h: criticalAlerts,
        oosTargets,
        lowStockTargets,
        estimatedCompetitorSales24h: totalEstimatedSales,
      },
      recentAlerts,
      lastUpdated: now.toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════
  //  WATCHLIST MANAGEMENT
  // ═══════════════════════════════════════════════════

  async getWatchlists(tenantId: string) {
    return (this.prisma as any).shadowWatchlist.findMany({
      where: { tenantId },
      include: {
        targets: { select: { id: true, productName: true, currentPrice: true, lastStockSignal: true, isActive: true } },
        _count: { select: { targets: true } },
      },
      orderBy: { priority: 'asc' },
    });
  }

  async createWatchlist(tenantId: string, dto: { name: string; description?: string; priority?: number }) {
    return (this.prisma as any).shadowWatchlist.create({
      data: { tenantId, name: dto.name, description: dto.description, priority: dto.priority ?? 1 },
    });
  }

  async updateWatchlist(tenantId: string, id: string, dto: any) {
    const wl = await (this.prisma as any).shadowWatchlist.findFirst({ where: { id, tenantId } });
    if (!wl) throw new NotFoundException('İzleme listesi bulunamadı');
    return (this.prisma as any).shadowWatchlist.update({
      where: { id },
      data: { name: dto.name, description: dto.description, priority: dto.priority, isActive: dto.isActive },
    });
  }

  async deleteWatchlist(tenantId: string, id: string) {
    const wl = await (this.prisma as any).shadowWatchlist.findFirst({ where: { id, tenantId } });
    if (!wl) throw new NotFoundException('İzleme listesi bulunamadı');
    await (this.prisma as any).shadowTarget.updateMany({ where: { watchlistId: id }, data: { watchlistId: null } });
    await (this.prisma as any).shadowWatchlist.delete({ where: { id } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════
  //  ALERTS
  // ═══════════════════════════════════════════════════

  async getAlerts(tenantId: string, filters: { severity?: string; type?: string; unreadOnly?: string; limit?: string }) {
    const where: any = { tenantId };
    if (filters.severity) where.severity = filters.severity;
    if (filters.type) where.type = filters.type;
    if (filters.unreadOnly === 'true') where.isRead = false;

    return (this.prisma as any).shadowAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(filters.limit || '50'), 200),
      include: { target: { select: { productName: true, trendyolUrl: true, imageUrl: true } } },
    });
  }

  async markAlertRead(tenantId: string, alertId: string) {
    const alert = await (this.prisma as any).shadowAlert.findFirst({ where: { id: alertId, tenantId } });
    if (!alert) throw new NotFoundException('Alarm bulunamadı');
    return (this.prisma as any).shadowAlert.update({ where: { id: alertId }, data: { isRead: true } });
  }

  async getAlertStats(tenantId: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [unread, today, week, bySeverity] = await Promise.all([
      (this.prisma as any).shadowAlert.count({ where: { tenantId, isRead: false } }),
      (this.prisma as any).shadowAlert.count({ where: { tenantId, createdAt: { gte: oneDayAgo } } }),
      (this.prisma as any).shadowAlert.count({ where: { tenantId, createdAt: { gte: oneWeekAgo } } }),
      (this.prisma as any).shadowAlert.groupBy({
        by: ['severity'],
        where: { tenantId, createdAt: { gte: oneWeekAgo } },
        _count: true,
      }),
    ]);

    return { unread, today, week, bySeverity };
  }

  // ═══════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════

  private async assertOwned(tenantId: string, targetId: string) {
    const exists = await (this.prisma as any).shadowTarget.findFirst({
      where: { id: targetId, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Hedef bulunamadı');
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { ProductsService } from "./products/products.service";
import { OrdersService } from "./orders/orders.service";

/**
 * SyncSchedulerService — Otomatik Veri Senkronizasyonu
 *
 * Tüm aktif tenant'ların ürün ve sipariş verilerini
 * Trendyol API'den periyodik olarak çeker.
 *
 * CRON Zamanlaması:
 *  - Ürünler: Her 6 saatte bir (00:15, 06:15, 12:15, 18:15)
 *  - Siparişler: Her 2 saatte bir (00:00, 02:00, 04:00, ...)
 *  - Siparişler (hızlı): Her 15 dakikada bir sadece son 30 dk'lık siparişler
 */
@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);
  private isProductSyncing = false;
  private isOrderSyncing = false;

  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private ordersService: OrdersService,
  ) {}

  /**
   * CRON: Her 6 saatte ürün senkronizasyonu
   */
  @Cron("15 */6 * * *")
  async syncAllProducts() {
    if (this.isProductSyncing) {
      this.logger.warn("Product sync already running, skipping...");
      return;
    }

    this.isProductSyncing = true;
    this.logger.log("📦 Scheduled product sync starting...");

    try {
      const tenants = await this.getActiveTenants();

      for (const tenant of tenants) {
        try {
          let page = 0;
          let totalSynced = 0;
          let hasMore = true;

          while (hasMore) {
            const result = await this.productsService.syncProducts(
              tenant.id,
              page,
              200,
            );
            totalSynced += result.synced;
            hasMore = result.synced === 200;
            page++;

            // Rate limit respect: small pause between pages
            if (hasMore) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }

          this.logger.log(
            `📦 Tenant ${tenant.name}: ${totalSynced} products synced`,
          );
        } catch (error: any) {
          this.logger.error(
            `Product sync failed for tenant ${tenant.name}: ${error.message}`,
          );
        }
      }

      this.logger.log("📦 Scheduled product sync complete");
    } finally {
      this.isProductSyncing = false;
    }
  }

  /**
   * CRON: Her 2 saatte tam sipariş senkronizasyonu (son 24 saat)
   */
  @Cron("0 */2 * * *")
  async syncAllOrders() {
    if (this.isOrderSyncing) {
      this.logger.warn("Order sync already running, skipping...");
      return;
    }

    this.isOrderSyncing = true;
    this.logger.log("🛒 Scheduled order sync starting...");

    try {
      const tenants = await this.getActiveTenants();

      for (const tenant of tenants) {
        try {
          const result = await this.ordersService.syncOrders(tenant.id);
          this.logger.log(
            `🛒 Tenant ${tenant.name}: ${result.synced} orders synced`,
          );
        } catch (error: any) {
          this.logger.error(
            `Order sync failed for tenant ${tenant.name}: ${error.message}`,
          );
        }
      }

      this.logger.log("🛒 Scheduled order sync complete");
    } finally {
      this.isOrderSyncing = false;
    }
  }

  /**
   * CRON: Her 15 dakikada hızlı sipariş sync (son 30 dakika)
   * Yeni siparişleri hızlıca yakalar
   */
  @Cron("*/15 * * * *")
  async quickOrderSync() {
    if (this.isOrderSyncing) return;

    try {
      const tenants = await this.getActiveTenants();
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

      for (const tenant of tenants) {
        try {
          const result = await this.ordersService.syncOrders(
            tenant.id,
            thirtyMinAgo,
          );
          if (result.synced > 0) {
            this.logger.log(
              `⚡ Quick sync — ${result.synced} new orders for ${tenant.name}`,
            );
          }
        } catch {
          // Suppress quick sync errors — full sync will catch them
        }
      }
    } catch {
      // Suppress errors
    }
  }

  /**
   * Get tenants that have an active Trendyol connection
   */
  private async getActiveTenants() {
    return this.prisma.tenant.findMany({
      where: {
        sellerConnections: {
          some: { status: "active" },
        },
      },
      select: { id: true, name: true },
    });
  }
}

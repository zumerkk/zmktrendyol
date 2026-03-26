import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TrendyolService } from "../trendyol.service";

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private prisma: PrismaService,
    private trendyol: TrendyolService,
  ) {}

  /**
   * Update stock and price via Trendyol API
   * Endpoint: POST /integration/product/sellers/{sellerId}/products/price-and-inventory
   * Rule: listPrice >= salePrice (enforced by validation)
   */
  async updatePriceAndInventory(
    tenantId: string,
    userId: string,
    items: Array<{
      barcode: string;
      listPrice: number;
      salePrice: number;
      quantity: number;
    }>,
  ) {
    // Validation: listPrice >= salePrice
    for (const item of items) {
      if (item.listPrice < item.salePrice) {
        throw new BadRequestException(
          `listPrice (${item.listPrice}) must be >= salePrice (${item.salePrice}) for barcode ${item.barcode}`,
        );
      }
    }

    const { client, sellerId } = await this.trendyol.getClient(tenantId);

    const payload = {
      items: items.map((item) => ({
        barcode: item.barcode,
        listPrice: item.listPrice,
        salePrice: item.salePrice,
        quantity: item.quantity,
      })),
    };

    const res = await client.post(
      `/integration/product/sellers/${sellerId}/products/price-and-inventory`,
      payload,
    );

    const batchId = res.data?.batchRequestId;

    // Record history for each item
    for (const item of items) {
      const product = await this.prisma.product.findFirst({
        where: { tenantId, barcode: item.barcode },
      });

      if (product) {
        // Price history
        await this.prisma.priceHistory.create({
          data: {
            productId: product.id,
            listPrice: item.listPrice,
            salePrice: item.salePrice,
            changedBy: userId,
          },
        });

        // Inventory history
        await this.prisma.inventoryHistory.create({
          data: {
            productId: product.id,
            quantity: item.quantity,
            changedBy: userId,
          },
        });
      }
    }

    this.logger.log(
      `Price/inventory update sent for ${items.length} items. Batch: ${batchId}`,
    );
    return { batchRequestId: batchId, itemsUpdated: items.length };
  }

  /**
   * Check batch request result
   * Endpoint: GET /integration/product/sellers/{sellerId}/products/batch-requests/{batchId}
   */
  async checkBatchResult(tenantId: string, batchId: string) {
    const { client, sellerId } = await this.trendyol.getClient(tenantId);
    const res = await client.get(
      `/integration/product/sellers/${sellerId}/products/batch-requests/${batchId}`,
    );
    return res.data;
  }

  /**
   * Get price history for a product (6 months)
   */
  async getPriceHistory(tenantId: string, productId: string, months = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return this.prisma.priceHistory.findMany({
      where: {
        productId,
        time: { gte: startDate },
        product: { tenantId },
      },
      orderBy: { time: "asc" },
    });
  }

  /**
   * Get price extremes (min/max) for a period
   */
  async getPriceExtremes(tenantId: string, productId: string, months = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const history = await this.prisma.priceHistory.findMany({
      where: {
        productId,
        time: { gte: startDate },
        product: { tenantId },
      },
    });

    if (history.length === 0) return null;

    const prices = history.map((h) => Number(h.salePrice));
    return {
      highest: Math.max(...prices),
      lowest: Math.min(...prices),
      changeCount: history.length,
      period: `${months} months`,
    };
  }

  /**
   * Estimate stock breakage days based on sales velocity
   */
  async estimateStockBreakage(tenantId: string, productId: string) {
    // Get current stock
    const latestInventory = await this.prisma.inventoryHistory.findFirst({
      where: { productId, product: { tenantId } },
      orderBy: { time: "desc" },
    });

    if (!latestInventory) return null;

    // Get last 30 days of orders for this product
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        product: { id: productId, tenantId },
        order: { orderDate: { gte: thirtyDaysAgo } },
      },
    });

    const totalSold = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const dailyAvg = totalSold / 30;

    if (dailyAvg === 0) {
      return {
        currentStock: latestInventory.quantity,
        dailyAvgSales: 0,
        estimatedDays: Infinity,
        source: "api" as const,
      };
    }

    return {
      currentStock: latestInventory.quantity,
      dailyAvgSales: Math.round(dailyAvg * 100) / 100,
      estimatedDays: Math.round(latestInventory.quantity / dailyAvg),
      source: "api" as const,
    };
  }
}

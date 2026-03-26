import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * ContextService — Browser Extension API
 * Matches Trendyol product pages to internal products
 */
@Injectable()
export class ContextService {
  constructor(private prisma: PrismaService) {}

  /**
   * Match a Trendyol URL to internal product
   */
  async matchProduct(tenantId: string, trendyolUrl: string) {
    // Check cache
    const cached = await this.prisma.pageContextCache.findFirst({
      where: { trendyolUrl },
    });
    if (cached) return cached.data;

    // Try to extract barcode/product info from URL
    const urlParts = trendyolUrl.split("/");
    const possibleId = urlParts[urlParts.length - 1]
      ?.split("?")[0]
      ?.split("-")
      .pop();

    // Search by various criteria
    let product = null;
    if (possibleId) {
      product = await this.prisma.product.findFirst({
        where: {
          tenantId,
          OR: [
            { barcode: possibleId },
            { trendyolId: BigInt(possibleId).valueOf() || undefined },
          ],
        },
        include: { variants: true },
      });
    }

    const result = {
      matched: !!product,
      product: product,
      url: trendyolUrl,
    };

    // Cache result
    if (product) {
      // Serialize BigInt/Decimal before storing as JSON
      const serialized = JSON.parse(
        JSON.stringify(result, (_, v) =>
          typeof v === "bigint" ? Number(v) : v,
        ),
      );
      await this.prisma.pageContextCache.create({
        data: {
          trendyolUrl,
          productId: product.id,
          data: serialized,
        },
      });
    }

    return result;
  }

  /**
   * Get quick KPI for overlay display
   */
  async getOverlayKPI(tenantId: string, productId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [orderItems, latestInventory, priceHistory, product] =
      await Promise.all([
        this.prisma.orderItem.findMany({
          where: {
            productId,
            order: { tenantId, orderDate: { gte: thirtyDaysAgo } },
          },
        }),
        this.prisma.inventoryHistory.findFirst({
          where: { productId },
          orderBy: { time: "desc" },
        }),
        this.prisma.priceHistory.findMany({
          where: { productId },
          orderBy: { time: "asc" },
        }),
        this.prisma.product.findFirst({
          where: { id: productId, tenantId },
          include: { variants: true },
        }),
      ]);

    const totalUnits = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalRevenue = orderItems.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );

    const returns = await this.prisma.returnItem.count({
      where: {
        productId,
        returnRec: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      },
    });

    return {
      product: product
        ? { id: product.id, title: product.title, barcode: product.barcode }
        : null,
      last30Days: {
        units: { value: totalUnits, source: "api" },
        revenue: { value: totalRevenue, source: "api" },
        returnRate: {
          value:
            totalUnits > 0
              ? Math.round((returns / totalUnits) * 10000) / 100
              : 0,
          source: "api",
        },
      },
      currentStock: latestInventory
        ? { value: latestInventory.quantity, source: "api" }
        : null,
      priceHistory: priceHistory.map((ph) => ({
        date: ph.time,
        listPrice: Number(ph.listPrice),
        salePrice: Number(ph.salePrice),
      })),
      priceExtremes:
        priceHistory.length > 0
          ? {
              highest: Math.max(
                ...priceHistory.map((ph) => Number(ph.salePrice)),
              ),
              lowest: Math.min(
                ...priceHistory.map((ph) => Number(ph.salePrice)),
              ),
              changeCount: priceHistory.length,
              source: "api",
            }
          : null,
    };
  }
}

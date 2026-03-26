import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * MarketplaceHubService — Multi-Marketplace Entegrasyonu
 *
 * Trendyol, Hepsiburada, n11, Amazon TR
 * Tek dashboard'dan 4 pazaryerini yönet.
 *
 * Her marketplace bağlantısı ayrı credentials ile saklanır.
 */
@Injectable()
export class MarketplaceHubService {
  private readonly logger = new Logger(MarketplaceHubService.name);

  private readonly supportedMarketplaces = [
    {
      id: "trendyol",
      name: "Trendyol",
      apiBase: "https://api.trendyol.com/sapigw",
      status: "active",
    },
    {
      id: "hepsiburada",
      name: "Hepsiburada",
      apiBase: "https://mpop-sit.hepsiburada.com",
      status: "planned",
    },
    {
      id: "n11",
      name: "n11",
      apiBase: "https://api.n11.com/ws",
      status: "planned",
    },
    {
      id: "amazon_tr",
      name: "Amazon Türkiye",
      apiBase: "https://sellingpartnerapi-eu.amazon.com",
      status: "planned",
    },
  ];

  constructor(private prisma: PrismaService) {}

  /**
   * Get supported marketplaces
   */
  getSupportedMarketplaces() {
    return this.supportedMarketplaces;
  }

  /**
   * Add marketplace connection
   */
  async addConnection(
    tenantId: string,
    dto: {
      marketplace: string;
      sellerId: string;
      credentials: { apiKey?: string; apiSecret?: string; [key: string]: any };
    },
  ) {
    const marketplace = this.supportedMarketplaces.find(
      (m) => m.id === dto.marketplace,
    );
    if (!marketplace)
      throw new Error(`Desteklenmeyen pazaryeri: ${dto.marketplace}`);

    return this.prisma.marketplaceConnection.upsert({
      where: {
        tenantId_marketplace: {
          tenantId,
          marketplace: dto.marketplace,
        },
      },
      create: {
        tenantId,
        marketplace: dto.marketplace,
        sellerId: dto.sellerId,
        credentials: dto.credentials as any,
      },
      update: {
        sellerId: dto.sellerId,
        credentials: dto.credentials as any,
        status: "active",
      },
    });
  }

  /**
   * Get connections for tenant
   */
  async getConnections(tenantId: string) {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { tenantId },
    });

    return this.supportedMarketplaces.map((mp) => {
      const conn = connections.find((c) => c.marketplace === mp.id);
      return {
        marketplace: mp.id,
        name: mp.name,
        connected: !!conn,
        status: conn?.status || mp.status,
        lastSyncAt: conn?.lastSyncAt,
      };
    });
  }

  /**
   * Remove connection
   */
  async removeConnection(tenantId: string, marketplace: string) {
    return this.prisma.marketplaceConnection.delete({
      where: {
        tenantId_marketplace: { tenantId, marketplace },
      },
    });
  }

  /**
   * Get unified dashboard across all marketplaces
   */
  async getUnifiedDashboard(tenantId: string) {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { tenantId, status: "active" },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Trendyol data (always available if tenant exists)
    const [orders, products] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId, orderDate: { gte: thirtyDaysAgo } },
      }),
      this.prisma.product.count({ where: { tenantId, status: "active" } }),
    ]);

    const trendyolData = {
      marketplace: "trendyol",
      name: "Trendyol",
      orders: orders.length,
      revenue: orders.reduce((sum, o) => sum + Number(o.totalPrice), 0),
      products,
      source: "api" as const,
    };

    // Placeholder for other marketplaces
    const otherData = connections
      .filter((c) => c.marketplace !== "trendyol")
      .map((c) => ({
        marketplace: c.marketplace,
        name:
          this.supportedMarketplaces.find((m) => m.id === c.marketplace)
            ?.name || c.marketplace,
        orders: 0,
        revenue: 0,
        products: 0,
        source: "planned" as const,
        message: "Bu pazaryeri entegrasyonu yakında aktif olacak.",
      }));

    const allData = [trendyolData, ...otherData];

    return {
      connectedMarketplaces: connections.length + 1, // +1 for trendyol default
      totalOrders: allData.reduce((sum, d) => sum + d.orders, 0),
      totalRevenue: Math.round(allData.reduce((sum, d) => sum + d.revenue, 0)),
      totalProducts: allData.reduce((sum, d) => sum + d.products, 0),
      byMarketplace: allData,
    };
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ProfitabilityService } from "../analytics/profitability.service";

@Injectable()
export class CommandCenterService {
  private readonly logger = new Logger(CommandCenterService.name);

  constructor(
    private prisma: PrismaService,
    private profitability: ProfitabilityService,
  ) {}

  /**
   * Generates top priorities for a given tenant.
   * Checks stock logic, profitability logic, and competitor buybox logic.
   */
  async generateDailyInsights(tenantId: string) {
    this.logger.log(`Generating daily insights for tenant: ${tenantId}`);
    const newInsights = [];

    // 1. Loss-making hero products (High Volume, Negative Profit)
    const profitData = await this.profitability.calculateTenantPL(tenantId, 30);
    const losers = profitData.allProducts.filter(
      (p) => p.netProfit < 0 && p.units > 50,
    );

    for (const loser of losers) {
      newInsights.push({
        tenantId,
        type: "loss_making",
        priority: 1, // Critical
        title: `Kritik Zarar: ${loser.title}`,
        description: `Son 30 günde ${loser.units} adet sattınız ama ₺${Math.abs(loser.netProfit)} zarar ettiniz.`,
        suggestedAction: "Fiyatı %5 artır veya Reklamı durdur.",
        metadata: { productId: loser.productId, loss: loser.netProfit },
      });
    }

    // 2. Out of stock risk (High Velocity, Low Stock)
    const products = await this.prisma.product.findMany({
      where: { tenantId, status: "active" },
      include: {
        inventoryHistory: {
          orderBy: { time: "desc" },
          take: 1,
        },
      },
    });

    for (const p of products) {
      const currentStock = p.inventoryHistory[0]?.quantity ?? 0;

      if (currentStock > 0 && currentStock < 20) {
        newInsights.push({
          tenantId,
          type: "out_of_stock",
          priority: 2,
          title: `Stok Tükeniyor: ${p.title}`,
          description: `Mevcut stok ${currentStock} adet kaldı. İvmenize göre 3 gün içinde bitebilir.`,
          suggestedAction:
            "Acil tedarik girin veya fiyatı geçici artırarak satışı yavaşlatın.",
          metadata: { productId: p.id, currentStock },
        });
      }
    }

    // Store generated insights (Overwrite old unresolved ones for simplicity in MVP)
    await this.prisma.actionableInsight.deleteMany({
      where: { tenantId, isCompleted: false, isDismissed: false },
    });

    if (newInsights.length > 0) {
      await this.prisma.actionableInsight.createMany({
        data: newInsights,
      });
    }

    return this.getPendingInsights(tenantId);
  }

  async getPendingInsights(tenantId: string) {
    return this.prisma.actionableInsight.findMany({
      where: { tenantId, isCompleted: false, isDismissed: false },
      orderBy: { priority: "asc" },
      take: 10,
    });
  }

  async dismissInsight(insightId: string, tenantId: string) {
    return this.prisma.actionableInsight.update({
      where: { id: insightId, tenantId },
      data: { isDismissed: true },
    });
  }

  async completeInsight(insightId: string, tenantId: string) {
    return this.prisma.actionableInsight.update({
      where: { id: insightId, tenantId },
      data: { isCompleted: true },
    });
  }
}

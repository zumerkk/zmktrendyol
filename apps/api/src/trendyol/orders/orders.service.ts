import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TrendyolService } from "../trendyol.service";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private trendyol: TrendyolService,
  ) {}

  /**
   * Sync orders (shipment packages) from Trendyol
   * Endpoint: GET /integration/order/sellers/{sellerId}/orders
   * Note: Max 3 months history, 1000 req/min limit
   * Best practice: Use PackageLastModifiedDate for incremental sync
   */
  async syncOrders(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ synced: number }> {
    const { client, sellerId } = await this.trendyol.getClient(tenantId);

    // Default: last 24 hours
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    // Verify max 3 months constraint
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() - 3);
    if (start < maxDate) {
      throw new BadRequestException(
        "Trendyol API only supports orders from the last 3 months",
      );
    }

    let page = 0;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await client.get(
        `/integration/order/sellers/${sellerId}/orders`,
        {
          params: {
            startDate: start.getTime(),
            endDate: end.getTime(),
            page,
            size: 200,
            orderByField: "PackageLastModifiedDate",
            orderByDirection: "DESC",
          },
        },
      );

      const packages = res.data?.content || [];
      hasMore = packages.length === 200;
      page++;

      for (const pkg of packages) {
        // Pseudonymize customer name for KVKK
        const customerPseudo = pkg.customerFirstName
          ? `${pkg.customerFirstName.charAt(0)}***`
          : null;

        const order = await this.prisma.order.upsert({
          where: { id: `ty-${pkg.shipmentPackageId}` },
          create: {
            id: `ty-${pkg.shipmentPackageId}`,
            tenantId,
            trendyolOrderNumber: pkg.orderNumber,
            packageNumber: String(pkg.shipmentPackageId),
            status: pkg.status,
            customerNamePseudo: customerPseudo,
            orderDate: new Date(pkg.orderDate),
            totalPrice: pkg.totalPrice || 0,
          },
          update: {
            status: pkg.status,
            updatedAt: new Date(),
          },
        });

        // Sync order items
        for (const line of pkg.lines || []) {
          await this.prisma.orderItem.upsert({
            where: { id: `ty-${line.lineId}` },
            create: {
              id: `ty-${line.lineId}`,
              orderId: order.id,
              barcode: line.barcode,
              quantity: line.quantity,
              unitPrice: line.price || 0,
              amount: line.amount || 0,
            },
            update: {
              quantity: line.quantity,
              unitPrice: line.price || 0,
              amount: line.amount || 0,
            },
          });
        }
        totalSynced++;
      }
    }

    this.logger.log(`Synced ${totalSynced} orders for tenant ${tenantId}`);
    return { synced: totalSynced };
  }

  /**
   * Get orders from local DB
   */
  async getOrders(
    tenantId: string,
    filters?: {
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters?.page || 0;
    const pageSize = filters?.pageSize || 20;

    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      where.orderDate = {};
      if (filters.startDate) where.orderDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.orderDate.lte = new Date(filters.endDate);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip: page * pageSize,
        take: pageSize,
        orderBy: { orderDate: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        page,
        pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}

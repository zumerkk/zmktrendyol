import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * SyncService — Data Warehouse ETL
 * Handles scheduled synchronization jobs and data aggregation
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a sync job record
   */
  async createSyncJob(tenantId: string, type: string) {
    return this.prisma.syncJob.create({
      data: { tenantId, type, isActive: true },
    });
  }

  /**
   * Record a sync job run
   */
  async startJobRun(jobId: string) {
    return this.prisma.syncJobRun.create({
      data: { jobId, status: "running" },
    });
  }

  async completeJobRun(
    runId: string,
    recordsProcessed: number,
    error?: string,
  ) {
    return this.prisma.syncJobRun.update({
      where: { id: runId },
      data: {
        status: error ? "failed" : "completed",
        endedAt: new Date(),
        recordsProcessed,
        error,
      },
    });
  }

  /**
   * Get sync status for a tenant
   */
  async getSyncStatus(tenantId: string) {
    const jobs = await this.prisma.syncJob.findMany({
      where: { tenantId },
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 5,
        },
      },
    });

    return jobs.map((job) => ({
      id: job.id,
      type: job.type,
      isActive: job.isActive,
      lastRun: job.runs[0] || null,
      recentErrors: job.runs.filter((r) => r.status === "failed").length,
    }));
  }

  /**
   * Aggregate daily KPIs from order data
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDailyKPIs() {
    this.logger.log("Starting daily KPI aggregation...");

    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });

    for (const tenant of tenants) {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const endOfDay = new Date(yesterday);
        endOfDay.setHours(23, 59, 59, 999);

        // Get orders for yesterday
        const orders = await this.prisma.order.findMany({
          where: {
            tenantId: tenant.id,
            orderDate: { gte: yesterday, lte: endOfDay },
          },
          include: { items: true },
        });

        const returns = await this.prisma.return.count({
          where: {
            tenantId: tenant.id,
            createdAt: { gte: yesterday, lte: endOfDay },
          },
        });

        const grossRevenue = orders.reduce(
          (sum, o) => sum + Number(o.totalPrice),
          0,
        );
        const units = orders.reduce(
          (sum, o) => sum + o.items.reduce((s, item) => s + item.quantity, 0),
          0,
        );
        const orderCount = orders.length;
        const avgBasket = orderCount > 0 ? grossRevenue / orderCount : 0;

        await this.prisma.kpiDaily.upsert({
          where: {
            date_tenantId: { date: yesterday, tenantId: tenant.id },
          },
          create: {
            date: yesterday,
            tenantId: tenant.id,
            grossRevenue,
            units,
            orders: orderCount,
            returns,
            avgBasket,
          },
          update: {
            grossRevenue,
            units,
            orders: orderCount,
            returns,
            avgBasket,
          },
        });

        this.logger.log(
          `KPI aggregated for tenant ${tenant.id}: revenue=${grossRevenue}, orders=${orderCount}`,
        );
      } catch (error: any) {
        this.logger.error(
          `KPI aggregation failed for tenant ${tenant.id}: ${error.message}`,
        );
      }
    }
  }
}

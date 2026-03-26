import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * AuditService — Denetim İzi (Kipa benzeri "kim ne zaman girdi/çıktı")
 *
 * Records all CUD operations with before/after values
 */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async log(data: {
    tenantId: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    beforeValue?: any;
    afterValue?: any;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs(
    tenantId: string,
    filters?: {
      userId?: string;
      entityType?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters?.page || 0;
    const pageSize = filters?.pageSize || 50;

    const where: any = { tenantId };
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.action)
      where.action = { contains: filters.action, mode: "insensitive" };
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        skip: page * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get user activity summary (who changed what, when)
   */
  async getUserActivity(tenantId: string) {
    const recentLogs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Group by user
    const userActivity = new Map<
      string,
      { user: any; actions: number; lastAction: Date }
    >();
    for (const log of recentLogs) {
      const userId = log.userId || "system";
      const existing = userActivity.get(userId) || {
        user: log.user || { id: "system", name: "System", email: "" },
        actions: 0,
        lastAction: log.createdAt,
      };
      existing.actions++;
      userActivity.set(userId, existing);
    }

    return Array.from(userActivity.values()).sort(
      (a, b) => b.actions - a.actions,
    );
  }

  /**
   * Get price change audit trail
   * "Kim ne zaman fiyat değiştirdi?"
   */
  async getPriceChangeAudit(tenantId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType: "price",
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}

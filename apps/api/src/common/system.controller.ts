import { Controller, Get, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PrismaService } from "./prisma/prisma.service";

/**
 * System Status Controller — Auth required.
 * Comprehensive system status for admin dashboard.
 */
@ApiTags("System")
@Controller("system")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SystemController {
  constructor(private prisma: PrismaService) {}

  @Get("status")
  @ApiOperation({ summary: "Sistem durumu — veritabanı istatistikleri ve son sync bilgileri" })
  async getSystemStatus(@Req() req: any) {
    const tenantId = req.user.tenantId;

    const [
      productCount,
      orderCount,
      returnCount,
      connectionCount,
      userCount,
      lastProduct,
      lastOrder,
      financialTxCount,
    ] = await Promise.all([
      this.prisma.product.count({ where: { tenantId } }),
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.return.count({ where: { tenantId } }),
      this.prisma.sellerConnection.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.product.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      this.prisma.order.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      this.prisma.financialTransaction.count({ where: { tenantId } }),
    ]);

    const memUsage = process.memoryUsage();

    return {
      tenant: {
        id: tenantId,
        users: userCount,
        connections: connectionCount,
      },
      counts: {
        products: productCount,
        orders: orderCount,
        returns: returnCount,
        financialTransactions: financialTxCount,
      },
      lastSync: {
        products: lastProduct?.updatedAt?.toISOString() || null,
        orders: lastOrder?.updatedAt?.toISOString() || null,
      },
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        },
        uptime: `${Math.floor(process.uptime())}s`,
      },
      features: {
        trendyolApi: "apigw.trendyol.com",
        redis: !!process.env.REDIS_URL,
        ai: {
          openai: !!process.env.OPENAI_API_KEY,
          anthropic: !!process.env.ANTHROPIC_API_KEY,
          gemini: !!process.env.GOOGLE_AI_API_KEY,
          groq: !!process.env.GROQ_API_KEY,
        },
        telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      },
    };
  }

  @Get("routes")
  @ApiOperation({ summary: "Tüm API rotalarını listele" })
  async getRoutes() {
    return {
      message: "Full route list available at /api/docs (Swagger UI)",
      docs: "/api/docs",
    };
  }
}

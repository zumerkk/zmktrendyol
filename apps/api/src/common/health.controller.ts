import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PrismaService } from "./prisma/prisma.service";

/**
 * Public Health Controller — No auth required.
 * Used by Render uptime monitoring and external health checks.
 */
@ApiTags("System")
@Controller("health")
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Public health check — no auth required" })
  async healthCheck() {
    const checks: Record<string, any> = {};

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: "up", latency: "ok" };
    } catch {
      checks.database = { status: "down" };
    }

    // Redis check (graceful — may not be available)
    checks.redis = { status: process.env.REDIS_URL ? "configured" : "not_configured" };

    // Trendyol API check
    checks.trendyolGateway = { url: "apigw.trendyol.com", status: "configured" };

    const memUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    const allUp = checks.database.status === "up";

    return {
      status: allUp ? "healthy" : "degraded",
      version: process.env.npm_package_version || "0.2.0",
      environment: process.env.NODE_ENV || "development",
      uptime: {
        seconds: uptimeSeconds,
        human: formatUptime(uptimeSeconds),
      },
      memory: {
        rss: formatBytes(memUsage.rss),
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
      },
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ping")
  @ApiOperation({ summary: "Simple ping — returns pong" })
  ping() {
    return { pong: true, timestamp: Date.now() };
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

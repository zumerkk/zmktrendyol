import { Controller, Get, Post, Body, Query, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AutonomousAgentService } from "./autonomous-agent.service";

/**
 * AutonomousAgentController — Ajan Kontrol API'si
 *
 * GET  /api/agent/status     — Ajan durumu
 * GET  /api/agent/log        — Son çalışma logları
 * GET  /api/agent/insights   — Ajan tarafından oluşturulan insights
 * POST /api/agent/run        — Manuel tetikleme
 * POST /api/agent/toggle     — Ajanı aç/kapat
 */
@ApiTags("Agent")
@Controller("agent")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AutonomousAgentController {
  constructor(private agent: AutonomousAgentService) {}

  @Get("status")
  getStatus() {
    return this.agent.getStatus();
  }

  @Get("log")
  async getLog(
    @Query("tenantId") tenantId: string,
    @Query("limit") limit?: string,
  ) {
    if (!tenantId) {
      return { error: "tenantId is required" };
    }
    return this.agent.getAgentLog(tenantId, limit ? parseInt(limit) : 50);
  }

  @Get("insights")
  async getInsights(
    @Query("tenantId") tenantId: string,
    @Query("limit") limit?: string,
  ) {
    if (!tenantId) {
      return { error: "tenantId is required" };
    }
    return this.agent.getRecentInsights(tenantId, limit ? parseInt(limit) : 20);
  }

  @Post("run")
  async runManually(@Body() body: { tenantId?: string }) {
    return this.agent.runAgentLoop(body.tenantId);
  }

  @Post("toggle")
  toggle(@Body() body: { enabled: boolean }) {
    return this.agent.toggle(body.enabled);
  }
}

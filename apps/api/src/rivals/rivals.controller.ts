import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateRivalTargetDto } from "./dto/create-target.dto";
import { UpdateRivalTargetDto } from "./dto/update-target.dto";
import { RivalsService } from "./rivals.service";

@ApiTags("Rivals")
@Controller("rivals")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RivalsController {
  constructor(private rivals: RivalsService) {}

  @Get("targets")
  list(@Req() req: any) {
    return this.rivals.listTargets(req.user.tenantId);
  }

  @Post("targets")
  create(@Req() req: any, @Body() dto: CreateRivalTargetDto) {
    return this.rivals.createTarget(req.user.tenantId, dto);
  }

  @Put("targets/:id")
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateRivalTargetDto) {
    return this.rivals.updateTarget(req.user.tenantId, id, dto);
  }

  @Delete("targets/:id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.rivals.deleteTarget(req.user.tenantId, id);
  }

  @Get("targets/:id/summary")
  summary(@Req() req: any, @Param("id") id: string) {
    return this.rivals.getLatestSummary(req.user.tenantId, id);
  }

  /** Scan gecmisi — son 30 tarama */
  @Get("targets/:id/history")
  history(@Req() req: any, @Param("id") id: string) {
    return this.rivals.getScanHistory(req.user.tenantId, id);
  }

  /** Degisiklik olaylari timeline */
  @Get("targets/:id/events")
  events(@Req() req: any, @Param("id") id: string) {
    return this.rivals.getChangeEvents(req.user.tenantId, id);
  }

  /** Tum alarmlar (aktif + gecmis) */
  @Get("targets/:id/alerts")
  alerts(@Req() req: any, @Param("id") id: string) {
    return this.rivals.getAllAlerts(req.user.tenantId, id);
  }

  /** AI analiz yorumu */
  @Get("targets/:id/ai-analysis")
  aiAnalysis(@Req() req: any, @Param("id") id: string) {
    return this.rivals.getAiAnalysis(req.user.tenantId, id);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 30000 } })
  @Post("targets/:id/scan-now")
  scanNow(@Req() req: any, @Param("id") id: string) {
    return this.rivals.scanTargetNow(req.user.tenantId, id);
  }

  @Get("targets/:id/profit")
  profit(@Req() req: any, @Param("id") id: string) {
    return this.rivals.getProfitSummaryForTarget(req.user.tenantId, id);
  }

  @Get("our-products")
  searchProducts(@Req() req: any, @Query("q") q: string) {
    return this.rivals.searchOurProducts(req.user.tenantId, q || "");
  }
}

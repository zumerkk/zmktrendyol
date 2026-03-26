import { Controller, Get, Query, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuditService } from "./audit.service";

@ApiTags("Audit")
@Controller("audit")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get("logs")
  async getLogs(
    @Req() req: any,
    @Query("userId") userId?: string,
    @Query("entityType") entityType?: string,
    @Query("action") action?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number,
  ) {
    return this.auditService.getLogs(req.user.tenantId, {
      userId,
      entityType,
      action,
      startDate,
      endDate,
      page,
      pageSize,
    });
  }

  @Get("user-activity")
  async getUserActivity(@Req() req: any) {
    return this.auditService.getUserActivity(req.user.tenantId);
  }

  @Get("price-changes")
  async getPriceChanges(@Req() req: any) {
    return this.auditService.getPriceChangeAudit(req.user.tenantId);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ContextService } from "./context.service";
import { ExtensionJobService } from "./extension-job.service";

@ApiTags("Extension")
@Controller("extension")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExtensionController {
  constructor(
    private contextService: ContextService,
    private readonly jobService: ExtensionJobService
  ) { }

  @Post("match")
  async matchProduct(@Req() req: any, @Body() dto: { url: string }) {
    return this.contextService.matchProduct(req.user.tenantId, dto.url);
  }

  @Get("overlay-kpi")
  async getOverlayKPI(@Req() req: any, @Query("productId") productId: string) {
    return this.contextService.getOverlayKPI(req.user.tenantId, productId);
  }

  @Get("jobs/next")
  async getNextJob(@Req() req: any) {
    const job = await this.jobService.getNextJob(req.user.tenantId);
    return { success: true, job };
  }

  @Post("jobs/:jobId/result")
  async submitJobResult(
    @Req() req: any,
    @Body() resultData: any,
    @Param("jobId") jobId: string
  ) {
    const result = await this.jobService.handleJobResult(req.user.tenantId, jobId, resultData);
    return { success: true, result };
  }
}

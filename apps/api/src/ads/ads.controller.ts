import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdsService } from "./ads.service";
import { AdAutopilotService } from "./ad-autopilot.service";

@ApiTags("Ads")
@Controller("ads")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdsController {
  constructor(
    private adsService: AdsService,
    private adAutopilot: AdAutopilotService,
  ) {}

  // ═══════════════════════════════════════════════
  // Campaigns
  // ═══════════════════════════════════════════════

  @Post("campaigns/sync")
  @ApiOperation({ summary: "Sync campaigns from Trendyol Ads API" })
  async syncCampaigns(@Req() req: any) {
    return this.adsService.syncCampaigns(req.user.tenantId);
  }

  @Get("campaigns")
  @ApiOperation({ summary: "Get all ad campaigns" })
  async getCampaigns(@Req() req: any) {
    return this.adsService.getCampaigns(req.user.tenantId);
  }

  @Post("campaigns")
  @ApiOperation({ summary: "Create campaign manually" })
  async createCampaign(
    @Req() req: any,
    @Body()
    dto: {
      name: string;
      trendyolCampaignId?: string;
      budgetDaily?: number;
      budgetTotal?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.adsService.createCampaign(req.user.tenantId, dto);
  }

  @Delete("campaigns/:id")
  @ApiOperation({ summary: "Delete a campaign and all related data" })
  async deleteCampaign(@Param("id") id: string) {
    return this.adsService.deleteCampaign(id);
  }

  // ═══════════════════════════════════════════════
  // Keywords & Performance
  // ═══════════════════════════════════════════════

  @Post("campaigns/:id/keywords")
  @ApiOperation({ summary: "Record keyword performance data" })
  async recordKeywordPerformance(
    @Param("id") id: string,
    @Body()
    data: {
      keyword: string;
      matchType?: string;
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      orders: number;
      searchRank?: number;
      adRank?: number;
      date: string;
    },
  ) {
    return this.adsService.recordKeywordPerformance(id, data);
  }

  @Get("campaigns/:id/keywords")
  @ApiOperation({ summary: "Get keyword performances for a campaign" })
  async getKeywordPerformances(
    @Param("id") id: string,
    @Query("days") days?: number,
  ) {
    return this.adsService.getKeywordPerformances(id, days);
  }

  // ═══════════════════════════════════════════════
  // Daily Metrics
  // ═══════════════════════════════════════════════

  @Post("campaigns/:id/daily-metrics")
  @ApiOperation({ summary: "Record daily ad metrics" })
  async recordDailyMetrics(
    @Param("id") id: string,
    @Body()
    data: {
      date: string;
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      orders: number;
    },
  ) {
    return this.adsService.recordDailyMetrics(id, data);
  }

  @Get("campaigns/:id/daily-metrics")
  @ApiOperation({ summary: "Get daily metrics for a campaign" })
  async getDailyMetrics(@Param("id") id: string, @Query("days") days?: number) {
    return this.adsService.getDailyMetrics(id, days);
  }

  // ═══════════════════════════════════════════════
  // Analytics
  // ═══════════════════════════════════════════════

  @Get("acos")
  @ApiOperation({ summary: "Get ACOS analysis across all campaigns" })
  async getACOSAnalysis(@Req() req: any, @Query("days") days?: number) {
    return this.adsService.getACOSAnalysis(req.user.tenantId, days);
  }

  @Get("summary")
  @ApiOperation({ summary: "Get overall ad performance summary" })
  async getPerformanceSummary(@Req() req: any) {
    return this.adsService.getPerformanceSummary(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // AI Autopilot
  // ═══════════════════════════════════════════════

  @Get("autopilot")
  @ApiOperation({ summary: "AI Reklam Otopilot — kampanya sağlık skoru + öneriler" })
  async getAutopilotDashboard(@Req() req: any) {
    return this.adAutopilot.getAutopilotDashboard(req.user.tenantId);
  }

  @Get("autopilot/bids/:campaignId")
  @ApiOperation({ summary: "Bid optimizasyon önerileri — altın/gümüş/israf kelimeler" })
  async getBidSuggestions(@Req() req: any, @Param("campaignId") id: string) {
    return this.adAutopilot.getBidSuggestions(req.user.tenantId, id);
  }

  @Get("autopilot/candidates")
  @ApiOperation({ summary: "Hangi ürünler reklam yapmalı? — marj bazlı öneri" })
  async getAdCandidates(@Req() req: any) {
    return this.adAutopilot.getAdCandidates(req.user.tenantId);
  }
}

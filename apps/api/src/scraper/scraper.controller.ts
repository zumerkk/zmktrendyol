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
import { ScraperEngineService } from "./scraper-engine.service";
import { MarketIntelligenceService } from "./market-intelligence.service";

@ApiTags("Scraper")
@Controller("scraper")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScraperController {
  constructor(
    private scraperEngine: ScraperEngineService,
    private marketIntelligence: MarketIntelligenceService,
  ) {}

  // ═══════════════════════════════════════════════
  // Scrape Targets
  // ═══════════════════════════════════════════════

  @Post("targets")
  @ApiOperation({ summary: "Add a new scrape target" })
  async addTarget(
    @Req() req: any,
    @Body()
    dto: {
      url: string;
      type: "product_page" | "search_results" | "best_sellers" | "seller_page";
      label?: string;
      intervalMinutes?: number;
    },
  ) {
    return this.scraperEngine.addTarget(req.user.tenantId, dto);
  }

  @Get("targets")
  @ApiOperation({ summary: "Get all scrape targets" })
  async getTargets(@Req() req: any) {
    return this.scraperEngine.getTargets(req.user.tenantId);
  }

  @Delete("targets/:id")
  @ApiOperation({ summary: "Remove a scrape target" })
  async removeTarget(@Param("id") id: string) {
    return this.scraperEngine.removeTarget(id);
  }

  // ═══════════════════════════════════════════════
  // Manual Scrape
  // ═══════════════════════════════════════════════

  @Post("run/:targetId")
  @ApiOperation({ summary: "Manually trigger a scrape for a target" })
  async runScrape(@Param("targetId") targetId: string) {
    return this.scraperEngine.scrapeTarget(targetId);
  }

  @Get("results/:targetId")
  @ApiOperation({ summary: "Get scrape results for a target" })
  async getResults(
    @Param("targetId") targetId: string,
    @Query("limit") limit?: number,
  ) {
    return this.scraperEngine.getResults(targetId, limit);
  }

  @Get("stats")
  @ApiOperation({ summary: "Get scraping statistics" })
  async getStats(@Req() req: any) {
    return this.scraperEngine.getStats(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Market Intelligence
  // ═══════════════════════════════════════════════

  @Get("market/sales-estimate/:competitorProductId")
  @ApiOperation({
    summary: "Estimate competitor sales using multi-signal model",
  })
  async estimateSales(
    @Param("competitorProductId") id: string,
    @Query("days") days?: number,
  ) {
    return this.marketIntelligence.estimateCompetitorSales(id, days);
  }

  @Get("market/trends")
  @ApiOperation({ summary: "Get market trends" })
  async getMarketTrends(
    @Req() req: any,
    @Query("categoryId") categoryId?: number,
  ) {
    return this.marketIntelligence.getMarketTrends(
      req.user.tenantId,
      categoryId,
    );
  }

  @Post("market/snapshot")
  @ApiOperation({ summary: "Save a market snapshot" })
  async saveMarketSnapshot(
    @Req() req: any,
    @Body()
    data: {
      categoryId?: number;
      type: "best_sellers" | "trending" | "price_distribution";
      data: any;
      source?: string;
    },
  ) {
    return this.marketIntelligence.saveMarketSnapshot(req.user.tenantId, data);
  }

  @Get("market/seller-performance")
  @ApiOperation({ summary: "Track seller/store performance" })
  async trackSellerPerformance(
    @Req() req: any,
    @Query("sellerUrl") sellerUrl: string,
  ) {
    return this.marketIntelligence.trackSellerPerformance(
      req.user.tenantId,
      sellerUrl,
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TrackerService } from "./tracker.service";
import { StockProbeService } from "./stock-probe.service";
import { BuyboxService } from "./buybox.service";
import { DynamicPricingService } from "./dynamic-pricing.service";

@ApiTags("Competitor")
@Controller("competitors")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompetitorController {
  constructor(
    private trackerService: TrackerService,
    private stockProbeService: StockProbeService,
    private buyboxService: BuyboxService,
    private dynamicPricingService: DynamicPricingService,
  ) {}

  // ═══════════════════════════════════════════════
  // Competitor Tracking (Mevcut)
  // ═══════════════════════════════════════════════

  @Post()
  @ApiOperation({ summary: "Add a competitor product to track" })
  async addCompetitor(
    @Req() req: any,
    @Body()
    dto: { url: string; title?: string; brand?: string; category?: string },
  ) {
    return this.trackerService.addCompetitor(req.user.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Get tracked competitors" })
  async getCompetitors(@Req() req: any) {
    return this.trackerService.getCompetitors(req.user.tenantId);
  }

  @Get(":id/price-history")
  @ApiOperation({ summary: "Get competitor price history" })
  async getPriceHistory(
    @Param("id") id: string,
    @Query("months") months?: number,
  ) {
    return this.trackerService.getCompetitorPriceHistory(id, months);
  }

  @Get(":id/sales-estimate")
  @ApiOperation({ summary: "Estimate competitor sales from review delta" })
  async getSalesEstimate(@Param("id") id: string) {
    return this.trackerService.estimateSales(id);
  }

  @Post(":id/snapshot")
  @ApiOperation({ summary: "Record a competitor snapshot" })
  async recordSnapshot(
    @Param("id") id: string,
    @Body()
    data: {
      price?: number;
      rating?: number;
      reviewCount?: number;
      inStock?: boolean;
      deliveryInfo?: string;
    },
  ) {
    return this.trackerService.recordSnapshot(id, data);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove a tracked competitor" })
  async removeCompetitor(@Req() req: any, @Param("id") id: string) {
    return this.trackerService.removeCompetitor(req.user.tenantId, id);
  }

  // ═══════════════════════════════════════════════
  // Stock Probe (Gölge Stok Takibi)
  // ═══════════════════════════════════════════════

  @Post(":id/enable-stock-probe")
  @ApiOperation({ summary: "Enable stock probing for a competitor product" })
  async enableStockProbe(
    @Param("id") id: string,
    @Body() dto: { intervalMinutes?: number },
  ) {
    return this.stockProbeService.enableProbe(id, dto.intervalMinutes);
  }

  @Post(":id/disable-stock-probe")
  @ApiOperation({ summary: "Disable stock probing" })
  async disableStockProbe(@Param("id") id: string) {
    return this.stockProbeService.disableProbe(id);
  }

  @Get(":id/stock-history")
  @ApiOperation({ summary: "Get stock level history from probes" })
  async getStockHistory(
    @Param("id") id: string,
    @Query("hours") hours?: number,
  ) {
    return this.stockProbeService.getStockHistory(id, hours);
  }

  @Get(":id/stock-sales")
  @ApiOperation({ summary: "Calculate sales from stock delta (100% accuracy)" })
  async getStockSales(@Param("id") id: string, @Query("hours") hours?: number) {
    return this.stockProbeService.calculateSalesFromStockDelta(id, hours);
  }

  @Get("probes/active")
  @ApiOperation({ summary: "Get all active stock probes" })
  async getActiveProbes(@Req() req: any) {
    return this.stockProbeService.getActiveProbes(req.user.tenantId);
  }

  @Post(":id/probe-now")
  @ApiOperation({ summary: "Manually trigger a stock probe (instant)" })
  async triggerManualProbe(@Param("id") id: string) {
    return this.stockProbeService.triggerManualProbe(id);
  }

  // ═══════════════════════════════════════════════
  // Buybox Monitoring
  // ═══════════════════════════════════════════════

  @Post(":id/buybox/enable")
  @ApiOperation({ summary: "Enable buybox monitoring for a product" })
  async enableBuyboxMonitoring(@Param("id") id: string) {
    return this.buyboxService.enableMonitoring(id);
  }

  @Post(":id/buybox/snapshot")
  @ApiOperation({ summary: "Record a buybox snapshot" })
  async recordBuyboxSnapshot(
    @Param("id") id: string,
    @Body()
    data: {
      buyboxHolder?: string;
      buyboxPrice?: number;
      totalSellers?: number;
      ourPosition?: number;
      isOurBuybox?: boolean;
      sellersData?: any;
    },
  ) {
    return this.buyboxService.recordSnapshot(id, data);
  }

  @Get(":id/buybox-history")
  @ApiOperation({ summary: "Get buybox history with ownership stats" })
  async getBuyboxHistory(
    @Param("id") id: string,
    @Query("hours") hours?: number,
  ) {
    return this.buyboxService.getBuyboxHistory(id, hours);
  }

  @Get("buybox/status")
  @ApiOperation({ summary: "Current buybox status for all tracked products" })
  async getBuyboxStatus(@Req() req: any) {
    return this.buyboxService.getCurrentBuyboxStatus(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Dynamic Pricing
  // ═══════════════════════════════════════════════

  @Post("pricing/rules")
  @ApiOperation({ summary: "Create a dynamic pricing rule" })
  async createPricingRule(
    @Req() req: any,
    @Body()
    dto: {
      productId: string;
      strategy: "undercut" | "match" | "margin_target";
      minPrice: number;
      maxPrice: number;
      targetMargin?: number;
      undercutAmount?: number;
      autoApply?: boolean;
    },
  ) {
    return this.dynamicPricingService.createRule(req.user.tenantId, dto);
  }

  @Get("pricing/rules")
  @ApiOperation({ summary: "Get all pricing rules" })
  async getPricingRules(@Req() req: any) {
    return this.dynamicPricingService.getRules(req.user.tenantId);
  }

  @Put("pricing/rules/:ruleId")
  @ApiOperation({ summary: "Update a pricing rule" })
  async updatePricingRule(@Param("ruleId") ruleId: string, @Body() dto: any) {
    return this.dynamicPricingService.updateRule(ruleId, dto);
  }

  @Delete("pricing/rules/:ruleId")
  @ApiOperation({ summary: "Delete a pricing rule" })
  async deletePricingRule(@Param("ruleId") ruleId: string) {
    return this.dynamicPricingService.deleteRule(ruleId);
  }

  @Get("pricing/rules/:ruleId/actions")
  @ApiOperation({ summary: "Get pricing action log" })
  async getPricingActions(
    @Param("ruleId") ruleId: string,
    @Query("limit") limit?: number,
  ) {
    return this.dynamicPricingService.getActionLog(ruleId, limit);
  }

  @Get("pricing/pending")
  @ApiOperation({ summary: "Get pending price changes awaiting approval" })
  async getPendingActions(@Req() req: any) {
    return this.dynamicPricingService.getPendingActions(req.user.tenantId);
  }

  @Post("pricing/actions/:actionId/apply")
  @ApiOperation({ summary: "Apply a pending price change" })
  async applyPriceChange(@Req() req: any, @Param("actionId") actionId: string) {
    return this.dynamicPricingService.applyPriceChange(
      req.user.tenantId,
      actionId,
    );
  }

  @Post("pricing/actions/:actionId/reject")
  @ApiOperation({ summary: "Reject a pending price change" })
  async rejectPriceChange(@Param("actionId") actionId: string) {
    return this.dynamicPricingService.rejectPriceChange(actionId);
  }
}

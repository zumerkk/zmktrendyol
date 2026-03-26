import { Controller, Get, Param, Query, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { KpiService } from "./kpi.service";
import { ProfitabilityService } from "./profitability.service";
import { RestockingService } from "./restocking.service";

@ApiTags("Analytics")
@Controller("analytics")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(
    private kpiService: KpiService,
    private profitabilityService: ProfitabilityService,
    private restockingService: RestockingService,
  ) {}

  // ════════════════════════════════════════════════
  //  KPI Endpoints (Existing)
  // ════════════════════════════════════════════════

  @Get("summary")
  @ApiOperation({ summary: "Genel KPI özeti" })
  async getSummary(@Req() req: any) {
    return this.kpiService.getSummary(req.user.tenantId);
  }

  @Get("daily")
  @ApiOperation({ summary: "Günlük KPI verileri" })
  async getDailyKPIs(
    @Req() req: any,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const end = endDate || new Date().toISOString();
    const start =
      startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return this.kpiService.getDailyKPIs(req.user.tenantId, start, end);
  }

  @Get("monthly")
  @ApiOperation({ summary: "Aylık KPI verileri" })
  async getMonthlyKPIs(@Req() req: any, @Query("months") months?: number) {
    return this.kpiService.getMonthlyKPIs(req.user.tenantId, months);
  }

  @Get("top-products")
  @ApiOperation({ summary: "En çok satan ürünler" })
  async getTopProducts(@Req() req: any, @Query("limit") limit?: number) {
    return this.kpiService.getTopProducts(req.user.tenantId, limit);
  }

  @Get("heatmap")
  @ApiOperation({ summary: "Sipariş yoğunluk haritası" })
  async getOrderHeatmap(@Req() req: any, @Query("days") days?: number) {
    return this.kpiService.getOrderHeatmap(req.user.tenantId, days);
  }

  // ════════════════════════════════════════════════
  //  P&L (Profitability) Endpoints
  // ════════════════════════════════════════════════

  @Get("profitability/:productId")
  @ApiOperation({ summary: "SKU bazında Kar/Zarar analizi" })
  async getProductProfitability(
    @Req() req: any,
    @Param("productId") productId: string,
    @Query("months") months?: number,
  ) {
    return this.profitabilityService.calculateProductPL(productId, months || 3);
  }

  @Get("profitability")
  @ApiOperation({ summary: "Tüm ürünlerin Kar/Zarar dashboard'u" })
  async getProfitabilityDashboard(@Req() req: any) {
    return this.profitabilityService.calculateTenantPL(req.user.tenantId);
  }

  // ════════════════════════════════════════════════
  //  Restocking Endpoints
  // ════════════════════════════════════════════════

  @Get("restocking")
  @ApiOperation({ summary: "Stok yenileme uyarıları ve tahminleri" })
  async getRestockingAlerts(@Req() req: any) {
    return this.restockingService.getRestockingPredictions(req.user.tenantId);
  }

  @Get("restocking/:productId")
  @ApiOperation({ summary: "Tek ürün stok tahmini" })
  async getProductRestocking(
    @Req() req: any,
    @Param("productId") productId: string,
  ) {
    return this.restockingService.getProductPrediction(productId);
  }
}

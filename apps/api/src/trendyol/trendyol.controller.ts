import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TrendyolService } from "./trendyol.service";
import { ProductsService } from "./products/products.service";
import { OrdersService } from "./orders/orders.service";
import { InventoryService } from "./inventory/inventory.service";
import { FinanceService } from "./finance/finance.service";
import { ClaimsService } from "./claims/claims.service";

@ApiTags("Trendyol")
@Controller("trendyol")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrendyolController {
  constructor(
    private trendyolService: TrendyolService,
    private productsService: ProductsService,
    private ordersService: OrdersService,
    private inventoryService: InventoryService,
    private financeService: FinanceService,
    private claimsService: ClaimsService,
  ) {}

  // ─── Health ─────────────────────────────────
  @Get("health")
  async healthCheck(@Req() req: any) {
    return this.trendyolService.healthCheck(req.user.tenantId);
  }

  // ─── Products ───────────────────────────────
  @Post("products/sync")
  async syncProducts(@Req() req: any) {
    return this.productsService.syncProducts(req.user.tenantId);
  }

  @Get("products")
  async getProducts(
    @Req() req: any,
    @Query("category") category?: string,
    @Query("brand") brand?: string,
    @Query("status") status?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number,
  ) {
    return this.productsService.getProducts(req.user.tenantId, {
      category,
      brand,
      status,
      page,
      pageSize,
    });
  }

  @Get("products/:id")
  async getProductDetail(@Req() req: any, @Param("id") id: string) {
    return this.productsService.getProductDetail(req.user.tenantId, id);
  }

  @Post("categories/sync")
  async syncCategories(@Req() req: any) {
    return this.productsService.syncCategories(req.user.tenantId);
  }

  @Post("brands/sync")
  async syncBrands(@Req() req: any) {
    return this.productsService.syncBrands(req.user.tenantId);
  }

  // ─── Orders ─────────────────────────────────
  @Post("orders/sync")
  async syncOrders(@Req() req: any) {
    return this.ordersService.syncOrders(req.user.tenantId);
  }

  @Get("orders")
  async getOrders(
    @Req() req: any,
    @Query("status") status?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number,
  ) {
    return this.ordersService.getOrders(req.user.tenantId, {
      status,
      startDate,
      endDate,
      page,
      pageSize,
    });
  }

  // ─── Stock & Price ──────────────────────────
  @Post("inventory/update")
  async updatePriceAndInventory(
    @Req() req: any,
    @Body()
    dto: {
      items: Array<{
        barcode: string;
        listPrice: number;
        salePrice: number;
        quantity: number;
      }>;
    },
  ) {
    return this.inventoryService.updatePriceAndInventory(
      req.user.tenantId,
      req.user.id,
      dto.items,
    );
  }

  @Get("inventory/batch/:batchId")
  async checkBatch(@Req() req: any, @Param("batchId") batchId: string) {
    return this.inventoryService.checkBatchResult(req.user.tenantId, batchId);
  }

  @Get("inventory/price-history/:productId")
  async getPriceHistory(
    @Req() req: any,
    @Param("productId") productId: string,
    @Query("months") months?: number,
  ) {
    return this.inventoryService.getPriceHistory(
      req.user.tenantId,
      productId,
      months,
    );
  }

  @Get("inventory/price-extremes/:productId")
  async getPriceExtremes(
    @Req() req: any,
    @Param("productId") productId: string,
    @Query("months") months?: number,
  ) {
    return this.inventoryService.getPriceExtremes(
      req.user.tenantId,
      productId,
      months,
    );
  }

  @Get("inventory/stock-breakage/:productId")
  async getStockBreakage(
    @Req() req: any,
    @Param("productId") productId: string,
  ) {
    return this.inventoryService.estimateStockBreakage(
      req.user.tenantId,
      productId,
    );
  }

  // ─── Finance / Cari Hesap ───────────────────
  @Post("finance/sync")
  @ApiOperation({ summary: "Trendyol cari hesap verilerini senkronize et" })
  async syncFinance(
    @Req() req: any,
    @Body() dto?: { startDate?: string; endDate?: string },
  ) {
    return this.financeService.syncFinancialTransactions(
      req.user.tenantId,
      dto?.startDate ? new Date(dto.startDate) : undefined,
      dto?.endDate ? new Date(dto.endDate) : undefined,
    );
  }

  @Get("finance/summary")
  @ApiOperation({ summary: "Finansal özet — gelir/gider/net, günlük akış" })
  async getFinancialSummary(
    @Req() req: any,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.financeService.getFinancialSummary(
      req.user.tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get("finance/commission-check")
  @ApiOperation({ summary: "Komisyon doğrulama — gerçek vs beklenen" })
  async verifyCommissions(
    @Req() req: any,
    @Query("days") days?: number,
  ) {
    return this.financeService.verifyCommissions(req.user.tenantId, days);
  }

  @Get("finance/cash-flow")
  @ApiOperation({ summary: "Nakit akışı projeksiyonu — 30/60/90 gün" })
  async getCashFlowProjection(@Req() req: any) {
    return this.financeService.getCashFlowProjection(req.user.tenantId);
  }

  @Get("finance/payment-calendar")
  @ApiOperation({ summary: "Ödeme takvimi — geçmiş ve gelecek ödemeler" })
  async getPaymentCalendar(@Req() req: any) {
    return this.financeService.getPaymentCalendar(req.user.tenantId);
  }

  // ─── Claims / Returns ──────────────────────
  @Post("claims/sync")
  @ApiOperation({ summary: "Trendyol iade/talep verilerini senkronize et" })
  async syncClaims(
    @Req() req: any,
    @Body() dto?: { startDate?: string; endDate?: string },
  ) {
    return this.claimsService.syncClaims(
      req.user.tenantId,
      dto?.startDate ? new Date(dto.startDate) : undefined,
      dto?.endDate ? new Date(dto.endDate) : undefined,
    );
  }

  @Get("claims/analytics")
  @ApiOperation({ summary: "İade analitiği — sebep dağılımı, maliyet, öneriler" })
  async getReturnAnalytics(
    @Req() req: any,
    @Query("days") days?: number,
  ) {
    return this.claimsService.getReturnAnalytics(req.user.tenantId, days);
  }

  // ─── Full Sync ──────────────────────────────
  @Post("full-sync")
  @ApiOperation({
    summary: "Tam senkronizasyon — ürünler + siparişler + kategoriler + markalar",
  })
  async fullSync(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const results: any = { timestamp: new Date().toISOString() };

    // 1. Products
    try {
      let page = 0;
      let totalSynced = 0;
      let hasMore = true;
      while (hasMore) {
        const r = await this.productsService.syncProducts(tenantId, page, 200);
        totalSynced += r.synced;
        hasMore = r.synced === 200;
        page++;
      }
      results.products = { synced: totalSynced, status: "success" };
    } catch (error: any) {
      results.products = { synced: 0, status: "failed", error: error.message };
    }

    // 2. Orders (last 7 days)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const r = await this.ordersService.syncOrders(tenantId, sevenDaysAgo);
      results.orders = { synced: r.synced, status: "success" };
    } catch (error: any) {
      results.orders = { synced: 0, status: "failed", error: error.message };
    }

    // 3. Categories
    try {
      const r = await this.productsService.syncCategories(tenantId);
      results.categories = { synced: r.synced, status: "success" };
    } catch (error: any) {
      results.categories = { synced: 0, status: "failed", error: error.message };
    }

    // 4. Brands
    try {
      const r = await this.productsService.syncBrands(tenantId);
      results.brands = { synced: r.synced, status: "success" };
    } catch (error: any) {
      results.brands = { synced: 0, status: "failed", error: error.message };
    }

    return results;
  }
}

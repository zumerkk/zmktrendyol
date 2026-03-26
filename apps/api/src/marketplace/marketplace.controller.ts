import {
  Controller, Get, Post, Body, Param, Query, UseGuards, Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { HepsiburadaService } from "./hepsiburada.service";
import { N11Service } from "./n11.service";
import { AmazonTurkeyService } from "./amazon-turkey.service";
import { CrossPlatformAnalyticsService } from "./cross-platform-analytics.service";

@ApiTags("Marketplace")
@Controller("marketplace")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketplaceController {
  constructor(
    private hepsiburada: HepsiburadaService,
    private n11: N11Service,
    private amazon: AmazonTurkeyService,
    private crossPlatform: CrossPlatformAnalyticsService,
  ) {}

  // ═══════════════════════════════════════════════
  // Cross-Platform
  // ═══════════════════════════════════════════════

  @Get("dashboard")
  @ApiOperation({ summary: "Tüm platformlar birleşik dashboard" })
  async getUnifiedDashboard(@Req() req: any) {
    return this.crossPlatform.getUnifiedDashboard(req.user.tenantId);
  }

  @Get("comparison")
  @ApiOperation({ summary: "Ürün bazlı platform karşılaştırması" })
  async getProductComparison(@Req() req: any) {
    return this.crossPlatform.getProductPlatformComparison(req.user.tenantId);
  }

  @Get("price-consistency")
  @ApiOperation({ summary: "Çapraz platform fiyat tutarlılığı" })
  async checkPriceConsistency(@Req() req: any) {
    return this.crossPlatform.checkPriceConsistency(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Hepsiburada
  // ═══════════════════════════════════════════════

  @Post("hepsiburada/connect")
  @ApiOperation({ summary: "Hepsiburada bağlantısı kur" })
  async connectHepsiburada(@Req() req: any, @Body() dto: any) {
    return this.hepsiburada.connect(req.user.tenantId, dto);
  }

  @Get("hepsiburada/status")
  @ApiOperation({ summary: "Hepsiburada bağlantı durumu" })
  async getHepsiburadaStatus(@Req() req: any) {
    return this.hepsiburada.getStatus(req.user.tenantId);
  }

  @Post("hepsiburada/sync/products")
  @ApiOperation({ summary: "Hepsiburada ürün senkronizasyonu" })
  async syncHepsiburadaProducts(@Req() req: any) {
    return this.hepsiburada.syncProducts(req.user.tenantId);
  }

  @Post("hepsiburada/sync/orders")
  @ApiOperation({ summary: "Hepsiburada sipariş senkronizasyonu" })
  async syncHepsiburadaOrders(@Req() req: any) {
    return this.hepsiburada.syncOrders(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // N11
  // ═══════════════════════════════════════════════

  @Post("n11/connect")
  @ApiOperation({ summary: "N11 bağlantısı kur" })
  async connectN11(@Req() req: any, @Body() dto: any) {
    return this.n11.connect(req.user.tenantId, dto);
  }

  @Get("n11/status")
  @ApiOperation({ summary: "N11 bağlantı durumu" })
  async getN11Status(@Req() req: any) {
    return this.n11.getStatus(req.user.tenantId);
  }

  @Post("n11/sync/products")
  @ApiOperation({ summary: "N11 ürün senkronizasyonu" })
  async syncN11Products(@Req() req: any) {
    return this.n11.syncProducts(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Amazon TR
  // ═══════════════════════════════════════════════

  @Post("amazon-tr/connect")
  @ApiOperation({ summary: "Amazon Türkiye bağlantısı kur" })
  async connectAmazon(@Req() req: any, @Body() dto: any) {
    return this.amazon.connect(req.user.tenantId, dto);
  }

  @Get("amazon-tr/status")
  @ApiOperation({ summary: "Amazon TR bağlantı durumu" })
  async getAmazonStatus(@Req() req: any) {
    return this.amazon.getStatus(req.user.tenantId);
  }

  @Get("amazon-tr/buybox")
  @ApiOperation({ summary: "Amazon Buy Box durumu" })
  async getBuyBoxStatus(@Req() req: any) {
    return this.amazon.getBuyBoxStatus(req.user.tenantId);
  }
}

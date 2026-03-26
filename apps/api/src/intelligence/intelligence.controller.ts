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
import { AbTestService } from "./ab-test.service";
import { ProductResearchService } from "./product-research.service";
import { WarRoomService } from "./war-room.service";
import { ChatAssistantService } from "./chat-assistant.service";
import { MlPredictionService } from "./ml-prediction.service";
import { GameTheoryPricingService } from "./game-theory-pricing.service";
import { CustomerAnalyticsService } from "./customer-analytics.service";
import { MarketplaceHubService } from "./marketplace-hub.service";
import { SubscriptionService } from "./subscription.service";
import { TrendHeatmapService } from "./trend-heatmap.service";
import { CompetitorDnaService } from "./competitor-dna.service";
import { PriceWarSimulatorService } from "./price-war-simulator.service";
import { DemandForecastService } from "./demand-forecast.service";
import { PriceIntelligenceService } from "./price-intelligence.service";
import { CategoryRadarService } from "./category-radar.service";
import { StrategicAdvisorService } from "./strategic-advisor.service";
import { GamificationService } from "./gamification.service";
import { SupplierDiscoveryService } from "./supplier-discovery.service";

@ApiTags("Intelligence")
@Controller("intelligence")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntelligenceController {
  constructor(
    private abTest: AbTestService,
    private productResearch: ProductResearchService,
    private warRoom: WarRoomService,
    private chatAssistant: ChatAssistantService,
    private mlPrediction: MlPredictionService,
    private gameTheory: GameTheoryPricingService,
    private customerAnalytics: CustomerAnalyticsService,
    private marketplaceHub: MarketplaceHubService,
    private subscription: SubscriptionService,
    private trendHeatmap: TrendHeatmapService,
    private competitorDna: CompetitorDnaService,
    private priceWarSimulator: PriceWarSimulatorService,
    private demandForecast: DemandForecastService,
    private priceIntelligence: PriceIntelligenceService,
    private categoryRadar: CategoryRadarService,
    private strategicAdvisor: StrategicAdvisorService,
    private gamification: GamificationService,
    private supplierDiscovery: SupplierDiscoveryService,
  ) { }

  // ═══════════════════════════════════════════════
  // A/B Testing
  // ═══════════════════════════════════════════════

  @Post("ab-test")
  @ApiOperation({ summary: "Create A/B test with AI-generated variants" })
  async createAbTest(@Req() req: any, @Body() dto: any) {
    return this.abTest.createTest(req.user.tenantId, dto);
  }

  @Get("ab-tests")
  @ApiOperation({ summary: "Get all A/B tests" })
  async getAbTests(@Req() req: any, @Query("status") status?: string) {
    return this.abTest.getTests(req.user.tenantId, status);
  }

  @Get("ab-test/:id")
  @ApiOperation({ summary: "Get A/B test results" })
  async getAbTestResults(@Param("id") id: string) {
    return this.abTest.getTestResults(id);
  }

  @Post("ab-test/:id/end")
  @ApiOperation({ summary: "End test and pick winner" })
  async endAbTest(@Param("id") id: string) {
    return this.abTest.endTest(id);
  }

  @Post("ab-test/:id/metric")
  @ApiOperation({ summary: "Record variant metric" })
  async recordVariantMetric(@Param("id") id: string, @Body() dto: any) {
    return this.abTest.recordVariantMetric(id, dto.variantId, dto);
  }

  // ═══════════════════════════════════════════════
  // Product Research
  // ═══════════════════════════════════════════════

  @Post("research")
  @ApiOperation({ summary: "Analyze category/keyword opportunity" })
  async analyzeOpportunity(@Req() req: any, @Body() dto: any) {
    return this.productResearch.analyzeOpportunity(req.user.tenantId, dto);
  }

  @Get("research/history")
  @ApiOperation({ summary: "Research history" })
  async getResearchHistory(@Req() req: any) {
    return this.productResearch.getResearchHistory(req.user.tenantId);
  }

  @Get("research/trending")
  @ApiOperation({ summary: "Top opportunities" })
  async getTrendingOpportunities(@Req() req: any) {
    return this.productResearch.getTrendingOpportunities(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // War Room
  // ═══════════════════════════════════════════════

  @Get("war-room")
  @ApiOperation({ summary: "War room dashboard" })
  async getWarRoomDashboard(@Req() req: any) {
    return this.warRoom.getDashboard(req.user.tenantId);
  }

  @Get("war-room/timeline")
  @ApiOperation({ summary: "Event timeline" })
  async getTimeline(@Req() req: any, @Query() options: any) {
    return this.warRoom.getTimeline(req.user.tenantId, options);
  }

  @Get("war-room/battle-card/:competitorId")
  @ApiOperation({ summary: "Competitor battle card" })
  async getBattleCard(@Req() req: any, @Param("competitorId") id: string) {
    return this.warRoom.getCompetitorBattleCard(req.user.tenantId, id);
  }

  @Post("war-room/event")
  @ApiOperation({ summary: "Record competitive event" })
  async recordEvent(@Req() req: any, @Body() dto: any) {
    return this.warRoom.recordEvent(req.user.tenantId, dto);
  }

  // ═══════════════════════════════════════════════
  // Chat Assistant
  // ═══════════════════════════════════════════════

  @Post("chat/session")
  @ApiOperation({ summary: "Start new chat session" })
  async createChatSession(@Req() req: any) {
    return this.chatAssistant.createSession(req.user.tenantId, req.user.id);
  }

  @Post("chat/:sessionId/message")
  @ApiOperation({ summary: "Send message to AI assistant" })
  async sendMessage(
    @Req() req: any,
    @Param("sessionId") sid: string,
    @Body() dto: { message: string },
  ) {
    return this.chatAssistant.sendMessage(req.user.tenantId, sid, dto.message);
  }

  @Get("chat/sessions")
  @ApiOperation({ summary: "Get chat sessions" })
  async getChatSessions(@Req() req: any) {
    return this.chatAssistant.getSessions(req.user.tenantId, req.user.id);
  }

  @Get("chat/:sessionId/messages")
  @ApiOperation({ summary: "Get chat messages" })
  async getChatMessages(@Param("sessionId") sid: string) {
    return this.chatAssistant.getMessages(sid);
  }

  // ═══════════════════════════════════════════════
  // ML Prediction
  // ═══════════════════════════════════════════════

  @Get("prediction/competitor/:competitorId")
  @ApiOperation({ summary: "Predict competitor sales velocity (Shadow Analysis)" })
  async predictCompetitorVelocity(
    @Param("competitorId") id: string,
    @Query("days") days?: number,
  ) {
    return this.mlPrediction.predictCompetitorVelocity(id, days ? Number(days) : 14);
  }

  @Get("prediction/:productId")
  @ApiOperation({ summary: "ML sales prediction for a product" })
  async predictSales(
    @Param("productId") id: string,
    @Query("days") days?: number,
  ) {
    return this.mlPrediction.predictSales(id, days);
  }

  @Get("predictions/batch")
  @ApiOperation({ summary: "Batch prediction for all products" })
  async batchPredict(@Req() req: any, @Query("days") days?: number) {
    return this.mlPrediction.batchPredict(req.user.tenantId, days);
  }

  // ═══════════════════════════════════════════════
  // Game Theory Pricing
  // ═══════════════════════════════════════════════

  @Get("optimal-price/:productId")
  @ApiOperation({ summary: "Calculate optimal price with game theory" })
  async getOptimalPrice(@Param("productId") id: string) {
    return this.gameTheory.calculateOptimalPrice(id);
  }

  @Get("competitor-dna/:competitorId")
  @ApiOperation({ summary: "Analyze competitor pricing DNA and predict next move" })
  async getCompetitorDna(@Param("competitorId") id: string) {
    return this.competitorDna.analyzeCompetitorDna(id);
  }

  @Get("war-simulator/:productId")
  @ApiOperation({ summary: "Simulate a price change and its effects on buybox, margin, and profit" })
  async simulatePriceChange(
    @Param("productId") id: string,
    @Query("targetPrice") targetPrice: string
  ) {
    return this.priceWarSimulator.simulatePriceChange(id, Number(targetPrice));
  }

  // ═══════════════════════════════════════════════
  // Customer Analytics
  // ═══════════════════════════════════════════════

  @Get("customers/segments")
  @ApiOperation({ summary: "Customer segmentation & CLV" })
  async getSegments(@Req() req: any) {
    return this.customerAnalytics.getCustomerSegments(req.user.tenantId);
  }

  @Get("customers/repeat-purchases")
  @ApiOperation({ summary: "Repeat purchase analysis" })
  async getRepeatPurchases(@Req() req: any) {
    return this.customerAnalytics.getRepeatPurchaseAnalysis(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Marketplace Hub
  // ═══════════════════════════════════════════════

  @Get("marketplaces")
  @ApiOperation({ summary: "Get supported marketplaces & connections" })
  async getMarketplaces(@Req() req: any) {
    return this.marketplaceHub.getConnections(req.user.tenantId);
  }

  @Post("marketplaces/connect")
  @ApiOperation({ summary: "Add marketplace connection" })
  async connectMarketplace(@Req() req: any, @Body() dto: any) {
    return this.marketplaceHub.addConnection(req.user.tenantId, dto);
  }

  @Get("marketplaces/dashboard")
  @ApiOperation({ summary: "Unified multi-marketplace dashboard" })
  async getUnifiedDashboard(@Req() req: any) {
    return this.marketplaceHub.getUnifiedDashboard(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Subscription
  // ═══════════════════════════════════════════════

  @Get("plans")
  @ApiOperation({ summary: "Get available subscription plans" })
  async getPlans() {
    return this.subscription.getPlans();
  }

  @Get("subscription")
  @ApiOperation({ summary: "Get current subscription" })
  async getSubscription(@Req() req: any) {
    return this.subscription.getSubscription(req.user.tenantId);
  }

  @Post("subscribe")
  @ApiOperation({ summary: "Subscribe to a plan" })
  async subscribe(@Req() req: any, @Body() dto: { planId: string }) {
    return this.subscription.subscribe(req.user.tenantId, dto.planId);
  }

  @Get("usage")
  @ApiOperation({ summary: "Get usage stats" })
  async getUsage(@Req() req: any) {
    return this.subscription.getUsageStats(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Trend Heatmap
  // ═══════════════════════════════════════════════

  @Get("trend/heatmap")
  @ApiOperation({ summary: "Category trend heatmap — hangi kategori sıcak?" })
  async getTrendHeatmap(@Req() req: any, @Query("days") days?: number) {
    return this.trendHeatmap.getHeatmap(req.user.tenantId, { days });
  }

  @Get("trend/category/:name")
  @ApiOperation({ summary: "Specific category trend analysis" })
  async getCategoryTrend(@Req() req: any, @Param("name") name: string) {
    return this.trendHeatmap.getCategoryTrend(req.user.tenantId, name);
  }

  @Post("trend/snapshot")
  @ApiOperation({ summary: "Record market snapshot for trend tracking" })
  async recordTrendSnapshot(@Req() req: any, @Body() dto: any) {
    return this.trendHeatmap.recordSnapshot(req.user.tenantId, dto);
  }

  // ═══════════════════════════════════════════════
  // Demand Forecasting
  // ═══════════════════════════════════════════════

  @Get("forecast/:productId")
  @ApiOperation({ summary: "AI talep tahmini — 30/60/90 gün ileri" })
  async forecastProduct(
    @Req() req: any,
    @Param("productId") id: string,
    @Query("days") days?: number,
  ) {
    return this.demandForecast.forecastProduct(req.user.tenantId, id, days);
  }

  @Get("forecast")
  @ApiOperation({ summary: "Tüm ürünler için talep tahmini" })
  async forecastTenant(@Req() req: any) {
    return this.demandForecast.forecastTenant(req.user.tenantId);
  }

  @Get("forecast/category-waves")
  @ApiOperation({ summary: "Kategori talep dalgası tespiti" })
  async detectCategoryWaves(@Req() req: any) {
    return this.demandForecast.detectCategoryWaves(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Price Intelligence
  // ═══════════════════════════════════════════════

  @Get("price-intelligence/elasticity/:productId")
  @ApiOperation({ summary: "Fiyat elastikiyeti — fiyatı %X düşürsem satış ne değişir?" })
  async analyzeElasticity(
    @Req() req: any,
    @Param("productId") id: string,
  ) {
    return this.priceIntelligence.analyzeElasticity(req.user.tenantId, id);
  }

  @Get("price-intelligence/war-detect/:productId")
  @ApiOperation({ summary: "Fiyat savaşı erken uyarı — rakiplerin agresif fiyat hareketleri" })
  async detectPriceWar(
    @Req() req: any,
    @Param("productId") id: string,
  ) {
    return this.priceIntelligence.detectPriceWar(req.user.tenantId, id);
  }

  @Get("price-intelligence/campaign-strategy")
  @ApiOperation({ summary: "Kampanya fiyat stratejisi — 11.11, Black Friday vb." })
  async getCampaignStrategy(
    @Req() req: any,
    @Query("type") campaignType: string,
  ) {
    return this.priceIntelligence.getCampaignPricingStrategy(
      req.user.tenantId,
      campaignType,
    );
  }

  // ═══════════════════════════════════════════════
  // Category Radar
  // ═══════════════════════════════════════════════

  @Get("category-radar")
  @ApiOperation({ summary: "Kategori besteller radar — rekabet, fiyat, giriş zorluğu" })
  async getCategoryDashboard(
    @Req() req: any,
    @Query("category") category?: string,
  ) {
    return this.categoryRadar.getCategoryDashboard(req.user.tenantId, category);
  }

  @Get("category-radar/gaps")
  @ApiOperation({ summary: "Pazar boşluğu analizi — düşük rekabet fırsatları" })
  async findMarketGaps(@Req() req: any) {
    return this.categoryRadar.findMarketGaps(req.user.tenantId);
  }

  @Get("category-radar/seasonal")
  @ApiOperation({ summary: "Mevsimsel trend tahmini — hangi kategoriler yükselecek?" })
  async getSeasonalTrends(@Req() req: any) {
    return this.categoryRadar.getSeasonalTrends(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // AI Strategic Advisor
  // ═══════════════════════════════════════════════

  @Get("strategic-report")
  @ApiOperation({ summary: "Haftalık SWOT + strateji raporu" })
  async getStrategicReport(@Req() req: any) {
    return this.strategicAdvisor.generateStrategicReport(req.user.tenantId);
  }

  @Get("health")
  @ApiOperation({ summary: "Hızlı sağlık kontrolü" })
  async getQuickHealth(@Req() req: any) {
    return this.strategicAdvisor.getQuickHealth(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Gamification
  // ═══════════════════════════════════════════════

  @Get("gamification")
  @ApiOperation({ summary: "Gamification dashboard — XP, seviye, rozetler" })
  async getGamificationDashboard(@Req() req: any) {
    return this.gamification.getDashboard(req.user.tenantId);
  }

  // ═══════════════════════════════════════════════
  // Supplier Discovery
  // ═══════════════════════════════════════════════

  @Get("suppliers")
  @ApiOperation({ summary: "Kategori bazlı tedarikçi önerileri" })
  async suggestSuppliers(@Req() req: any, @Query("category") category: string) {
    return this.supplierDiscovery.suggestSuppliers(req.user.tenantId, category);
  }

  @Get("suppliers/sourcing/:productId")
  @ApiOperation({ summary: "Ürün bazlı tedarik analizi — ithalat vs yerel" })
  async analyzeSourcing(@Req() req: any, @Param("productId") id: string) {
    return this.supplierDiscovery.analyzeSourcingOptions(req.user.tenantId, id);
  }
}

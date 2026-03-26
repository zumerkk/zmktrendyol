import { Module, forwardRef } from "@nestjs/common";
import { AbTestService } from "./ab-test.service";
import { ProductResearchService } from "./product-research.service";
import { WarRoomService } from "./war-room.service";
import { ChatAssistantService } from "./chat-assistant.service";
import { PriceWarSimulatorService } from "./price-war-simulator.service";
import { MlPredictionService } from "./ml-prediction.service";
import { GameTheoryPricingService } from "./game-theory-pricing.service";
import { CompetitorDnaService } from "./competitor-dna.service";
import { CustomerAnalyticsService } from "./customer-analytics.service";
import { MarketplaceHubService } from "./marketplace-hub.service";
import { SubscriptionService } from "./subscription.service";
import { TrendHeatmapService } from "./trend-heatmap.service";
import { DemandForecastService } from "./demand-forecast.service";
import { PriceIntelligenceService } from "./price-intelligence.service";
import { CategoryRadarService } from "./category-radar.service";
import { StrategicAdvisorService } from "./strategic-advisor.service";
import { GamificationService } from "./gamification.service";
import { SupplierDiscoveryService } from "./supplier-discovery.service";
import { IntelligenceController } from "./intelligence.controller";
import { AutonomousAgentService } from "./autonomous-agent.service";
import { AutonomousAgentController } from "./autonomous-agent.controller";
import { AiModule } from "../ai/ai.module";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [forwardRef(() => AiModule), AnalyticsModule],
  controllers: [IntelligenceController, AutonomousAgentController],
  providers: [
    AbTestService,
    ProductResearchService,
    WarRoomService,
    ChatAssistantService,
    MlPredictionService,
    GameTheoryPricingService,
    CustomerAnalyticsService,
    MarketplaceHubService,
    SubscriptionService,
    TrendHeatmapService,
    CompetitorDnaService,
    PriceWarSimulatorService,
    DemandForecastService,
    PriceIntelligenceService,
    CategoryRadarService,
    StrategicAdvisorService,
    GamificationService,
    SupplierDiscoveryService,
    AutonomousAgentService,
  ],
  exports: [
    AbTestService,
    ProductResearchService,
    WarRoomService,
    ChatAssistantService,
    MlPredictionService,
    GameTheoryPricingService,
    CustomerAnalyticsService,
    MarketplaceHubService,
    SubscriptionService,
    TrendHeatmapService,
    CompetitorDnaService,
    PriceWarSimulatorService,
    DemandForecastService,
    PriceIntelligenceService,
    CategoryRadarService,
    StrategicAdvisorService,
    GamificationService,
    SupplierDiscoveryService,
    AutonomousAgentService,
  ],
})
export class IntelligenceModule { }

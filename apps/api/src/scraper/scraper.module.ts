import { Module } from "@nestjs/common";
import { ScraperEngineService } from "./scraper-engine.service";
import { AntiDetectService } from "./anti-detect.service";
import { MarketIntelligenceService } from "./market-intelligence.service";
import { ScraperController } from "./scraper.controller";

@Module({
  controllers: [ScraperController],
  providers: [
    ScraperEngineService,
    AntiDetectService,
    MarketIntelligenceService,
  ],
  exports: [ScraperEngineService, AntiDetectService, MarketIntelligenceService],
})
export class ScraperModule {}

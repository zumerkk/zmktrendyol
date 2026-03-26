import { Module } from "@nestjs/common";
import { OrchestratorService } from "./orchestrator.service";
import { ReviewAnalyzerService } from "./review-analyzer.service";
import { ListingOptimizerService } from "./listing-optimizer.service";
import { AiController } from "./ai.controller";

@Module({
  controllers: [AiController],
  providers: [
    OrchestratorService,
    ReviewAnalyzerService,
    ListingOptimizerService,
  ],
  exports: [
    OrchestratorService,
    ReviewAnalyzerService,
    ListingOptimizerService,
  ],
})
export class AiModule {}

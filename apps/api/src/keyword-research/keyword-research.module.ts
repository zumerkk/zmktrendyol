import { Module } from "@nestjs/common";
import { KeywordResearchService } from "./keyword-research.service";
import { RankTrackerService } from "./rank-tracker.service";
import { KeywordResearchController } from "./keyword-research.controller";

@Module({
  controllers: [KeywordResearchController],
  providers: [KeywordResearchService, RankTrackerService],
  exports: [KeywordResearchService, RankTrackerService],
})
export class KeywordResearchModule {}

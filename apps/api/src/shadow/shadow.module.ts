import { Module } from '@nestjs/common';
import { ShadowController } from './shadow.controller';
import { ShadowIntelligenceService } from './shadow-intelligence.service';
import { ShadowStockSentinel } from './shadow-stock-sentinel.service';
import { ShadowAlertDispatcher } from './shadow-alert-dispatcher.service';
import { ShadowReportGenerator } from './shadow-report-generator.service';
import { ShadowAgentFleet } from './shadow-agent-fleet.service';

@Module({
  controllers: [ShadowController],
  providers: [
    ShadowIntelligenceService,
    ShadowStockSentinel,
    ShadowAlertDispatcher,
    ShadowReportGenerator,
    ShadowAgentFleet,
  ],
  exports: [
    ShadowIntelligenceService,
    ShadowStockSentinel,
    ShadowAlertDispatcher,
  ],
})
export class ShadowModule {}

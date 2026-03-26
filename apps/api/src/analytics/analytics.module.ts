import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { KpiService } from "./kpi.service";
import { ProfitabilityService } from "./profitability.service";
import { RestockingService } from "./restocking.service";
import { CashFlowForecastService } from "./cash-flow-forecast.service";

@Module({
  controllers: [AnalyticsController],
  providers: [KpiService, ProfitabilityService, RestockingService, CashFlowForecastService],
  exports: [KpiService, ProfitabilityService, RestockingService, CashFlowForecastService],
})
export class AnalyticsModule {}

import { Module } from "@nestjs/common";
import { AdsService } from "./ads.service";
import { AdAutopilotService } from "./ad-autopilot.service";
import { AdsController } from "./ads.controller";
import { TrendyolModule } from "../trendyol/trendyol.module";

@Module({
  imports: [TrendyolModule],
  controllers: [AdsController],
  providers: [AdsService, AdAutopilotService],
  exports: [AdsService, AdAutopilotService],
})
export class AdsModule {}

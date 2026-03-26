import { Module, forwardRef } from "@nestjs/common";
import { TrackerService } from "./tracker.service";
import { StockProbeService } from "./stock-probe.service";
import { BuyboxService } from "./buybox.service";
import { DynamicPricingService } from "./dynamic-pricing.service";
import { CompetitorController } from "./competitor.controller";
import { TrendyolModule } from "../trendyol/trendyol.module";
import { ScraperModule } from "../scraper/scraper.module";

@Module({
  imports: [forwardRef(() => TrendyolModule), ScraperModule],
  controllers: [CompetitorController],
  providers: [
    TrackerService,
    StockProbeService,
    BuyboxService,
    DynamicPricingService,
  ],
  exports: [
    TrackerService,
    StockProbeService,
    BuyboxService,
    DynamicPricingService,
  ],
})
export class CompetitorModule {}

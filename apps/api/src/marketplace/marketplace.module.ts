import { Module } from "@nestjs/common";
import { HepsiburadaService } from "./hepsiburada.service";
import { N11Service } from "./n11.service";
import { AmazonTurkeyService } from "./amazon-turkey.service";
import { CrossPlatformAnalyticsService } from "./cross-platform-analytics.service";
import { MarketplaceController } from "./marketplace.controller";

@Module({
  controllers: [MarketplaceController],
  providers: [
    HepsiburadaService,
    N11Service,
    AmazonTurkeyService,
    CrossPlatformAnalyticsService,
  ],
  exports: [
    HepsiburadaService,
    N11Service,
    AmazonTurkeyService,
    CrossPlatformAnalyticsService,
  ],
})
export class MarketplaceModule {}

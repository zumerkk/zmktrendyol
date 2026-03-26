import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TrendyolModule } from "./trendyol/trendyol.module";
import { WarehouseModule } from "./warehouse/warehouse.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { CompetitorModule } from "./competitor/competitor.module";
import { AiModule } from "./ai/ai.module";
import { AuditModule } from "./audit/audit.module";
import { ExtensionModule } from "./extension/extension.module";
import { AdsModule } from "./ads/ads.module";
import { ScraperModule } from "./scraper/scraper.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { TelegramModule } from "./telegram/telegram.module";
import { IntelligenceModule } from "./intelligence/intelligence.module";
import { WorkerModule } from "./worker/worker.module";
import { CommandCenterModule } from "./command-center/command-center.module";
import { AutomationModule } from "./automation/automation.module";
import { GodModeModule } from "./god-mode/god-mode.module";
import { KeywordResearchModule } from "./keyword-research/keyword-research.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { FinanceModule } from "./finance/finance.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TrendyolModule,
    WarehouseModule,
    AnalyticsModule,
    CompetitorModule,
    AiModule,
    AuditModule,
    ExtensionModule,
    AdsModule,
    ScraperModule,
    NotificationsModule,
    TelegramModule,
    IntelligenceModule,
    WorkerModule,
    CommandCenterModule,
    AutomationModule,
    GodModeModule,
    KeywordResearchModule,
    MarketplaceModule,
    FinanceModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }

import { Module } from '@nestjs/common';
import { RivalsController } from './rivals.controller';
import { RivalsService } from './rivals.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { TrendyolScraperService } from './scrape/trendyol-scraper.service';
import { AlertsEngine } from './engine/alerts.engine';
import { DecisionEngine } from './engine/decision.engine';
import { DiffEngine } from './engine/diff.engine';
import { RivalsScheduler } from './scheduler/rivals.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [RivalsController],
  providers: [
    RivalsService,
    TrendyolScraperService,
    AlertsEngine,
    DecisionEngine,
    DiffEngine,
    RivalsScheduler,
  ],
})
export class RivalsModule {}

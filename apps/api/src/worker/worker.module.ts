import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ScraperWorkerService } from "./scraper-worker.service";
import { PrismaModule } from "../common/prisma/prisma.module";
import { TrendyolModule } from "../trendyol/trendyol.module";
import { AiAnalysisWorkerService } from "./ai-analysis-worker.service";
import { ApiSyncWorkerService } from "./api-sync-worker.service";

@Module({
  imports: [
    PrismaModule,
    TrendyolModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => {
          if (times > 3) return null; // stop retrying after 3 attempts
          return Math.min(times * 5000, 15000);
        },
        lazyConnect: true,
        enableOfflineQueue: false,
      },
    }),
    BullModule.registerQueue({
      name: "scrape_queue",
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    }),
    BullModule.registerQueue({
      name: "ai_analysis_queue",
    }),
    BullModule.registerQueue({
      name: "api_sync_queue",
    }),
    BullBoardModule.forRoot({
      route: "/admin/queues",
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: "scrape_queue",
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: "ai_analysis_queue",
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: "api_sync_queue",
      adapter: BullMQAdapter,
    }),
  ],
  providers: [ScraperWorkerService, AiAnalysisWorkerService, ApiSyncWorkerService],
  exports: [BullModule],
})
export class WorkerModule { }

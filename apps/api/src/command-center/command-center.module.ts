import { Module } from "@nestjs/common";
import { CommandCenterService } from "./command-center.service";
import { CommandCenterController } from "./command-center.controller";
import { PrismaModule } from "../common/prisma/prisma.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CompetitorModule } from "../competitor/competitor.module";

@Module({
  imports: [PrismaModule, AnalyticsModule, CompetitorModule],
  providers: [CommandCenterService],
  controllers: [CommandCenterController],
  exports: [CommandCenterService],
})
export class CommandCenterModule {}

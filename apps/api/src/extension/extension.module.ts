import { Module } from "@nestjs/common";
import { ExtensionController } from "./extension.controller";
import { ContextService } from "./context.service";
import { ExtensionJobService } from "./extension-job.service";

@Module({
  controllers: [ExtensionController],
  providers: [ContextService, ExtensionJobService],
})
export class ExtensionModule {}

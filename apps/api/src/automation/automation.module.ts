import { Module } from "@nestjs/common";
import { AutomationController } from "./automation.controller";
import { AutomationService } from "./automation.service";
import { AutomationEngineV2Service } from "./automation-engine-v2.service";
import { PrismaModule } from "../common/prisma/prisma.module";

@Module({
    imports: [PrismaModule],
    controllers: [AutomationController],
    providers: [AutomationService, AutomationEngineV2Service],
    exports: [AutomationService, AutomationEngineV2Service],
})
export class AutomationModule { }

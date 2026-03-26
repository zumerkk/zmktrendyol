import { Module } from "@nestjs/common";
import { PrismaModule } from "../common/prisma/prisma.module";
import { GodModeController } from "./god-mode.controller";
import { OosSniperService } from "./oos-sniper.service";
import { CartelDetectorService } from "./cartel-detector.service";
import { ZeusAdsService } from "./zeus-ads.service";
import { ArbitrageService } from "./arbitrage.service";
import { HijackerDefenseService } from "./hijacker-defense.service";

@Module({
    imports: [PrismaModule],
    controllers: [GodModeController],
    providers: [
        OosSniperService,
        CartelDetectorService,
        ZeusAdsService,
        ArbitrageService,
        HijackerDefenseService,
    ],
    exports: [
        OosSniperService,
        ZeusAdsService,
    ],
})
export class GodModeModule { }

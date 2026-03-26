import { Controller, Post, Param, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SubscriptionGuard } from "../common/guards/subscription.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";
import { OosSniperService } from "./oos-sniper.service";
import { CartelDetectorService } from "./cartel-detector.service";
import { ZeusAdsService } from "./zeus-ads.service";
import { ArbitrageService } from "./arbitrage.service";
import { HijackerDefenseService } from "./hijacker-defense.service";

@ApiTags("God Mode (Nirvana)")
@Controller("god-mode")
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@RequirePlan("enterprise") // SADECE ENTERPRISE SAAS MÜŞTERİLERİNE AÇIK!
@ApiBearerAuth()
export class GodModeController {
    constructor(
        private oosSniper: OosSniperService,
        private cartelDetector: CartelDetectorService,
        private zeusAds: ZeusAdsService,
        private arbitrage: ArbitrageService,
        private hijackerDefense: HijackerDefenseService
    ) { }

    @Post("oos-snipe/:competitorProductId")
    @ApiOperation({ summary: "Tetikte Bekle: Rakip Stoğu Bittiğinde Fiyatı Uçur (Yağmacı)" })
    async snipeOos(@Req() req: any, @Param("competitorProductId") productId: string) {
        return this.oosSniper.snipeCompetitorOos(req.user.tenantId, productId);
    }

    @Post("detect-cartel")
    @ApiOperation({ summary: "Pazar Kartel Dedektörü: Fiyat Sabitleyen Tekelcileri Bul" })
    async detectCartel(@Req() req: any) {
        return this.cartelDetector.detectCartels(req.user.tenantId);
    }

    @Post("zeus-strike/:campaignId")
    @ApiOperation({ summary: "Zeus Algoritması: Prime-Time Rakiplerin Reklamını Havaya Uçur" })
    async executeZeus(@Req() req: any, @Param("campaignId") campaignId: string) {
        return this.zeusAds.executeZeusStrike(req.user.tenantId, campaignId);
    }

    @Post("arbitrage-scan")
    @ApiOperation({ summary: "Arbitraj Taraması: Çin'deki Üreticiyi Bul ve %400 ROI Sağla" })
    async findGoldenArbitrage(@Req() req: any) {
        return this.arbitrage.findGoldenArbitrage(req.user.tenantId);
    }

    @Post("hijacker-takedown/:productId")
    @ApiOperation({ summary: "Hijacker İnfazı: Buybox Parazitlerini Otomatik Avukat Ağvı ile At" })
    async takedownHijacker(@Req() req: any, @Param("productId") productId: string) {
        return this.hijackerDefense.executeHijackerTakedown(req.user.tenantId, productId);
    }
}

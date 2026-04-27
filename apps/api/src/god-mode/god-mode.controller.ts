import { Controller, Get, Post, Param, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OosSniperService } from "./oos-sniper.service";
import { CartelDetectorService } from "./cartel-detector.service";
import { ZeusAdsService } from "./zeus-ads.service";
import { ArbitrageService } from "./arbitrage.service";
import { HijackerDefenseService } from "./hijacker-defense.service";
import { PrismaService } from "../common/prisma/prisma.service";

@ApiTags("God Mode (Nirvana)")
@Controller("god-mode")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GodModeController {
    constructor(
        private oosSniper: OosSniperService,
        private cartelDetector: CartelDetectorService,
        private zeusAds: ZeusAdsService,
        private arbitrage: ArbitrageService,
        private hijackerDefense: HijackerDefenseService,
        private prisma: PrismaService,
    ) { }

    // ═══════════════════════════════════════════════════════
    //  GET — Dashboard Data Endpoints
    // ═══════════════════════════════════════════════════════

    @Get("dashboard")
    @ApiOperation({ summary: "God Mode dashboard verisi" })
    async getDashboard(@Req() req: any) {
        const tenantId = req.user.tenantId;
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // OOS Sniper stats
        const oosRules = await (this.prisma as any).automationRule.findMany({
            where: { tenantId, triggerType: 'COMPETITOR_OOS', isActive: true },
        });

        // Shadow targets with OOS status
        const oosTargets = await (this.prisma as any).shadowTarget.findMany({
            where: { tenantId, lastStockSignal: 'out_of_stock', isActive: true },
            take: 20,
            orderBy: { lastScanAt: 'desc' },
        });

        const lowStockTargets = await (this.prisma as any).shadowTarget.findMany({
            where: { tenantId, lastStockSignal: { in: ['critical', 'low'] }, isActive: true },
            take: 20,
            orderBy: { lastScanAt: 'desc' },
        });

        // God Mode insights/actions
        const godModeActions = await (this.prisma as any).actionableInsight.findMany({
            where: { tenantId, type: 'god_mode_action' },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        // Products for arbitrage
        const ourProducts = await (this.prisma as any).product.findMany({
            where: { tenantId },
            include: { variants: true },
            take: 30,
        });

        // Competitor products for comparison
        const competitorProducts = await (this.prisma as any).competitorProduct.findMany({
            where: { tenantId },
            include: { snapshots: { orderBy: { time: 'desc' }, take: 1 } },
            take: 30,
        });

        // Build arbitrage opportunities
        const arbitrageOpportunities: any[] = [];
        for (const cp of competitorProducts) {
            const snap = cp.snapshots?.[0];
            if (!snap?.price) continue;
            const compPrice = Number(snap.price);
            const match = ourProducts.find((p: any) =>
                cp.title && p.title && (
                    p.title.toLowerCase().includes(cp.title.toLowerCase().slice(0, 15)) ||
                    cp.title.toLowerCase().includes(p.title.toLowerCase().slice(0, 15))
                )
            );
            if (match?.variants?.length) {
                const ourPrice = Number(match.variants[0].salePrice || match.variants[0].listPrice || 0);
                if (compPrice > 0 && ourPrice > 0) {
                    const margin = ((compPrice - ourPrice) / ourPrice) * 100;
                    if (margin > 15) {
                        arbitrageOpportunities.push({
                            productName: match.title,
                            competitorTitle: cp.title,
                            competitorPrice: compPrice,
                            ourPrice,
                            marginPercent: Math.round(margin),
                            competitorUrl: cp.trendyolUrl,
                            estimatedProfit: Math.round((compPrice - ourPrice) * 30),
                            chinaEstimate: Math.round(ourPrice * 0.3),
                            roiPercent: Math.round(((compPrice - ourPrice * 0.3) / (ourPrice * 0.3)) * 100),
                        });
                    }
                }
            }
        }
        arbitrageOpportunities.sort((a, b) => b.marginPercent - a.marginPercent);

        // Zeus campaign stats
        const adCampaigns = await (this.prisma as any).adCampaign.findMany({
            where: { tenantId },
            take: 10,
        }).catch(() => []);

        // Hijacker detection
        const buyboxSnapshots = await (this.prisma as any).buyboxSnapshot.findMany({
            where: { competitorProduct: { tenantId } },
            orderBy: { time: 'desc' },
            take: 50,
            include: { competitorProduct: true },
        }).catch(() => []);

        const hijackers: any[] = [];
        const seen = new Set();
        for (const snap of buyboxSnapshots) {
            if (snap.isOurBuybox === false && snap.buyboxHolder && !seen.has(snap.buyboxHolder)) {
                seen.add(snap.buyboxHolder);
                hijackers.push({
                    seller: snap.buyboxHolder,
                    product: snap.competitorProduct?.title || 'Bilinmeyen',
                    productId: snap.competitorProductId,
                    detectedAt: snap.time,
                });
            }
        }

        const currentHour = now.getHours();

        return {
            kpi: {
                oosRulesActive: oosRules.length,
                oosTargets: oosTargets.length,
                lowStockTargets: lowStockTargets.length,
                totalGodModeActions: godModeActions.length,
                arbitrageOpportunities: arbitrageOpportunities.length,
                hijackersDetected: hijackers.length,
                activeCampaigns: adCampaigns.length,
                zeusMode: currentHour >= 19 && currentHour <= 23 ? 'PRIME_TIME' : currentHour >= 2 && currentHour <= 7 ? 'SLEEP_MODE' : 'STANDBY',
            },
            oosSniper: {
                rules: oosRules,
                targets: oosTargets.map((t: any) => ({
                    id: t.id,
                    productName: t.productName,
                    brand: t.brand,
                    currentPrice: t.currentPrice,
                    lastStockCount: t.lastStockCount,
                    lastScanAt: t.lastScanAt,
                    url: t.trendyolUrl,
                })),
                readyToSnipe: oosTargets.length,
            },
            zeus: {
                campaigns: adCampaigns,
                currentMode: currentHour >= 19 && currentHour <= 23 ? 'AGGRESSIVE' : currentHour >= 2 && currentHour <= 7 ? 'PAUSED' : 'NORMAL',
                primeTimeWindow: '19:00 - 23:00',
                budgetMultiplier: currentHour >= 19 && currentHour <= 23 ? 3 : 1,
            },
            hijacker: {
                detected: hijackers,
                totalThreats: hijackers.length,
                lastScanProducts: buyboxSnapshots.length,
            },
            arbitrage: {
                opportunities: arbitrageOpportunities.slice(0, 10),
                totalFound: arbitrageOpportunities.length,
                topMargin: arbitrageOpportunities[0]?.marginPercent || 0,
            },
            recentActions: godModeActions.slice(0, 10),
            lowStockWatchlist: lowStockTargets.map((t: any) => ({
                id: t.id,
                productName: t.productName,
                brand: t.brand,
                stockCount: t.lastStockCount,
                signal: t.lastStockSignal,
                price: t.currentPrice,
            })),
        };
    }

    // ═══════════════════════════════════════════════════════
    //  POST — Action Endpoints
    // ═══════════════════════════════════════════════════════

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

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { MlPredictionService } from './ml-prediction.service';
import { ProfitabilityService } from '../analytics/profitability.service';

@Injectable()
export class PriceWarSimulatorService {
    private readonly logger = new Logger(PriceWarSimulatorService.name);

    constructor(
        private prisma: PrismaService,
        private mlPrediction: MlPredictionService,
        private profitability: ProfitabilityService
    ) { }

    /**
     * Simulates the impact of changing the price of a product to a new target price.
     * Evaluates Buybox chance, new margin, and estimated volume change.
     */
    async simulatePriceChange(productId: string, targetPrice: number) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: {
                tenant: true,
            }
        });

        if (!product) return { message: 'Product not found', productId, simulation: null };

        // 1. Current State Calculations
        const currentPrice = Number((product as any).salePrice || 0);
        const costPrice = Number(product.costPrice || 0);
        const commissionRate = Number((product as any).commissionRate || 15);
        const shippingCost = Number((product as any).shippingCost || 0);
        const packagingCost = Number((product as any).packagingCost || 0);

        if (currentPrice <= 0) return { error: 'Current price is zero or missing.' };

        // Current Profitability (Unit)
        const currentCommission = currentPrice * (commissionRate / 100);
        const currentNetProfit = currentPrice - costPrice - currentCommission - shippingCost - packagingCost;
        const currentMargin = (currentNetProfit / currentPrice) * 100;

        // Target Profitability (Unit)
        const targetCommission = targetPrice * (commissionRate / 100);
        const targetNetProfit = targetPrice - costPrice - targetCommission - shippingCost - packagingCost;
        const targetMargin = (targetNetProfit / targetPrice) * 100;

        // 2. Buybox Impact
        // Find competitor matching this product (by barcode proxy or mapped competitor id)
        // Since we don't have a direct mapping in schema easily visible, we aggregate snapshots for competitors in the same tenant as a proxy for the demo, or we find a CompetitorProduct matching barcode.
        // Assuming CompetitorProduct has brand and category, we will try to find a competitor with the same product ID if mapped.
        let estimatedBuyboxChance = 0;
        let buyboxStatus = 'Unknown';

        const competitors = await this.prisma.competitorProduct.findMany({
            where: {
                tenantId: product.tenantId,
                title: { contains: product.title.substring(0, 10).trim() } // VERY raw heuristic for MVP
            },
            include: {
                buyboxSnapshots: {
                    orderBy: { time: 'desc' },
                    take: 1
                }
            }
        });

        let lowestCompetitorPrice = 999999;

        for (const comp of competitors) {
            const bb = comp.buyboxSnapshots[0];
            if (bb && bb.buyboxPrice) {
                const bbPrice = Number(bb.buyboxPrice);
                if (bbPrice < lowestCompetitorPrice) lowestCompetitorPrice = bbPrice;
            }
        }

        if (lowestCompetitorPrice !== 999999) {
            if (targetPrice < lowestCompetitorPrice) {
                estimatedBuyboxChance = 95;
                buyboxStatus = 'Likely Win';
            } else if (Math.abs(targetPrice - lowestCompetitorPrice) < 1) {
                estimatedBuyboxChance = 50;
                buyboxStatus = 'Toss-up (Tied)';
            } else {
                estimatedBuyboxChance = 5;
                buyboxStatus = 'Likely Lose';
            }
        } else {
            buyboxStatus = 'No direct competition data found.'
        }

        // 3. Volume and Revenue Impact
        // We calculate Elasticity: how much volume increases when price decreases?
        const priceChangePct = (targetPrice - currentPrice) / currentPrice;

        // Simplified elasticity: Assume -1.5 elasticity for eCommerce (buybox winner usually gets +100% volume at least, but let's smooth it)
        let assumedElasticity = -1.5;

        if (buyboxStatus === 'Likely Win' && targetPrice < currentPrice) {
            // Winning buybox drastically spikes volume
            assumedElasticity = -3.0;
        } else if (buyboxStatus === 'Likely Lose' && targetPrice > currentPrice) {
            // Losing buybox drastically drops volume
            assumedElasticity = -2.5;
        }

        const predictedVolumeChangePct = priceChangePct * assumedElasticity;

        // Let's get current base velocity
        const mlPrediction = await this.mlPrediction.predictSales(productId, 30).catch(() => null);
        const currentMonthlyVolume = mlPrediction?.historicalData?.totalSold || 30; // fallback 30 minimum

        const predictedMonthlyVolume = Math.max(0, Math.round(currentMonthlyVolume * (1 + predictedVolumeChangePct)));

        const currentMonthlyRevenue = currentMonthlyVolume * currentPrice;
        const currentMonthlyProfit = currentMonthlyVolume * currentNetProfit;

        const predictedMonthlyRevenue = predictedMonthlyVolume * targetPrice;
        const predictedMonthlyProfit = predictedMonthlyVolume * targetNetProfit;

        return {
            productId,
            title: product.title,
            simulationRequest: {
                currentPrice,
                targetPrice,
                priceChangePercentage: Math.round(priceChangePct * 100 * 100) / 100
            },
            unitEconomics: {
                currentMargin: Math.round(currentMargin * 100) / 100,
                targetMargin: Math.round(targetMargin * 100) / 100,
                currentNetProfit: Math.round(currentNetProfit * 100) / 100,
                targetNetProfit: Math.round(targetNetProfit * 100) / 100
            },
            competition: {
                lowestCompetitorPrice: lowestCompetitorPrice === 999999 ? null : lowestCompetitorPrice,
                estimatedBuyboxChancePercent: estimatedBuyboxChance,
                buyboxStatus
            },
            monthlyProjections: {
                currentVolume: currentMonthlyVolume,
                predictedVolume: predictedMonthlyVolume,
                volumeChangePercent: Math.round(predictedVolumeChangePct * 100 * 100) / 100,

                currentRevenue: Math.round(currentMonthlyRevenue),
                predictedRevenue: Math.round(predictedMonthlyRevenue),
                revenueDelta: Math.round(predictedMonthlyRevenue - currentMonthlyRevenue),

                currentTotalProfit: Math.round(currentMonthlyProfit),
                predictedTotalProfit: Math.round(predictedMonthlyProfit),
                totalProfitDelta: Math.round(predictedMonthlyProfit - currentMonthlyProfit)
            },
            recommendation: predictedMonthlyProfit > currentMonthlyProfit
                ? 'POSITIVE: Bu fiyat değişikliği toplam kârlılığı artıracak.'
                : 'NEGATIVE: Marj veya hacim kaybı nedeniyle toplam kârlılık düşecek.'
        };
    }
}

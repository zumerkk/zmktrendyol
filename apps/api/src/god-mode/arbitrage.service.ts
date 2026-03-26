import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ArbitrageService {
    private readonly logger = new Logger(ArbitrageService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Analyzes competitor products against own catalog to find supply-chain arbitrage opportunities.
     * Compares cost basis vs market prices to identify high-margin gaps.
     */
    async findGoldenArbitrage(tenantId: string) {
        this.logger.log(`🔍 Seeking Supply Arbitrage for tenant ${tenantId}`);

        // Get our products with their pricing
        const ourProducts = await this.prisma.product.findMany({
            where: { tenantId },
            include: { variants: true },
            take: 50,
        });

        // Get competitor snapshots with pricing data (via CompetitorProduct)
        const competitorProducts = await this.prisma.competitorProduct.findMany({
            where: { tenantId },
            include: {
                snapshots: {
                    orderBy: { time: 'desc' },
                    take: 1, // latest snapshot per competitor
                },
            },
        });

        const opportunities: Array<{
            productName: string;
            competitorPrice: number;
            ourPrice: number;
            marginPercent: number;
            competitorUrl: string;
        }> = [];

        for (const cp of competitorProducts) {
            const latestSnapshot = cp.snapshots[0];
            if (!latestSnapshot || !latestSnapshot.price) continue;

            const compPrice = Number(latestSnapshot.price);

            // Find matching products in our catalog by title similarity
            const match = ourProducts.find(p =>
                (cp.title && p.title.toLowerCase().includes(cp.title.toLowerCase().slice(0, 20))) ||
                (cp.title && cp.title.toLowerCase().includes(p.title.toLowerCase().slice(0, 20)))
            );

            if (match && match.variants.length > 0) {
                const ourPrice = Number(match.variants[0].salePrice || match.variants[0].listPrice || 0);

                if (compPrice > 0 && ourPrice > 0) {
                    const marginPercent = ((compPrice - ourPrice) / ourPrice) * 100;

                    if (marginPercent > 30) {
                        opportunities.push({
                            productName: match.title,
                            competitorPrice: compPrice,
                            ourPrice,
                            marginPercent: Math.round(marginPercent),
                            competitorUrl: cp.trendyolUrl,
                        });
                    }
                }
            }
        }

        // Sort by highest margin
        opportunities.sort((a, b) => b.marginPercent - a.marginPercent);
        const top = opportunities[0];

        if (top) {
            await this.prisma.actionableInsight.create({
                data: {
                    tenantId,
                    type: 'god_mode_action',
                    priority: 1,
                    title: `🌐 [God Mode] Tedarik Arbitrajı: Yüksek Marjlı Fırsat!`,
                    description: `"${top.productName}" ürününde rakipler ${top.competitorPrice.toFixed(2)} TL'den satarken sizin maliyetiniz ${top.ourPrice.toFixed(2)} TL. %${top.marginPercent} marj fırsatı!`,
                    suggestedAction: `Fiyatınızı rakiplere yaklaştırarak satış hacmini artırabilirsiniz. ${opportunities.length} adet yüksek marjlı ürün tespit edildi.`,
                    isCompleted: false,
                    metadata: { opportunities: opportunities.slice(0, 5) },
                },
            });
        }

        return {
            success: true,
            opportunityCount: opportunities.length,
            topOpportunity: top || null,
            message: opportunities.length > 0
                ? `${opportunities.length} arbitrage opportunity found`
                : 'No significant arbitrage gaps detected in current market data',
        };
    }
}

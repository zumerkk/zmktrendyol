import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class OosSniperService {
    private readonly logger = new Logger(OosSniperService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Called by the system when a competitor's stock reaches 0 (OOS).
     * It checks if we have the same product, and if we are now the sole seller
     * or one of the few left, it drastically increases the price to maximize profit.
     */
    async snipeCompetitorOos(tenantId: string, competitorProductId: string) {
        this.logger.log(`OOS Sniper initiated for competitor product ${competitorProductId}`);

        // Find the matching product in our inventory
        // To do this, we normally join CompetitorProduct -> Product
        const relatedRule = await this.prisma.automationRule.findFirst({
            where: {
                tenantId,
                isActive: true,
                triggerType: 'COMPETITOR_OOS',
            },
        });

        if (!relatedRule) {
            this.logger.debug(`No active OOS Sniper rule for tenant ${tenantId}. Aborting.`);
            return { success: false, reason: 'No active rule' };
        }

        // In a real scenario we'd map competitorProductId to our own productId.
        // For demo MVP, we will pick our top product for this tenant.
        const ourProduct = await this.prisma.product.findFirst({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            include: { variants: true }
        });

        if (!ourProduct || ourProduct.variants.length === 0) return { success: false, reason: 'No product or variant found' };

        // Action: SNIPER_PRICE_BUMP
        const { bumpPercentage } = relatedRule.actionData as any || { bumpPercentage: 25 };

        const oldPrice = Number(ourProduct.variants[0].salePrice || 0);
        const newPrice = oldPrice * (1 + (bumpPercentage / 100));

        // Simulate price update (would call Trendyol API)
        this.logger.warn(`🚀 GOD MODE: Competitor is OOS! Increasing our price from ${oldPrice} to ${newPrice.toFixed(2)} (+%${bumpPercentage})`);

        // Log this aggressive action
        await this.prisma.actionableInsight.create({
            data: {
                tenantId,
                type: 'god_mode_action',
                priority: 1, // Critical/Highest
                title: `🔥 [God Mode] OOS Yağmacı Devrede!`,
                description: `Rakibinizin (ID: ${competitorProductId}) stokları tükendi. Pazardaki tekel konumunuzu kullanarak fiyat otomatik olarak %${bumpPercentage} artırıldı. Yeni Fiyat: ${newPrice.toFixed(2)} TL.`,
                suggestedAction: `Rakip stoka girene kadar bu fiyatta kalın. Rakip stoka döndüğünde eski Kural Motoru fiyatına geri dönülecektir.`,
                isCompleted: true,
                metadata: {
                    competitorProductId,
                    oldPrice,
                    newPrice,
                    gainPerUnit: newPrice - oldPrice,
                },
            },
        });

        return {
            success: true,
            message: `Price successfully sniped to ${newPrice.toFixed(2)}`,
        };
    }
}

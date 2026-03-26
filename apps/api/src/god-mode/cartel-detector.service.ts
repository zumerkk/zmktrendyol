import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CartelDetectorService {
    private readonly logger = new Logger(CartelDetectorService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Analyzes buybox snapshots to detect price-fixing (cartel) behavior.
     * If multiple sellers maintain identical prices within a narrow timeframe, it flags coordinated pricing.
     */
    async detectCartels(tenantId: string) {
        this.logger.log(`Scanning market for cartel behavior (Tenant: ${tenantId})`);

        // Get competitor products with recent buybox snapshots
        const competitorProducts = await this.prisma.competitorProduct.findMany({
            where: { tenantId },
            include: {
                buyboxSnapshots: {
                    where: {
                        time: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    },
                    orderBy: { time: 'desc' },
                    take: 50,
                },
            },
        });

        if (competitorProducts.length === 0) {
            return { success: true, message: 'Yetersiz buybox verisi.', cartelsFound: 0 };
        }

        const suspiciousProducts: Array<{
            productTitle: string;
            sellers: string[];
            fixedPrice: number;
            occurrences: number;
        }> = [];

        for (const cp of competitorProducts) {
            if (cp.buyboxSnapshots.length < 3) continue;

            // Check if multiple different sellers have exact same price repeatedly
            const priceMap = new Map<number, Set<string>>();

            for (const snap of cp.buyboxSnapshots) {
                const price = Number(snap.buyboxPrice || 0);
                const seller = snap.buyboxHolder || 'unknown';

                // Also check sellersData for additional sellers at the same price
                if (price > 0) {
                    if (!priceMap.has(price)) priceMap.set(price, new Set());
                    priceMap.get(price)!.add(seller);

                    // Parse sellersData for additional sellers
                    if (snap.sellersData && typeof snap.sellersData === 'object') {
                        const sellersArray = Array.isArray(snap.sellersData) ? snap.sellersData : [];
                        for (const s of sellersArray) {
                            const sellerName = (s as any)?.name || (s as any)?.sellerName;
                            const sellerPrice = Number((s as any)?.price || 0);
                            if (sellerName && sellerPrice === price) {
                                priceMap.get(price)!.add(sellerName);
                            }
                        }
                    }
                }
            }

            // If 3+ sellers share the EXACT same price → suspicious
            for (const [price, sellers] of priceMap) {
                if (sellers.size >= 3) {
                    suspiciousProducts.push({
                        productTitle: cp.title || `Competitor ${cp.id}`,
                        sellers: Array.from(sellers),
                        fixedPrice: price,
                        occurrences: cp.buyboxSnapshots.filter(s => Number(s.buyboxPrice) === price).length,
                    });
                }
            }
        }

        if (suspiciousProducts.length > 0) {
            const top = suspiciousProducts[0];
            await this.prisma.actionableInsight.create({
                data: {
                    tenantId,
                    type: 'god_mode_action',
                    priority: 1,
                    title: `🚨 [God Mode] Pazar Karteli Tespit Edildi!`,
                    description: `"${top.productTitle}" ürününde ${top.sellers.join(', ')} satıcıların fiyatları sürekli ${top.fixedPrice} TL. ${top.occurrences} kez aynı fiyat tespit edildi.`,
                    suggestedAction: `Bu Buybox'ta doğrudan fiyat savaşına GİRMEYİN. Organize fiyat sabitleme var. Farklı bundle (set/paket) açarak dolaylı rekabet yapın.`,
                    isCompleted: false,
                    metadata: { suspiciousProducts: suspiciousProducts.slice(0, 5) },
                },
            });
        }

        return {
            success: true,
            cartelsFound: suspiciousProducts.length,
            message: suspiciousProducts.length > 0
                ? `${suspiciousProducts.length} potential cartel detected`
                : 'Market looks clear — no cartel patterns found.',
        };
    }
}

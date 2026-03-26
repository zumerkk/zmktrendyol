import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class HijackerDefenseService {
    private readonly logger = new Logger(HijackerDefenseService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Scans our competitor product records' buybox snapshots for unauthorized sellers.
     * If another seller appears where we should be the sole holder, flags it.
     */
    async executeHijackerTakedown(tenantId: string, competitorProductId: string) {
        this.logger.log(`🔫 [Hijacker Defense] Scanning buybox for product: ${competitorProductId}`);

        // Get the competitor product with recent buybox snapshots
        const competitorProduct = await this.prisma.competitorProduct.findFirst({
            where: { id: competitorProductId, tenantId },
            include: {
                buyboxSnapshots: {
                    orderBy: { time: 'desc' },
                    take: 20,
                },
            },
        });

        if (!competitorProduct) {
            return { success: false, message: 'Competitor product not found' };
        }

        // Get our seller connection to know our seller ID
        const connection = await this.prisma.sellerConnection.findFirst({
            where: { tenantId, status: 'active' },
        });

        if (!connection) {
            return { success: false, message: 'No active seller connection' };
        }

        // Check buybox holders — if someone other than us is winning OUR buybox
        const hijackers = new Set<string>();
        for (const snap of competitorProduct.buyboxSnapshots) {
            if (snap.isOurBuybox === false && snap.buyboxHolder) {
                hijackers.add(snap.buyboxHolder);
            }
        }

        if (hijackers.size > 0) {
            const hijackerList = Array.from(hijackers);

            await this.prisma.actionableInsight.create({
                data: {
                    tenantId,
                    type: 'god_mode_action',
                    priority: 1,
                    title: `⚖️ [God Mode] Hijacker Tespit Edildi: Buybox'a Çöktüler!`,
                    description: `"${competitorProduct.title || competitorProductId}" ürünündeki Buybox'a ${hijackerList.length} farklı yetkisiz satıcı girdi: ${hijackerList.join(', ')}.`,
                    suggestedAction: `Trendyol Satıcı Desteği'ne "Marka İhlali" bildirimi yapın. Satıcı bilgileri ve buybox snapshot kanıtları mevcut.`,
                    isCompleted: false,
                    metadata: { competitorProductId, title: competitorProduct.title, hijackers: hijackerList },
                },
            });

            return {
                success: true,
                message: `${hijackerList.length} hijacker(s) found`,
                hijackers: hijackerList,
            };
        }

        return { success: true, message: 'Your buybox is safe — no unauthorized sellers detected.' };
    }
}

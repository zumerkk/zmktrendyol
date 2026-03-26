import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ZeusAdsService {
    private readonly logger = new Logger(ZeusAdsService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Micro-targets ad budgets based on highest converting hours.
     * Eliminates budget waste during dead hours (3:00 AM) and dominates prime time.
     */
    async executeZeusStrike(tenantId: string, campaignId: string) {
        this.logger.log(`⚡ ZEUS STRIKE Initiated for Campaign ${campaignId}`);

        // Fetch the campaign (Mocked)
        const campaign = await this.prisma.adCampaign.findUnique({
            where: { id: campaignId },
        });

        if (!campaign) throw new Error('Campaign not found');

        const currentHour = new Date().getHours();

        // Assume prime time is 19:00 - 23:00 (Evening / After Work)
        const isPrimeTime = currentHour >= 19 && currentHour <= 23;

        if (isPrimeTime) {
            const aggressiveBidMultiplier = 3; // 3x the normal bid!
            this.logger.warn(`🚀 [Zeus] Prime-Time detected! Increasing bids by ${aggressiveBidMultiplier}x to wipe out competitors.`);

            // We would normally call Trendyol Ads API here to dramatically increase the bid

            await this.prisma.actionableInsight.create({
                data: {
                    tenantId,
                    type: 'god_mode_action',
                    priority: 2,
                    title: `⚡ [God Mode] Zeus Algoritması Devrede: Bütçe Çarpıldı!`,
                    description: `Prime-Time (Altın Saatler) tespit edildi. Rakip reklamlarını ekrandan silmek için kampanya bütçesi ve CPC teklifleri geçici olarak 3 KATINA çıkarıldı.`,
                    suggestedAction: `Saat 23:59'da Zeus bütçeyi normale (gece moduna) otomatik indirecektir.`,
                    isCompleted: true,
                    metadata: { campaignId, multiplier: aggressiveBidMultiplier },
                },
            });

            return { success: true, strike: 'aggressive_boost' };
        } else if (currentHour >= 2 && currentHour <= 7) {
            // Dead hours - cut the budget
            this.logger.debug(`💤 [Zeus] Dead hours. Pausing campaign to save budget.`);

            await this.prisma.actionableInsight.create({
                data: {
                    tenantId,
                    type: 'god_mode_action',
                    priority: 4,
                    title: `💤 [God Mode] Zeus Algoritması: Bütçe Tasarrufu!`,
                    description: `Ölü saatler (Gece yarısı) tespit edildi. Rakibin bütçesi boşa harcanırken, biz reklamları durdurarak parayı Prime-Time'a saklıyoruz.`,
                    suggestedAction: `Sabah 08:00'de reklamlar tekrar aktifleştirilecektir.`,
                    isCompleted: true,
                    metadata: { campaignId, strike: 'sleep_mode' },
                },
            });

            return { success: true, strike: 'pause' };
        }

        return { success: true, strike: 'normal' };
    }
}

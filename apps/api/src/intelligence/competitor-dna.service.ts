import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CompetitorDnaService {
    private readonly logger = new Logger(CompetitorDnaService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Builds a DNA profile of a specific competitor based on their historical actions.
     * Analyzes price changes, stock drops, and time patterns to predict next moves.
     */
    async analyzeCompetitorDna(competitorProductId: string) {
        const compProduct = await this.prisma.competitorProduct.findUnique({
            where: { id: competitorProductId },
            include: {
                snapshots: {
                    orderBy: { time: 'asc' },
                    take: 50 // analyzing last 50 data points
                }
            }
        });

        if (!compProduct || compProduct.snapshots.length < 5) {
            return { error: 'Insufficient data to build DNA profile. Need at least 5 snapshots.' };
        }

        const snapshots = compProduct.snapshots;
        let priceDrops = 0;
        let priceIncreases = 0;
        let totalPriceChanges = 0;
        let dropsOnWeekends = 0;
        let dropsAtNight = 0;

        for (let i = 1; i < snapshots.length; i++) {
            const prevPrice = Number(snapshots[i - 1].price || 0);
            const currPrice = Number(snapshots[i].price || 0);

            if (prevPrice > 0 && currPrice > 0 && prevPrice !== currPrice) {
                totalPriceChanges++;
                const time = new Date(snapshots[i].time);
                const isWeekend = time.getDay() === 0 || time.getDay() === 6;
                const isNight = time.getHours() >= 22 || time.getHours() < 6;

                if (currPrice < prevPrice) {
                    priceDrops++;
                    if (isWeekend) dropsOnWeekends++;
                    if (isNight) dropsAtNight++;
                } else {
                    priceIncreases++;
                }
            }
        }

        // Calculate probabilities
        const dropProbability = totalPriceChanges > 0 ? (priceDrops / totalPriceChanges) * 100 : 0;
        const increaseProbability = totalPriceChanges > 0 ? (priceIncreases / totalPriceChanges) * 100 : 0;

        // Behavioral tagging
        const tags = [];
        if (dropProbability > 70) tags.push('Aggressive Undercutter');
        if (priceIncreases > priceDrops * 2) tags.push('Margin Protector');
        if (dropsOnWeekends > priceDrops * 0.5) tags.push('Weekend Warrior (Drops prices on weekends)');
        if (dropsAtNight > priceDrops * 0.4) tags.push('Night Owl (Changes prices late at night)');
        if (totalPriceChanges === 0) tags.push('Static Pricer (Rarely changes price)');

        // Final prediction based on DNA
        let nextMovePrediction = 'No imminent change expected.';
        let predictedActionProbability = 0;

        const currentDay = new Date().getDay();
        const currentHour = new Date().getHours();

        if (tags.includes('Weekend Warrior (Drops prices on weekends)') && (currentDay === 5 || currentDay === 6)) {
            nextMovePrediction = 'High probability of a price drop heading into the weekend.';
            predictedActionProbability = 80;
        } else if (tags.includes('Night Owl (Changes prices late at night)') && (currentHour >= 20)) {
            nextMovePrediction = 'High probability of a price drop tonight.';
            predictedActionProbability = 75;
        } else if (dropProbability > 60) {
            nextMovePrediction = 'Consistently drops prices. Expect undercutting soon.';
            predictedActionProbability = Math.round(dropProbability);
        } else {
            predictedActionProbability = 15;
            nextMovePrediction = 'Price expected to remain stable.';
        }

        return {
            competitorProductId,
            productTitle: compProduct.title,
            brand: compProduct.brand,
            dataPointsAnalyzed: snapshots.length,
            dnaProfile: {
                totalPriceChanges,
                priceDrops,
                priceIncreases,
                dropProbability: Math.round(dropProbability),
                increaseProbability: Math.round(increaseProbability),
                tags
            },
            intentPrediction: {
                nextMove: nextMovePrediction,
                probabilityPercent: predictedActionProbability
            }
        };
    }
}

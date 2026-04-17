import { Injectable } from '@nestjs/common';
import { RivalDecisionType } from '@prisma/client';

export interface DecisionInput {
  targetMinPrice?: number | null;
  lowestPrice?: number | null;
  variantSpread?: number | null;
  closuresCount: number;
  openingsCount: number;
  basketSignal?: boolean;
}

@Injectable()
export class DecisionEngine {
  decide(input: DecisionInput): { decision: RivalDecisionType; score: number; reasons: string[] } {
    let score = 50;
    const reasons: string[] = [];

    if (input.targetMinPrice != null && input.lowestPrice != null) {
      if (input.lowestPrice < input.targetMinPrice) {
        score += 25;
        reasons.push('Rakip fiyatı hedef alt sınırın altında → fırsat');
      } else {
        score -= 5;
      }
    }

    if (input.variantSpread != null) {
      if (input.variantSpread >= 0.2) {
        score += 10;
        reasons.push('Varyant fiyat farkı çok yüksek → bazı numaralarda fırsat olabilir');
      } else if (input.variantSpread >= 0.12) {
        score += 5;
        reasons.push('Varyant fiyat farkı var → fırsat takibi');
      }
    }

    if (input.closuresCount >= 5) {
      score += 10;
      reasons.push('Birçok beden kapanıyor → talep/stoğa baskı olabilir');
    } else if (input.closuresCount > 0) {
      score += 3;
      reasons.push('Bazı bedenler kapanıyor → stok daralıyor olabilir');
    }

    if (input.openingsCount > 0) {
      score -= 2;
      reasons.push('Bazı bedenler yeniden açıldı → stok yenilenmiş olabilir');
    }

    if (input.basketSignal) {
      score += 2;
      reasons.push('Kampanya/sepette sinyali var → fiyat baskısı olabilir');
    }

    score = Math.max(0, Math.min(100, score));

    let decision: RivalDecisionType = 'IZLE';
    if (score >= 75) decision = 'AL';
    else if (score >= 55) decision = 'IZLE';
    else if (score >= 40) decision = 'BEKLE';
    else decision = 'ALMA';

    return { decision, score, reasons: reasons.slice(0, 3) };
  }
}

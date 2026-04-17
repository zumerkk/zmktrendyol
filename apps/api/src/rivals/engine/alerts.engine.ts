import { Injectable } from '@nestjs/common';

export interface AlertInput {
  targetMinPrice?: number | null;
  lowestPrice?: number | null;
  variantPrices: Array<{ variantKey: string; price: number }>;
  variantClosures: string[];
  variantOpenings: string[];
  basketSignal?: boolean;
}

export type AlertOut = {
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  payload?: any;
};

@Injectable()
export class AlertsEngine {
  evaluate(input: AlertInput): AlertOut[] {
    const out: AlertOut[] = [];

    if (input.targetMinPrice != null && input.lowestPrice != null && input.lowestPrice < input.targetMinPrice) {
      out.push({
        severity: 'critical',
        type: 'price_below_target',
        message: `Rakip en düşük fiyat hedef alt sınırın altına düştü: ₺${input.lowestPrice} < ₺${input.targetMinPrice}`,
        payload: { lowestPrice: input.lowestPrice, targetMinPrice: input.targetMinPrice },
      });
    }

    if (input.variantPrices.length >= 3) {
      const prices = input.variantPrices.map((v) => v.price).sort((a, b) => a - b);
      const min = prices[0];
      const max = prices[prices.length - 1];
      const spread = (max - min) / Math.max(min, 1);
      if (spread >= 0.12) {
        out.push({
          severity: spread >= 0.2 ? 'critical' : 'warning',
          type: 'abnormal_variant_spread',
          message: `Varyant fiyat farkı sıra dışı: min ₺${min} / max ₺${max} (≈%${Math.round(spread * 100)})`,
          payload: { min, max, spread },
        });
      }
    }

    for (const v of input.variantOpenings) {
      out.push({ severity: 'info', type: 'variant_opened', message: `Beden tekrar açıldı: ${v}`, payload: { variantKey: v } });
    }
    for (const v of input.variantClosures) {
      out.push({ severity: 'warning', type: 'variant_closed', message: `Beden kapandı / tükendi: ${v}`, payload: { variantKey: v } });
    }
    if (input.variantClosures.length >= 5) {
      out.push({ severity: 'critical', type: 'mass_variant_closed', message: `Birçok beden aynı anda kapandı (${input.variantClosures.length})`, payload: { count: input.variantClosures.length } });
    }

    if (input.basketSignal) {
      out.push({ severity: 'info', type: 'basket_signal', message: '"Sepette" kampanya sinyali görüldü (fiyat tespit edilemeyebilir).', payload: {} });
    }

    return out;
  }
}

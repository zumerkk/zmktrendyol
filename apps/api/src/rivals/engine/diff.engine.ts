import { Injectable } from '@nestjs/common';
import { RivalVariantScan } from '@prisma/client';

export type RivalEvent =
  | { type: 'price_up' | 'price_down'; variantKey: string; from: number; to: number }
  | { type: 'variant_closed' | 'variant_opened'; variantKey: string }
  | { type: 'basket_signal_changed'; from: boolean; to: boolean };

@Injectable()
export class DiffEngine {
  diffVariants(
    prev: RivalVariantScan[],
    next: Array<{ variantKey: string; salePrice?: number | null; stockSignal: string }>,
  ): RivalEvent[] {
    const events: RivalEvent[] = [];
    const prevMap = new Map(prev.map((v) => [v.variantKey, v]));

    for (const n of next) {
      const p = prevMap.get(n.variantKey);
      if (!p) continue;
      if (typeof p.salePrice === 'number' && typeof n.salePrice === 'number' && p.salePrice !== n.salePrice) {
        events.push({
          type: n.salePrice > p.salePrice ? 'price_up' : 'price_down',
          variantKey: n.variantKey,
          from: Number(p.salePrice),
          to: Number(n.salePrice),
        });
      }
      if (p.stockSignal !== n.stockSignal) {
        if (p.stockSignal !== 'out_of_stock' && n.stockSignal === 'out_of_stock') {
          events.push({ type: 'variant_closed', variantKey: n.variantKey });
        }
        if (p.stockSignal === 'out_of_stock' && n.stockSignal !== 'out_of_stock') {
          events.push({ type: 'variant_opened', variantKey: n.variantKey });
        }
      }
    }
    return events;
  }
}

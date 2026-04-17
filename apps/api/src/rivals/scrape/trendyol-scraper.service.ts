import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { normalizeVariantKey, parsePrice, stockSignalFromText } from './trendyol-normalize';

export interface TrendyolVariantSnapshot {
  variantKey: string;
  listPrice?: number | null;
  salePrice?: number | null;
  availabilityText?: string | null;
  stockSignal: 'out_of_stock' | 'low' | 'medium' | 'high' | 'unknown';
  stockConfidence: number;
}

export interface TrendyolPageSnapshot {
  pageTitle?: string | null;
  title?: string | null;
  brand?: string | null;
  currency: 'TRY';
  merchantId?: string | null;
  boutiqueId?: string | null;
  lowestPrice?: number | null;
  highestPrice?: number | null;
  basketSignal?: boolean;
  variants: TrendyolVariantSnapshot[];
  rawSignals: Record<string, any>;
}

@Injectable()
export class TrendyolScraperService {
  private readonly logger = new Logger(TrendyolScraperService.name);

  async scrape(url: string): Promise<TrendyolPageSnapshot> {
    const u = new URL(url);
    const merchantId = u.searchParams.get('merchantId');
    const boutiqueId = u.searchParams.get('boutiqueId');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      locale: 'tr-TR',
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    const rawSignals: Record<string, any> = {};
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);

      const bodyText = await page.textContent('body');
      const basketSignal = !!(bodyText && bodyText.toLowerCase().includes('sepette'));
      rawSignals.basketSignal = basketSignal;

      const title =
        (await page.textContent('h1')) ||
        (await page.textContent('[data-testid="product-name"]')) ||
        null;

      const priceText =
        (await page.textContent('[data-testid="price-current-price"]').catch(() => null)) ||
        (await page.textContent('[data-testid="discounted-price"]').catch(() => null)) ||
        (await page.textContent('.prc-dsc').catch(() => null)) ||
        (await page.textContent('.product-price-container').catch(() => null)) ||
        null;
      const currentPrice = parsePrice(priceText);

      // Varyant butonları (numara/beden) — best-effort
      const variantCandidates = await page.$$eval('button, a', (els) => {
        const out: Array<{ text: string; disabled: boolean }> = [];
        for (const el of els as any[]) {
          const txt = (el.innerText || '').trim();
          if (!txt) continue;
          if (!/^\d{2}([.,]5)?$/.test(txt)) continue; // 36, 42.5 vb.
          const disabled =
            !!(el.disabled) ||
            (el.getAttribute?.('aria-disabled') === 'true') ||
            (el.className && String(el.className).toLowerCase().includes('disabled'));
          out.push({ text: txt, disabled });
        }
        const seen = new Set<string>();
        return out.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));
      });

      const variants: TrendyolVariantSnapshot[] = [];

      if (variantCandidates.length === 0) {
        variants.push({
          variantKey: 'UNKNOWN',
          salePrice: currentPrice,
          stockSignal: 'unknown',
          stockConfidence: 0.2,
          availabilityText: null,
        });
      } else {
        for (const c of variantCandidates.slice(0, 30)) {
          try {
            const locator = page.getByRole('button', { name: c.text }).first();
            if (await locator.count()) {
              await locator.click({ timeout: 2000 });
              await page.waitForTimeout(500);
            }
          } catch {
            // click başarısız olabilir; devam et
          }

          const afterPriceText =
            (await page.textContent('[data-testid="price-current-price"]').catch(() => null)) ||
            (await page.textContent('[data-testid="discounted-price"]').catch(() => null)) ||
            (await page.textContent('.prc-dsc').catch(() => null)) ||
            null;
          const salePrice = parsePrice(afterPriceText) ?? currentPrice;

          const availabilityText =
            (await page.textContent('[data-testid="delivery-time"]').catch(() => null)) ||
            (await page.textContent('.delivery-info').catch(() => null)) ||
            null;
          const stock = stockSignalFromText(availabilityText);

          variants.push({
            variantKey: normalizeVariantKey(c.text),
            salePrice,
            stockSignal: c.disabled ? 'out_of_stock' : stock.signal,
            stockConfidence: c.disabled ? 0.95 : stock.confidence,
            availabilityText,
          });
        }
      }

      const prices = variants.map((v) => v.salePrice).filter((p): p is number => typeof p === 'number');
      const lowestPrice = prices.length ? Math.min(...prices) : currentPrice;
      const highestPrice = prices.length ? Math.max(...prices) : currentPrice;

      return {
        pageTitle: await page.title(),
        title,
        brand: null,
        currency: 'TRY',
        merchantId,
        boutiqueId,
        lowestPrice: lowestPrice ?? null,
        highestPrice: highestPrice ?? null,
        basketSignal,
        variants,
        rawSignals,
      };
    } catch (err: any) {
      this.logger.warn(`Scrape failed: ${err?.message || err}`);
      return {
        currency: 'TRY',
        merchantId,
        boutiqueId,
        variants: [],
        rawSignals: { error: String(err?.message || err) },
      };
    } finally {
      await page.close().catch(() => undefined);
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }
}

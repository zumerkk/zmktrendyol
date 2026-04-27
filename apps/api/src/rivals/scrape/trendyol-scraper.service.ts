import { Injectable, Logger } from "@nestjs/common";
import { normalizeVariantKey, parsePrice, stockSignalFromText } from "./trendyol-normalize";

export interface TrendyolVariantSnapshot {
  variantKey: string;
  listPrice?: number | null;
  salePrice?: number | null;
  availabilityText?: string | null;
  stockSignal: "out_of_stock" | "low" | "medium" | "high" | "unknown";
  stockConfidence: number;
}

export interface TrendyolPageSnapshot {
  pageTitle?: string | null;
  title?: string | null;
  brand?: string | null;
  currency: "TRY";
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

  /**
   * Trendyol ürün sayfasını HTTP ile scrape eder.
   * Playwright yerine doğrudan fetch + JSON-LD / API parse kullanır.
   * Trendyol "Sepette gör" kampanyalarında bile fiyatı yakalar.
   */
  async scrape(url: string): Promise<TrendyolPageSnapshot> {
    const u = new URL(url);
    const merchantId = u.searchParams.get("merchantId");
    const boutiqueId = u.searchParams.get("boutiqueId");
    const rawSignals: Record<string, any> = {};

    try {
      // === YÖNTEM 1: Trendyol API'sinden direkt veri çek ===
      const contentId = this.extractContentId(url);
      if (contentId) {
        const apiResult = await this.scrapeViaApi(contentId, rawSignals);
        if (apiResult && apiResult.variants.length > 0) {
          this.logger.log(`API scrape başarılı: ${contentId} → ${apiResult.variants.length} varyant, fiyat: ₺${apiResult.lowestPrice}`);
          return { ...apiResult, merchantId, boutiqueId };
        }
      }

      // === YÖNTEM 2: HTTP GET + HTML Parse ===
      const htmlResult = await this.scrapeViaHtml(url, rawSignals);
      if (htmlResult && (htmlResult.lowestPrice || htmlResult.variants.length > 0)) {
        this.logger.log(`HTML scrape başarılı: ${htmlResult.title} → fiyat: ₺${htmlResult.lowestPrice}`);
        return { ...htmlResult, merchantId, boutiqueId };
      }

      // Fallback — boş dönüş
      this.logger.warn(`Scrape: Fiyat bulunamadı — ${url}`);
      return {
        currency: "TRY",
        merchantId,
        boutiqueId,
        title: htmlResult?.title || null,
        pageTitle: htmlResult?.pageTitle || null,
        brand: htmlResult?.brand || null,
        basketSignal: rawSignals.basketSignal || false,
        lowestPrice: null,
        highestPrice: null,
        variants: htmlResult?.variants || [],
        rawSignals,
      };
    } catch (err: any) {
      this.logger.warn(`Scrape failed: ${err?.message || err}`);
      return {
        currency: "TRY",
        merchantId,
        boutiqueId,
        variants: [],
        rawSignals: { error: String(err?.message || err) },
      };
    }
  }

  /**
   * Trendyol URL'den contentId'yi çıkar.
   * Format: /brand-urun-adi-p-123456789 → 123456789
   */
  private extractContentId(url: string): string | null {
    const match = url.match(/-p-(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Trendyol'un public widget API'sinden ürün verisini çeker.
   * Bu yöntem "Sepette gör" kampanyalarından etkilenmez.
   */
  private async scrapeViaApi(contentId: string, rawSignals: Record<string, any>): Promise<TrendyolPageSnapshot | null> {
    try {
      const apiUrl = `https://public.trendyol.com/discovery-web-productgw-service/api/productDetail/${contentId}`;
      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Accept-Language": "tr-TR,tr;q=0.9",
          "Referer": "https://www.trendyol.com/",
          "Origin": "https://www.trendyol.com",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        rawSignals.apiStatus = response.status;
        return null;
      }

      const data: any = await response.json();
      rawSignals.apiSource = "discovery-api";

      const result = data?.result;
      if (!result) return null;

      const title = result.name || result.productName || null;
      const brand = result.brand?.name || null;

      // Fiyat bilgisi
      const price = result.price || {};
      const originalPrice = price.originalPrice || price.buyingPrice || 0;
      const sellingPrice = price.sellingPrice || price.discountedPrice || originalPrice;
      const basketSignal = !!(price.showInBasketPrice || result.showVariantPriceInBasket);
      rawSignals.basketSignal = basketSignal;

      // Kampanyalı fiyat (sepette gör bile olsa API'de var!)
      const campaignPrice = price.discountedPrice || price.sellingPrice || 0;
      rawSignals.priceSource = basketSignal ? "basket-campaign-api" : "direct-api";

      // Varyantlar
      const variants: TrendyolVariantSnapshot[] = [];
      const allVariants = result.allVariants || result.variants || [];

      if (allVariants.length > 0) {
        for (const v of allVariants.slice(0, 50)) {
          const attrValue = v.attributeValue || v.value || v.barcode || "UNKNOWN";
          const vPrice = v.price?.sellingPrice || v.price?.discountedPrice || v.price?.originalPrice || sellingPrice;
          const vListPrice = v.price?.originalPrice || v.listPrice || originalPrice;
          const inStock = v.inStock !== false && v.stock !== 0 && !v.hasNoStock;

          // Stok bilgisi
          let stockSignal: "out_of_stock" | "low" | "medium" | "high" | "unknown" = "unknown";
          let stockConfidence = 0.3;

          if (!inStock || v.hasNoStock) {
            stockSignal = "out_of_stock";
            stockConfidence = 0.95;
          } else if (v.stock !== undefined && typeof v.stock === 'number') {
            if (v.stock <= 3) { stockSignal = "low"; stockConfidence = 0.85; }
            else if (v.stock <= 10) { stockSignal = "medium"; stockConfidence = 0.65; }
            else { stockSignal = "high"; stockConfidence = 0.55; }
          } else {
            stockSignal = inStock ? "high" : "unknown";
            stockConfidence = inStock ? 0.5 : 0.2;
          }

          variants.push({
            variantKey: normalizeVariantKey(String(attrValue)),
            listPrice: vListPrice || null,
            salePrice: vPrice || null,
            stockSignal,
            stockConfidence,
            availabilityText: inStock ? "Stokta var" : "Tükendi",
          });
        }
      } else {
        // Tek varyant
        variants.push({
          variantKey: "TEK-BEDEN",
          listPrice: originalPrice || null,
          salePrice: sellingPrice || null,
          stockSignal: result.hasStock !== false ? "high" : "out_of_stock",
          stockConfidence: 0.6,
          availabilityText: result.hasStock !== false ? "Stokta var" : "Tükendi",
        });
      }

      const prices = variants.map(v => v.salePrice).filter((p): p is number => typeof p === "number" && p > 0);
      const lowestPrice = prices.length ? Math.min(...prices) : campaignPrice || sellingPrice || null;
      const highestPrice = prices.length ? Math.max(...prices) : campaignPrice || originalPrice || null;

      return {
        pageTitle: title,
        title,
        brand,
        currency: "TRY",
        lowestPrice,
        highestPrice,
        basketSignal,
        variants,
        rawSignals,
      };
    } catch (err: any) {
      this.logger.debug(`API scrape failed: ${err?.message}`);
      rawSignals.apiError = err?.message;
      return null;
    }
  }

  /**
   * HTTP HTML parse — Trendyol'un embedded JSON fiyat pattern'ini kullanır.
   * Pattern: sellingPrice":{"value":3999,"text":"3.999 TL"}
   * "Sepette gör" kampanyalarında bile fiyatı yakalar.
   */
  private async scrapeViaHtml(url: string, rawSignals: Record<string, any>): Promise<TrendyolPageSnapshot | null> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(20000),
      });

      const html = await response.text();
      rawSignals.htmlSize = html.length;

      // Basket signal
      const lowerHtml = html.toLowerCase();
      const basketSignal = lowerHtml.includes("sepette") || lowerHtml.includes("sepettegor");
      rawSignals.basketSignal = basketSignal;

      // ═══ YÖNTEM 1: Trendyol Embedded JSON Pattern ═══
      // Pattern: sellingPrice":{"value":3999,"text":"3.999 TL"}
      const sellingPrices: number[] = [];
      const originalPrices: number[] = [];
      
      const spMatches = html.matchAll(/sellingPrice["\s]*:["\s]*\{["\s]*"?value["\s]*"?:\s*(\d+(?:\.\d+)?)/g);
      for (const m of spMatches) {
        const p = parseFloat(m[1]);
        if (p > 0) sellingPrices.push(p);
      }

      const opMatches = html.matchAll(/originalPrice["\s]*:["\s]*\{["\s]*"?value["\s]*"?:\s*(\d+(?:\.\d+)?)/g);
      for (const m of opMatches) {
        const p = parseFloat(m[1]);
        if (p > 0) originalPrices.push(p);
      }

      // Discounted price
      const dpMatches = html.matchAll(/discountedPrice["\s]*:["\s]*\{["\s]*"?value["\s]*"?:\s*(\d+(?:\.\d+)?)/g);
      for (const m of dpMatches) {
        const p = parseFloat(m[1]);
        if (p > 0) sellingPrices.push(p);
      }

      rawSignals.sellingPricesFound = [...new Set(sellingPrices)];
      rawSignals.originalPricesFound = [...new Set(originalPrices)];

      // Unique prices
      const uniqueSelling = [...new Set(sellingPrices)].sort((a, b) => a - b);
      const uniqueOriginal = [...new Set(originalPrices)].sort((a, b) => a - b);

      const lowestSelling = uniqueSelling.length > 0 ? uniqueSelling[0] : null;
      const highestSelling = uniqueSelling.length > 0 ? uniqueSelling[uniqueSelling.length - 1] : null;

      if (lowestSelling) {
        rawSignals.priceSource = "embedded-json";
      }

      // ═══ YÖNTEM 2: JSON-LD Fallback ═══
      let jsonLdPrice: number | null = null;
      let jsonLdTitle: string | null = null;
      let jsonLdBrand: string | null = null;

      const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          try {
            const content = match.replace(/<\/?script[^>]*>/gi, "");
            const parsed = JSON.parse(content);
            if (parsed["@type"] === "Product" || parsed.offers) {
              jsonLdTitle = parsed.name || null;
              jsonLdBrand = parsed.brand?.name || null;
              const offers = parsed.offers;
              if (offers) {
                if (Array.isArray(offers)) {
                  const prices = offers.map((o: any) => parseFloat(o.price)).filter((p: number) => !isNaN(p));
                  jsonLdPrice = prices.length ? Math.min(...prices) : null;
                } else {
                  jsonLdPrice = parseFloat(offers.price) || parseFloat(offers.lowPrice) || null;
                }
              }
              if (!rawSignals.priceSource) rawSignals.priceSource = "json-ld";
            }
          } catch {}
        }
      }

      // ═══ YÖNTEM 3: Meta tag fiyat ═══
      let metaPrice: number | null = null;
      const metaPriceMatch = html.match(/property="product:price:amount"\s+content="([^"]+)"/);
      if (metaPriceMatch) {
        metaPrice = parseFloat(metaPriceMatch[1]) || null;
        if (metaPrice && !rawSignals.priceSource) rawSignals.priceSource = "meta-tag";
      }

      // Title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const rawTitle = titleMatch ? titleMatch[1].replace(/ - Trendyol.*$/, "").replace(/ \| Trendyol.*$/, "").trim() : null;
      const title = jsonLdTitle || rawTitle;
      const brand = jsonLdBrand || null;

      // En iyi fiyatı seç — embedded JSON öncelikli
      const bestPrice = lowestSelling || jsonLdPrice || metaPrice || null;
      const bestHighPrice = highestSelling || (uniqueOriginal.length > 0 ? uniqueOriginal[uniqueOriginal.length - 1] : null) || bestPrice;

      // ═══ VARYANT PARSE ═══
      const variants: TrendyolVariantSnapshot[] = [];
      const seenSizes = new Set<string>();

      // Numara/beden bilgisi — HTML'den
      const sizeRegex = /data-(?:value|content|size)="(\d{2,3}(?:[.,]5)?)"[^>]*/gi;
      let sizeMatch;
      while ((sizeMatch = sizeRegex.exec(html)) !== null) {
        const size = sizeMatch[1];
        if (seenSizes.has(size)) continue;
        seenSizes.add(size);
        const ctx = sizeMatch[0].toLowerCase();
        const isDisabled = /disabled|passive|sold-out|tukendi/i.test(ctx);
        variants.push({
          variantKey: normalizeVariantKey(size),
          salePrice: bestPrice,
          listPrice: uniqueOriginal.length > 0 ? uniqueOriginal[0] : null,
          stockSignal: isDisabled ? "out_of_stock" : (bestPrice ? "high" : "unknown"),
          stockConfidence: isDisabled ? 0.9 : (bestPrice ? 0.5 : 0.3),
          availabilityText: isDisabled ? "Tükendi" : (bestPrice ? "Stokta" : null),
        });
      }

      // Varyant yoksa tek beden olarak ekle
      if (variants.length === 0 && bestPrice) {
        variants.push({
          variantKey: "TEK-BEDEN",
          salePrice: bestPrice,
          listPrice: uniqueOriginal.length > 0 ? uniqueOriginal[0] : null,
          stockSignal: "high",
          stockConfidence: 0.5,
          availabilityText: "Stokta",
        });
      }

      this.logger.log(`HTML scrape: ${title} — ₺${bestPrice} (${rawSignals.priceSource || 'none'}, ${variants.length} varyant)`);

      return {
        pageTitle: title,
        title,
        brand,
        currency: "TRY",
        lowestPrice: bestPrice,
        highestPrice: bestHighPrice,
        basketSignal,
        variants,
        rawSignals,
      };
    } catch (err: any) {
      this.logger.debug(`HTML scrape failed: ${err?.message}`);
      return null;
    }
  }
}

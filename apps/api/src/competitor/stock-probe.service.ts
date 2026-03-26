import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { AntiDetectService } from "../scraper/anti-detect.service";

/**
 * StockProbeService — Gölge Stok Takip Sistemi 🕵️
 *
 * Rakip ürünlerin GERÇEK stok seviyesini Playwright ile tespit eder.
 *
 * Yöntem:
 *  1. Ürün sayfasına git (anti-detect: proxy, UA rotation, webdriver mask)
 *  2. Beden/varyant seç (opsiyonel)
 *  3. Yüksek miktar gir (999) → Trendyol hata mesajından max stok oku
 *  4. Binary search ile kesin stok sayısını tespit et
 *  5. Sepeti temizle → iz bırakma
 *  6. Aynı ziyarette fiyat, buybox, satıcı bilgisi de çek
 *  7. Stok delta'dan %100 doğrulukla satış hesapla
 *
 * CRON: Her saat başı aktif probe'ları çalıştır
 * ⚠️ Kaynak: probe (doğrudan observation, %100 doğruluk)
 */
@Injectable()
export class StockProbeService {
  private readonly logger = new Logger(StockProbeService.name);
  private isProbing = false;

  constructor(
    private prisma: PrismaService,
    private antiDetect: AntiDetectService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  //  PROBE MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  /** Enable stock probing for a competitor product */
  async enableProbe(competitorProductId: string, intervalMinutes = 60) {
    const existing = await this.prisma.stockProbe.findFirst({
      where: { competitorProductId, isActive: true },
    });

    if (existing) {
      return this.prisma.stockProbe.update({
        where: { id: existing.id },
        data: { intervalMinutes, isActive: true },
      });
    }

    return this.prisma.stockProbe.create({
      data: {
        competitorProductId,
        intervalMinutes,
        isActive: true,
      },
    });
  }

  /** Disable stock probing */
  async disableProbe(competitorProductId: string) {
    return this.prisma.stockProbe.updateMany({
      where: { competitorProductId },
      data: { isActive: false },
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  CRON SCHEDULER
  // ═══════════════════════════════════════════════════════════

  /** CRON: Her saat başı aktif probeları çalıştır */
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledProbes() {
    if (this.isProbing) {
      this.logger.warn("⏳ Stock probe already running, skipping...");
      return;
    }

    this.isProbing = true;

    try {
      const activeProbes = await this.prisma.stockProbe.findMany({
        where: { isActive: true },
        include: { competitorProduct: true },
      });

      this.logger.log(`🕵️ Running ${activeProbes.length} stock probes...`);

      for (const probe of activeProbes) {
        try {
          // Interval check
          if (probe.lastProbedAt) {
            const minutesSince =
              (Date.now() - probe.lastProbedAt.getTime()) / (1000 * 60);
            if (minutesSince < probe.intervalMinutes) continue;
          }

          await this.executeProbe(
            probe.id,
            probe.competitorProduct.trendyolUrl,
          );

          // Random delay between probes (2-5 sec) to appear human
          await this.humanDelay(2000, 5000);
        } catch (error: any) {
          this.logger.error(
            `❌ Probe failed for ${probe.competitorProduct.trendyolUrl}: ${error.message}`,
          );
        }
      }

      this.logger.log("✅ Stock probe cycle complete");
    } finally {
      this.isProbing = false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  CORE PROBE EXECUTION
  // ═══════════════════════════════════════════════════════════

  /** Execute a single stock probe with full Playwright automation */
  async executeProbe(probeId: string, productUrl: string) {
    const startTime = Date.now();

    try {
      const stockData = await this.playwrightCartProbe(productUrl);

      // Get previous result for delta calculation
      const previousResult = await this.prisma.stockProbeResult.findFirst({
        where: { probeId },
        orderBy: { time: "desc" },
      });

      const delta =
        previousResult?.stockCount != null && stockData.stockCount != null
          ? stockData.stockCount - previousResult.stockCount
          : null;

      // Record result
      const result = await this.prisma.stockProbeResult.create({
        data: {
          probeId,
          stockCount: stockData.stockCount,
          isAvailable: stockData.isAvailable,
          deltaFromPrev: delta,
          method: stockData.method,
          rawResponse: stockData.raw || undefined,
        },
      });

      // Update probe timestamp
      await this.prisma.stockProbe.update({
        where: { id: probeId },
        data: { lastProbedAt: new Date() },
      });

      // Log significant changes
      if (delta !== null && delta < -5) {
        this.logger.warn(
          `🔥 ${Math.abs(delta)} adet satış tespit edildi! (probe: ${probeId})`,
        );
      }
      if (stockData.stockCount !== null && stockData.stockCount < 10) {
        this.logger.warn(
          `⚠️ Düşük stok uyarısı: ${stockData.stockCount} adet kaldı (probe: ${probeId})`,
        );
      }
      if (delta !== null && delta > 0) {
        this.logger.log(
          `📦 Stok yenileme tespit edildi: +${delta} adet (probe: ${probeId})`,
        );
      }

      this.logger.log(
        `✅ Probe complete: stok=${stockData.stockCount}, delta=${delta}, süre=${Date.now() - startTime}ms`,
      );

      return result;
    } catch (error: any) {
      // Record failed probe
      await this.prisma.stockProbeResult.create({
        data: {
          probeId,
          stockCount: null,
          isAvailable: false,
          method: "cart_probe",
          rawResponse: {
            error: error.message,
            duration: Date.now() - startTime,
          },
        },
      });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  PLAYWRIGHT CART PROBE — Ana Motor 🎯
  // ═══════════════════════════════════════════════════════════

  /**
   * Gerçek Playwright tabanlı sepete ekleme yöntemi ile stok tespiti
   *
   * Strateji:
   * 1. Ürün sayfasına git
   * 2. İlk mevcut beden/varyantı seç
   * 3. Miktar alanına 999 yaz → "En fazla X adet" hatasını yakala
   * 4. Hata yoksa binary search ile kesin stok bul
   * 5. Sepeti temizle (iz bırakma)
   * 6. Aynı ziyarette fiyat + satıcı bilgisi de çek
   */
  private async playwrightCartProbe(productUrl: string): Promise<{
    stockCount: number | null;
    isAvailable: boolean;
    method: string;
    price?: number;
    sellerName?: string;
    variants?: Array<{ name: string; stock: number | null }>;
    raw?: any;
  }> {
    let chromium: any;
    try {
      chromium = require("playwright").chromium;
    } catch {
      this.logger.warn("Playwright not found — fallback to page parse");
      return {
        stockCount: null,
        isAvailable: true,
        method: "fallback_no_playwright",
      };
    }

    const config = this.antiDetect.getBrowserConfig();

    const browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        ...(config.proxy ? [`--proxy-server=${config.proxy}`] : []),
      ],
    });

    const context = await browser.newContext({
      userAgent: config.userAgent,
      viewport: {
        width: 1366 + Math.floor(Math.random() * 200),
        height: 768 + Math.floor(Math.random() * 100),
      },
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
      geolocation: { latitude: 39.9334, longitude: 32.8597 }, // Ankara
      permissions: ["geolocation"],
    });

    // Anti-detect injections
    await context.addInitScript(`
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters)
            );
        `);

    const page = await context.newPage();

    try {
      // ── Step 1: Navigate to product page ──────────────────
      this.logger.debug(`🌐 Navigating to ${productUrl}`);
      await page.goto(productUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await this.humanDelay(2000, 4000);

      // ── Step 2: Check if product exists / is available ────
      const outOfStock = await page.$(
        ".pr-out-of-stock, .sold-out-text, .pr-cn-oos",
      );
      if (outOfStock) {
        const rawInfo = await this.extractPageInfo(page);
        return {
          stockCount: 0,
          isAvailable: false,
          method: "cart_probe_oos",
          ...rawInfo,
          raw: { status: "out_of_stock", ...rawInfo },
        };
      }

      // ── Step 3: Select first available variant/size ───────
      await this.selectFirstAvailableVariant(page);
      await this.humanDelay(500, 1500);

      // ── Step 4: Extract page info (price, seller) ─────────
      const pageInfo = await this.extractPageInfo(page);

      // ── Step 5: Try quantity method — Primary strategy ────
      let stockCount = await this.quantityOverflowMethod(page);

      // ── Step 6: If qty method failed, try add-to-cart method
      if (stockCount === null) {
        stockCount = await this.addToCartMethod(page);
      }

      // ── Step 7: Clean up cart (remove added items) ────────
      await this.cleanupCart(page);

      // ── Step 8: Try variant-specific stocks ───────────────
      const variants = await this.probeAllVariants(page);

      return {
        stockCount,
        isAvailable: stockCount === null || stockCount > 0,
        method: stockCount !== null ? "cart_probe_qty" : "cart_probe_partial",
        ...pageInfo,
        variants: variants.length > 0 ? variants : undefined,
        raw: {
          stockCount,
          ...pageInfo,
          variants,
          probeTime: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      this.logger.error(`Playwright probe error: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  STOCK DETECTION METHODS
  // ═══════════════════════════════════════════════════════════

  /**
   * Method 1: Quantity Overflow — Miktar alanına 999 yaz
   * Trendyol response: "En fazla X adet ekleyebilirsiniz"
   * → X = exact stock count
   */
  private async quantityOverflowMethod(page: any): Promise<number | null> {
    try {
      // Find quantity input
      const qtyInput = await page.$(
        '.pr-in-cn input[type="number"], .quantity-input, input.counter-content',
      );
      if (!qtyInput) {
        this.logger.debug("No quantity input found");
        return null;
      }

      // Clear and type 999
      await qtyInput.click({ clickCount: 3 });
      await this.humanDelay(200, 500);
      await qtyInput.fill("999");
      await this.humanDelay(300, 700);
      await qtyInput.press("Tab");
      await this.humanDelay(1000, 2000);

      // Look for max stock message
      // Trendyol shows: "En fazla X adet sipariş verebilirsiniz" or "Bu üründen en fazla X adet..."
      const maxMessage = await page
        .$eval(
          '.pr-in-error, .qty-error, .add-to-cart-error, [class*="error"], [class*="warning"]',
          (el: any) => el?.textContent?.trim(),
        )
        .catch(() => null);

      if (maxMessage) {
        // Extract number from error message
        const match = maxMessage.match(/(\d+)/);
        if (match) {
          const maxStock = parseInt(match[1], 10);
          this.logger.log(`📊 Quantity overflow detected: max=${maxStock}`);

          // Reset quantity to 1
          await qtyInput.click({ clickCount: 3 });
          await qtyInput.fill("1");
          return maxStock;
        }
      }

      // Check if the input was auto-corrected to a max value
      const correctedValue = await qtyInput.inputValue();
      if (correctedValue && correctedValue !== "999") {
        const maxStock = parseInt(correctedValue, 10);
        if (maxStock > 0 && maxStock < 999) {
          this.logger.log(`📊 Input auto-corrected to: ${maxStock}`);
          await qtyInput.click({ clickCount: 3 });
          await qtyInput.fill("1");
          return maxStock;
        }
      }

      // Reset quantity
      await qtyInput.click({ clickCount: 3 });
      await qtyInput.fill("1");

      return null;
    } catch (error: any) {
      this.logger.debug(`Quantity overflow method failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Method 2: Add-to-Cart + Error Parse
   * Sepete ekle butonuna tıkla → yanıt/hata mesajından stok bilgisi çek
   */
  private async addToCartMethod(page: any): Promise<number | null> {
    try {
      // Click add to cart button
      const addBtn = await page.$(
        ".add-to-bs-txt, button.add-to-basket, .pr-in-btn",
      );
      if (!addBtn) return null;

      await addBtn.click();
      await this.humanDelay(1500, 3000);

      // Check for stock-related error messages
      const errorMsg = await page
        .$eval(
          '.modal-content, .notification-content, [class*="toast"], [class*="error"], [class*="alert"]',
          (el: any) => el?.textContent?.trim(),
        )
        .catch(() => null);

      if (errorMsg) {
        // "Bu üründen en fazla 15 adet ekleyebilirsiniz."
        const match = errorMsg.match(/(\d+)\s*(adet|ürün)/i);
        if (match) {
          this.logger.log(`📊 Add-to-cart error: max=${match[1]}`);
          return parseInt(match[1], 10);
        }
      }

      // If successfully added to cart, we know stock >= 1
      // Check cart badge / notification for cart count indicator
      const cartBadge = await page.$(
        ".basket-count, .cart-count, .header-basket-count",
      );
      if (cartBadge) {
        this.logger.debug(
          "Item added to cart — stock >= 1, will use binary search",
        );
        return await this.binarySearchStock(page);
      }

      return null;
    } catch (error: any) {
      this.logger.debug(`Add-to-cart method failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Method 3: Binary Search — When we know stock >= 1
   * Iteratively try adding more to find exact limit
   * Binary search: try 128, 64, 32, 16, 8, 4, 2, 1
   */
  private async binarySearchStock(page: any): Promise<number | null> {
    try {
      const qtyInput = await page.$(
        '.pr-in-cn input[type="number"], .quantity-input, input.counter-content',
      );
      if (!qtyInput) return null;

      let low = 1;
      let high = 500;
      let maxSuccessful = 1;

      // Test powers of 2 first for speed
      const testValues = [256, 128, 64, 32, 16, 8, 4, 2];

      for (const testQty of testValues) {
        await qtyInput.click({ clickCount: 3 });
        await qtyInput.fill(String(testQty));
        await qtyInput.press("Tab");
        await this.humanDelay(500, 1000);

        // Check if value was accepted or auto-corrected
        const currentVal = await qtyInput.inputValue();
        const parsedVal = parseInt(currentVal, 10);

        if (parsedVal < testQty) {
          // Auto-corrected = max is parsedVal
          high = parsedVal;
          maxSuccessful = parsedVal;
          break;
        } else if (parsedVal === testQty) {
          // Accepted = stock >= testQty
          low = testQty;
          maxSuccessful = testQty;
        }

        // Check for error message
        const hasError = await page.$(
          '.pr-in-error, .qty-error, [class*="error"]',
        );
        if (hasError) {
          high = testQty - 1;
          const errorText = await hasError.textContent().catch(() => "");
          const match = errorText?.match(/(\d+)/);
          if (match) {
            maxSuccessful = parseInt(match[1], 10);
            break;
          }
          break;
        }
      }

      // Reset
      await qtyInput.click({ clickCount: 3 });
      await qtyInput.fill("1");

      this.logger.log(`📊 Binary search result: ~${maxSuccessful} units`);
      return maxSuccessful;
    } catch (error: any) {
      this.logger.debug(`Binary search failed: ${error.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  VARIANT / SIZE PROBING
  // ═══════════════════════════════════════════════════════════

  /**
   * Select first available variant (size/color)
   * Trendyol marks out-of-stock variants with "so" (strike-out) class
   */
  private async selectFirstAvailableVariant(page: any) {
    try {
      // Try size buttons first
      const sizeButtons = await page.$$(
        ".sp-itm:not(.so), .variant-item:not(.disabled)",
      );
      if (sizeButtons.length > 0) {
        await sizeButtons[0].click();
        await this.humanDelay(500, 1000);
        this.logger.debug(`Selected first available variant`);
        return true;
      }

      // Try color swatches
      const colorSwatches = await page.$$(
        ".slc-img:not(.so), .color-item:not(.disabled)",
      );
      if (colorSwatches.length > 0) {
        await colorSwatches[0].click();
        await this.humanDelay(500, 1000);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Probe stock for ALL variants
   * Returns per-variant stock levels
   */
  private async probeAllVariants(
    page: any,
  ): Promise<
    Array<{ name: string; stock: number | null; available: boolean }>
  > {
    const results: Array<{
      name: string;
      stock: number | null;
      available: boolean;
    }> = [];

    try {
      const variantButtons = await page.$$(".sp-itm, .variant-item");
      if (variantButtons.length <= 1) return results; // No variants

      for (const btn of variantButtons.slice(0, 10)) {
        // Max 10 variants
        const name = await btn.textContent().catch(() => "unknown");
        const isDisabled = await btn
          .getAttribute("class")
          .then(
            (cls: string) => cls?.includes("so") || cls?.includes("disabled"),
          )
          .catch(() => false);

        if (isDisabled) {
          results.push({
            name: name?.trim() || "unknown",
            stock: 0,
            available: false,
          });
          continue;
        }

        // Click variant
        await btn.click().catch(() => {});
        await this.humanDelay(800, 1500);

        // Quick stock check for this variant
        const stock = await this.quantityOverflowMethod(page);
        results.push({
          name: name?.trim() || "unknown",
          stock,
          available: true,
        });
      }
    } catch (error: any) {
      this.logger.debug(`Variant probing error: ${error.message}`);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════
  //  PAGE INFO EXTRACTION (Bonus: price + seller in same visit)
  // ═══════════════════════════════════════════════════════════

  /** Extract price, seller, and other info from the already-loaded page */
  private async extractPageInfo(page: any): Promise<{
    price?: number;
    sellerName?: string;
    buyboxSellers?: Array<{ name: string; price: number }>;
  }> {
    try {
      // Price
      const priceText = await page
        .$eval(".prc-dsc, .product-price-container .prc-dsc", (el: any) =>
          el?.textContent?.trim(),
        )
        .catch(() => null);
      const price = priceText
        ? parseFloat(priceText.replace(/[^\d,.]/g, "").replace(",", "."))
        : undefined;

      // Seller name
      const sellerName = await page
        .$eval(".merchant-text, .seller-name-text a", (el: any) =>
          el?.textContent?.trim(),
        )
        .catch(() => undefined);

      // Buybox sellers (other sellers)
      const buyboxSellers: Array<{ name: string; price: number }> = [];
      const otherSellers = await page.$$(".other-sellers-item, .pr-mchr-item");
      for (const seller of otherSellers.slice(0, 5)) {
        const name = await seller
          .$eval(".os-seller-name, .merchant-text", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => "");
        const sPriceText = await seller
          .$eval(".os-seller-price, .prc-dsc", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => "");
        const sPrice = sPriceText
          ? parseFloat(sPriceText.replace(/[^\d,.]/g, "").replace(",", "."))
          : 0;
        if (name) buyboxSellers.push({ name, price: sPrice });
      }

      return {
        price: price && !isNaN(price) ? price : undefined,
        sellerName,
        buyboxSellers: buyboxSellers.length > 0 ? buyboxSellers : undefined,
      };
    } catch {
      return {};
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  CART CLEANUP — İz Bırakma!
  // ═══════════════════════════════════════════════════════════

  /** Remove items from cart to leave no trace */
  private async cleanupCart(page: any) {
    try {
      // Navigate to cart
      await page
        .goto("https://www.trendyol.com/sepet", {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        })
        .catch(() => {});
      await this.humanDelay(1000, 2000);

      // Find and click all remove buttons
      const removeButtons = await page.$$(
        '.i-trash, .remove-button, [data-testid="remove-item"], .delete-item-btn',
      );
      for (const btn of removeButtons) {
        await btn.click().catch(() => {});
        await this.humanDelay(300, 800);
      }

      // Confirm removal if dialog appears
      const confirmBtn = await page.$(
        '.modal-btn-confirm, .btn-primary, [data-testid="confirm-button"]',
      );
      if (confirmBtn) {
        await confirmBtn.click().catch(() => {});
        await this.humanDelay(500, 1000);
      }

      this.logger.debug("🧹 Cart cleaned");
    } catch {
      this.logger.debug("Cart cleanup skipped (no items or error)");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  ANALYTICS — Satış Hesaplama
  // ═══════════════════════════════════════════════════════════

  /**
   * Get stock history for a competitor product
   */
  async getStockHistory(competitorProductId: string, hours = 168) {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const probe = await this.prisma.stockProbe.findFirst({
      where: { competitorProductId },
    });

    if (!probe) {
      return {
        data: [],
        source: "probe" as const,
        message: "No stock probe configured",
      };
    }

    const results = await this.prisma.stockProbeResult.findMany({
      where: {
        probeId: probe.id,
        time: { gte: startDate },
      },
      orderBy: { time: "asc" },
    });

    return {
      data: results.map((r) => ({
        time: r.time,
        stockCount: r.stockCount,
        isAvailable: r.isAvailable,
        delta: r.deltaFromPrev,
        method: r.method,
      })),
      source: "probe" as const,
      disclaimer:
        "⚠️ Stok verileri sepete ekleme simülasyonu ile elde edilmiştir (%100 doğruluk).",
    };
  }

  /**
   * Calculate sales from stock delta
   * Delta negatifse = satış | Delta pozitifse = stok yenileme
   *
   * Örnek: Stok 100 → 80 = -20 delta = 20 adet satış (%100 doğruluk)
   */
  async calculateSalesFromStockDelta(competitorProductId: string, hours = 24) {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const probe = await this.prisma.stockProbe.findFirst({
      where: { competitorProductId },
    });

    if (!probe) {
      return {
        totalSales: null,
        source: "probe" as const,
        confidence: 0,
        message: "No stock probe configured",
      };
    }

    const results = await this.prisma.stockProbeResult.findMany({
      where: {
        probeId: probe.id,
        time: { gte: startDate },
        deltaFromPrev: { not: null },
      },
      orderBy: { time: "asc" },
    });

    // Negative deltas = sales
    const salesDeltas = results.filter((r) => (r.deltaFromPrev || 0) < 0);
    const totalSales = salesDeltas.reduce(
      (sum, r) => sum + Math.abs(r.deltaFromPrev || 0),
      0,
    );

    // Positive deltas = restocking
    const restockDeltas = results.filter((r) => (r.deltaFromPrev || 0) > 0);
    const totalRestock = restockDeltas.reduce(
      (sum, r) => sum + (r.deltaFromPrev || 0),
      0,
    );

    // Sales velocity
    const hoursOfData =
      results.length > 1
        ? (results[results.length - 1].time.getTime() -
            results[0].time.getTime()) /
          (1000 * 60 * 60)
        : hours;
    const salesPerHour = hoursOfData > 0 ? totalSales / hoursOfData : 0;
    const salesPerDay = salesPerHour * 24;

    // Get current stock for depletion estimate
    const latestResult = await this.prisma.stockProbeResult.findFirst({
      where: { probeId: probe.id, stockCount: { not: null } },
      orderBy: { time: "desc" },
    });
    const currentStock = latestResult?.stockCount || 0;
    const daysUntilDepletion =
      salesPerDay > 0 ? Math.round(currentStock / salesPerDay) : null;

    return {
      totalSales,
      totalRestock,
      currentStock,
      salesPerHour: Math.round(salesPerHour * 100) / 100,
      salesPerDay: Math.round(salesPerDay * 100) / 100,
      daysUntilDepletion,
      periodHours: hours,
      dataPoints: results.length,
      salesBreakdown: salesDeltas.map((r) => ({
        time: r.time,
        unitsSold: Math.abs(r.deltaFromPrev || 0),
      })),
      restockBreakdown: restockDeltas.map((r) => ({
        time: r.time,
        unitsAdded: r.deltaFromPrev || 0,
      })),
      source: "probe" as const,
      confidence:
        results.length >= 5
          ? 98
          : results.length >= 3
            ? 90
            : results.length >= 1
              ? 70
              : 0,
      disclaimer:
        "⚠️ Stok delta = satış. Yenileme ayrı raporlanır. %100 doğru veri.",
    };
  }

  /**
   * Get all active probes for a tenant with latest status
   */
  async getActiveProbes(tenantId: string) {
    return this.prisma.stockProbe.findMany({
      where: {
        isActive: true,
        competitorProduct: { tenantId },
      },
      include: {
        competitorProduct: {
          select: { id: true, title: true, trendyolUrl: true },
        },
        results: {
          orderBy: { time: "desc" },
          take: 3,
        },
      },
    });
  }

  /**
   * Manually trigger a probe for a specific competitor product
   */
  async triggerManualProbe(competitorProductId: string) {
    const probe = await this.prisma.stockProbe.findFirst({
      where: { competitorProductId },
      include: { competitorProduct: true },
    });

    if (!probe) {
      // Auto-enable if not set up
      const cp = await this.prisma.competitorProduct.findUnique({
        where: { id: competitorProductId },
      });
      if (!cp) throw new Error("Competitor product not found");

      const newProbe = await this.enableProbe(competitorProductId);
      return this.executeProbe(newProbe.id, cp.trendyolUrl);
    }

    return this.executeProbe(probe.id, probe.competitorProduct.trendyolUrl);
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════

  /** Human-like random delay */
  private humanDelay(minMs = 1000, maxMs = 3000): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

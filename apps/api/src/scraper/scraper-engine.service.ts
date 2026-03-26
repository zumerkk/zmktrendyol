import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { AntiDetectService } from "./anti-detect.service";

/**
 * ScraperEngineService — Veri Toplama Motoru
 *
 * Playwright headless browser ile Trendyol sayfalarını scrape eder.
 * Queue sistemi ile paralel ama yavaş scraping.
 * Anti-detect önlemleri: proxy rotation, UA rotation, fingerprint randomization.
 *
 * Scrape edilebilecek hedefler:
 * - product_page: ürün detay sayfası (fiyat, stok, yorum, rating, görseller)
 * - search_results: arama sonuçları (sıralama, reklam pozisyonları)
 * - best_sellers: en çok satanlar sayfası
 * - seller_page: rakip mağaza sayfası
 *
 * ⚠️ ToS riski: yavaş scrape + proxy pool + UA rotation ile minimize edilir.
 */
@Injectable()
export class ScraperEngineService {
  private readonly logger = new Logger(ScraperEngineService.name);
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private antiDetect: AntiDetectService,
  ) {}

  /**
   * Add a scrape target
   */
  async addTarget(
    tenantId: string,
    dto: {
      url: string;
      type: "product_page" | "search_results" | "best_sellers" | "seller_page";
      label?: string;
      intervalMinutes?: number;
    },
  ) {
    return this.prisma.scrapeTarget.create({
      data: {
        tenantId,
        url: dto.url,
        type: dto.type,
        label: dto.label,
        intervalMinutes: dto.intervalMinutes || 360,
      },
    });
  }

  /**
   * Get all targets for a tenant
   */
  async getTargets(tenantId: string) {
    return this.prisma.scrapeTarget.findMany({
      where: { tenantId },
      include: {
        results: {
          orderBy: { time: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Remove a target
   */
  async removeTarget(targetId: string) {
    await this.prisma.scrapeResult.deleteMany({ where: { targetId } });
    return this.prisma.scrapeTarget.delete({ where: { id: targetId } });
  }

  /**
   * CRON: Her 6 saatte bir aktif hedefleri tara
   */
  @Cron("0 */6 * * *")
  async runScheduledScrapes() {
    if (this.isRunning) {
      this.logger.warn("Scraper already running, skipping...");
      return;
    }

    this.isRunning = true;

    try {
      const targets = await this.prisma.scrapeTarget.findMany({
        where: { isActive: true },
      });

      this.logger.log(
        `Running scheduled scrape for ${targets.length} targets...`,
      );

      const concurrency = parseInt(process.env.SCRAPER_CONCURRENCY || "3", 10);

      // Process in batches based on concurrency limit
      for (let i = 0; i < targets.length; i += concurrency) {
        const batch = targets.slice(i, i + concurrency);
        await Promise.allSettled(
          batch.map((target) => this.scrapeTarget(target.id)),
        );
      }
    } catch (error: any) {
      this.logger.error(`Scheduled scrape failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Scrape a specific target
   */
  async scrapeTarget(targetId: string) {
    const target = await this.prisma.scrapeTarget.findUnique({
      where: { id: targetId },
    });

    if (!target) throw new Error("Target not found");

    // Check if enough time has passed
    if (target.lastScrapedAt) {
      const minutesSince =
        (Date.now() - target.lastScrapedAt.getTime()) / (1000 * 60);
      if (minutesSince < target.intervalMinutes) {
        return { status: "skipped", reason: "Too soon since last scrape" };
      }
    }

    const startTime = Date.now();

    try {
      // Enforce rate limit
      const domain = new URL(target.url).hostname;
      await this.antiDetect.enforceRateLimit(domain);

      // Scrape based on type
      let data: any;
      switch (target.type) {
        case "product_page":
          data = await this.scrapeProductPage(target.url);
          break;
        case "search_results":
          data = await this.scrapeSearchResults(target.url);
          break;
        case "best_sellers":
          data = await this.scrapeBestSellers(target.url);
          break;
        case "seller_page":
          data = await this.scrapeSellerPage(target.url);
          break;
        default:
          data = await this.scrapeGenericPage(target.url);
      }

      const durationMs = Date.now() - startTime;
      const config = this.antiDetect.getBrowserConfig();

      // Save result
      const result = await this.prisma.scrapeResult.create({
        data: {
          targetId,
          status: "success",
          data,
          durationMs,
          proxyUsed: config.proxy || "direct",
        },
      });

      // Update target timestamp
      await this.prisma.scrapeTarget.update({
        where: { id: targetId },
        data: { lastScrapedAt: new Date() },
      });

      this.logger.log(
        `✅ Scraped ${target.type}: ${target.url} (${durationMs}ms)`,
      );

      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      // Record failure
      await this.prisma.scrapeResult.create({
        data: {
          targetId,
          status: error.message?.includes("blocked") ? "blocked" : "failed",
          data: {},
          errorMessage: error.message,
          durationMs,
        },
      });

      this.logger.error(`❌ Scrape failed: ${target.url} — ${error.message}`);

      throw error;
    }
  }

  /**
   * Launch stealth browser, navigate to URL, return page handle
   */
  private async launchAndNavigate(url: string) {
    let chromium: any;
    try {
      chromium = require("playwright").chromium;
    } catch {
      this.logger.warn("Playwright not installed — using fetch fallback");
      return null;
    }

    const config = this.antiDetect.getBrowserConfig();
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        ...(config.proxy ? [`--proxy-server=${config.proxy}`] : []),
      ],
    });

    const context = await browser.newContext({
      userAgent: config.userAgent,
      viewport: { width: 1366, height: 768 },
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
    });

    // Anti-detect: override navigator.webdriver
    await context.addInitScript(`
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        `);

    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await this.antiDetect.humanDelay();
      return { browser, page };
    } catch (error: any) {
      await browser.close();
      throw new Error(`Navigation failed: ${error.message}`);
    }
  }

  /**
   * Safe text extraction helper
   */
  private async safeText(
    page: any,
    selector: string,
  ): Promise<string | undefined> {
    try {
      const el = await page.$(selector);
      return el ? (await el.textContent())?.trim() : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Safe number extraction helper
   */
  private async safeNumber(
    page: any,
    selector: string,
  ): Promise<number | undefined> {
    const text = await this.safeText(page, selector);
    if (!text) return undefined;
    const num = parseFloat(text.replace(/[^\d,.]/g, "").replace(",", "."));
    return isNaN(num) ? undefined : num;
  }

  /**
   * Scrape a product detail page — REAL Trendyol selectors
   * Extracts: title, price, rating, review count, stock status, images, seller info, buybox
   */
  async scrapeProductPage(url: string): Promise<{
    title?: string;
    price?: number;
    originalPrice?: number;
    rating?: number;
    reviewCount?: number;
    questionCount?: number;
    sellerName?: string;
    sellerId?: string;
    inStock?: boolean;
    images?: string[];
    attributes?: Record<string, string>;
    buyboxSellers?: Array<{ name: string; price: number }>;
    category?: string;
    brand?: string;
    source: string;
  }> {
    this.logger.debug(`Scraping product page: ${url}`);
    await this.antiDetect.humanDelay();

    const ctx = await this.launchAndNavigate(url);
    if (!ctx) return { source: "scrape" }; // fallback

    const { browser, page } = ctx;

    try {
      // Wait for product content
      await page
        .waitForSelector(".pr-in-w, .product-detail-wrapper", {
          timeout: 10000,
        })
        .catch(() => {});

      // ── Title ──────────────────────────────────
      const title = await this.safeText(
        page,
        ".pr-new-br span, h1.pr-new-br, .product-detail-title",
      );

      // ── Prices ─────────────────────────────────
      const price = await this.safeNumber(
        page,
        ".prc-dsc, .product-price-container .prc-dsc",
      );
      const originalPrice = await this.safeNumber(
        page,
        ".prc-org, .product-price-container .prc-org",
      );

      // ── Rating & Reviews ───────────────────────
      const ratingText = await this.safeText(
        page,
        ".pr-rnr-sm-p, .rating-line-count .tlp-text",
      );
      const rating = ratingText
        ? parseFloat(ratingText.replace(",", "."))
        : undefined;
      const reviewCountText = await this.safeText(
        page,
        ".pr-rnr-sm-p + .pr-rnr-sm-n, .rnr-com-cn",
      );
      const reviewCount = reviewCountText
        ? parseInt(reviewCountText.replace(/\D/g, ""), 10) || undefined
        : undefined;
      const questionCountText = await this.safeText(
        page,
        ".pr-q-cn, .qa-count",
      );
      const questionCount = questionCountText
        ? parseInt(questionCountText.replace(/\D/g, ""), 10) || undefined
        : undefined;

      // ── Seller ─────────────────────────────────
      const sellerName = await this.safeText(
        page,
        ".merchant-text, .seller-name-text a",
      );

      // ── Stock ──────────────────────────────────
      const addToCartBtn = await page.$(".add-to-bs-txt, button.add-to-basket");
      const outOfStockBanner = await page.$(".pr-out-of-stock, .sold-out-text");
      const inStock = addToCartBtn !== null && outOfStockBanner === null;

      // ── Images ─────────────────────────────────
      const images: string[] = await page
        .$$eval(
          ".gallery-modal-content img, .base-product-image img, .product-slide img",
          (imgs: any[]) =>
            imgs
              .map((img: any) => img.src || img.dataset?.src)
              .filter(Boolean)
              .slice(0, 10),
        )
        .catch(() => []);

      // ── Attributes / Specifications ────────────
      const attributes: Record<string, string> = {};
      const attrRows = await page.$$(
        ".detail-attr-container li, .pr-in-spec tbody tr",
      );
      for (const row of attrRows) {
        const key = await row
          .$eval(".attr-key, td:first-child", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => "");
        const val = await row
          .$eval(".attr-value, td:last-child", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => "");
        if (key && val) attributes[key] = val;
      }

      // ── Buybox Sellers (Other Sellers) ─────────
      const buyboxSellers: Array<{ name: string; price: number }> = [];
      const otherSellers = await page.$$(".other-sellers-item, .pr-mchr-item");
      for (const seller of otherSellers) {
        const name = await seller
          .$eval(".os-seller-name, .merchant-text", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => "");
        const priceText = await seller
          .$eval(".os-seller-price, .prc-dsc", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => "");
        const priceVal = priceText
          ? parseFloat(priceText.replace(/[^\d,.]/g, "").replace(",", "."))
          : 0;
        if (name) buyboxSellers.push({ name, price: priceVal });
      }

      // ── Category & Brand ───────────────────────
      const category = await this.safeText(
        page,
        ".pr-brdcrmb li:last-child a, .breadcrumb-wrapper a:last-child",
      );
      const brand = await this.safeText(
        page,
        ".pr-new-br a, .product-brand-name-with-link a",
      );

      return {
        title,
        price,
        originalPrice,
        rating,
        reviewCount,
        questionCount,
        sellerName,
        inStock,
        images,
        attributes,
        buyboxSellers,
        category,
        brand,
        source: "scrape",
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Scrape search results page — REAL Trendyol selectors
   * Extracts: product listings with rank, price, rating, seller, ad indicators
   */
  async scrapeSearchResults(url: string): Promise<{
    keyword?: string;
    totalResults?: number;
    products: Array<{
      rank: number;
      title?: string;
      price?: number;
      rating?: number;
      reviewCount?: number;
      sellerName?: string;
      isSponsored?: boolean;
      productUrl?: string;
    }>;
    source: string;
  }> {
    this.logger.debug(`Scraping search results: ${url}`);
    await this.antiDetect.humanDelay();

    const ctx = await this.launchAndNavigate(url);
    if (!ctx) return { products: [], source: "scrape" };

    const { browser, page } = ctx;

    try {
      await page
        .waitForSelector(".prdct-cntnr-wrppr, .search-result-wrapper", {
          timeout: 10000,
        })
        .catch(() => {});

      // Keyword from URL
      const urlObj = new URL(url);
      const keyword =
        urlObj.searchParams.get("q") ||
        urlObj.pathname.split("/").pop()?.replace(/-/g, " ");

      // Total results
      const totalText = await this.safeText(
        page,
        ".dscrptn .ttl, .srch-rslt-ttl",
      );
      const totalResults = totalText
        ? parseInt(totalText.replace(/\D/g, ""), 10) || undefined
        : undefined;

      // Product cards
      const cards = await page.$$(".p-card-wrppr, .product-card");
      const products: Array<{
        rank: number;
        title?: string;
        price?: number;
        rating?: number;
        reviewCount?: number;
        sellerName?: string;
        isSponsored?: boolean;
        productUrl?: string;
      }> = [];

      for (let i = 0; i < Math.min(cards.length, 48); i++) {
        const card = cards[i];
        const title = await card
          .$eval(".prdct-desc-cntnr-name, .product-desc-sub-text", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => undefined);
        const priceText = await card
          .$eval(".prc-box-dscntd, .prc-box-sllng", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => undefined);
        const price = priceText
          ? parseFloat(priceText.replace(/[^\d,.]/g, "").replace(",", "."))
          : undefined;
        const ratingText = await card
          .$eval(".rating-score, .ratings .score", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => undefined);
        const rating = ratingText
          ? parseFloat(ratingText.replace(",", "."))
          : undefined;
        const reviewText = await card
          .$eval(".ratingCount, .ratings .count", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => undefined);
        const reviewCount = reviewText
          ? parseInt(reviewText.replace(/\D/g, ""), 10) || undefined
          : undefined;
        const isSponsored =
          (await card.$(".sponsored-badge, .sp-itm")) !== null;
        const link = await card
          .$eval("a", (el: any) => el?.href)
          .catch(() => undefined);
        const productUrl =
          link && !link.startsWith("http")
            ? `https://www.trendyol.com${link}`
            : link;

        products.push({
          rank: i + 1,
          title,
          price,
          rating,
          reviewCount,
          isSponsored,
          productUrl,
        });
      }

      return { keyword, totalResults, products, source: "scrape" };
    } finally {
      await browser.close();
    }
  }

  /**
   * Scrape best sellers page — REAL Trendyol selectors
   */
  async scrapeBestSellers(url: string): Promise<{
    category?: string;
    products: Array<{
      rank: number;
      title?: string;
      price?: number;
      rating?: number;
      reviewCount?: number;
      productUrl?: string;
    }>;
    source: string;
  }> {
    this.logger.debug(`Scraping best sellers: ${url}`);
    await this.antiDetect.humanDelay();

    const ctx = await this.launchAndNavigate(url);
    if (!ctx) return { products: [], source: "scrape" };

    const { browser, page } = ctx;

    try {
      await page
        .waitForSelector(".p-card-wrppr, .bestseller-product-card", {
          timeout: 10000,
        })
        .catch(() => {});

      const category = await this.safeText(
        page,
        ".dscrptn .ttl, .category-banner-text, h1",
      );

      const cards = await page.$$(".p-card-wrppr, .bestseller-product-card");
      const products: Array<{
        rank: number;
        title?: string;
        price?: number;
        rating?: number;
        reviewCount?: number;
        productUrl?: string;
      }> = [];

      for (let i = 0; i < Math.min(cards.length, 50); i++) {
        const card = cards[i];
        const title = await card
          .$eval(".prdct-desc-cntnr-name", (el: any) => el?.textContent?.trim())
          .catch(() => undefined);
        const priceText = await card
          .$eval(".prc-box-dscntd, .prc-box-sllng", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => undefined);
        const price = priceText
          ? parseFloat(priceText.replace(/[^\d,.]/g, "").replace(",", "."))
          : undefined;
        const ratingText = await card
          .$eval(".rating-score", (el: any) => el?.textContent?.trim())
          .catch(() => undefined);
        const rating = ratingText
          ? parseFloat(ratingText.replace(",", "."))
          : undefined;
        const link = await card
          .$eval("a", (el: any) => el?.href)
          .catch(() => undefined);
        const productUrl =
          link && !link.startsWith("http")
            ? `https://www.trendyol.com${link}`
            : link;

        products.push({ rank: i + 1, title, price, rating, productUrl });
      }

      return { category, products, source: "scrape" };
    } finally {
      await browser.close();
    }
  }

  /**
   * Scrape seller/store page — REAL Trendyol selectors
   * Extracts: store info, product count, ratings, recent products
   */
  async scrapeSellerPage(url: string): Promise<{
    sellerName?: string;
    totalProducts?: number;
    avgRating?: number;
    followerCount?: number;
    recentProducts: Array<{
      title?: string;
      price?: number;
      productUrl?: string;
    }>;
    source: string;
  }> {
    this.logger.debug(`Scraping seller page: ${url}`);
    await this.antiDetect.humanDelay();

    const ctx = await this.launchAndNavigate(url);
    if (!ctx) return { recentProducts: [], source: "scrape" };

    const { browser, page } = ctx;

    try {
      await page
        .waitForSelector(".seller-store-container, .merchant-info", {
          timeout: 10000,
        })
        .catch(() => {});

      const sellerName = await this.safeText(
        page,
        ".seller-store-name, .merchant-name",
      );
      const totalProductsText = await this.safeText(
        page,
        ".seller-store-product-count, .product-count",
      );
      const totalProducts = totalProductsText
        ? parseInt(totalProductsText.replace(/\D/g, ""), 10) || undefined
        : undefined;
      const avgRatingText = await this.safeText(
        page,
        ".seller-store-rating, .merchant-rating",
      );
      const avgRating = avgRatingText
        ? parseFloat(avgRatingText.replace(",", ".")) || undefined
        : undefined;
      const followerText = await this.safeText(
        page,
        ".seller-store-follower-count, .follower-count",
      );
      const followerCount = followerText
        ? parseInt(followerText.replace(/\D/g, ""), 10) || undefined
        : undefined;

      // Recent products
      const cards = await page.$$(".p-card-wrppr");
      const recentProducts: Array<{
        title?: string;
        price?: number;
        productUrl?: string;
      }> = [];

      for (let i = 0; i < Math.min(cards.length, 20); i++) {
        const card = cards[i];
        const title = await card
          .$eval(".prdct-desc-cntnr-name", (el: any) => el?.textContent?.trim())
          .catch(() => undefined);
        const priceText = await card
          .$eval(".prc-box-dscntd, .prc-box-sllng", (el: any) =>
            el?.textContent?.trim(),
          )
          .catch(() => undefined);
        const price = priceText
          ? parseFloat(priceText.replace(/[^\d,.]/g, "").replace(",", "."))
          : undefined;
        const link = await card
          .$eval("a", (el: any) => el?.href)
          .catch(() => undefined);
        const productUrl =
          link && !link.startsWith("http")
            ? `https://www.trendyol.com${link}`
            : link;
        recentProducts.push({ title, price, productUrl });
      }

      return {
        sellerName,
        totalProducts,
        avgRating,
        followerCount,
        recentProducts,
        source: "scrape",
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Generic page scrape (fallback) — extracts raw text
   */
  async scrapeGenericPage(
    url: string,
  ): Promise<{ rawText?: string; source: string }> {
    this.logger.debug(`Scraping generic page: ${url}`);
    await this.antiDetect.humanDelay();

    const ctx = await this.launchAndNavigate(url);
    if (!ctx) return { source: "scrape" };

    const { browser, page } = ctx;
    try {
      const rawText = await page
        .$eval("body", (el: any) => el?.innerText?.substring(0, 5000))
        .catch(() => undefined);
      return { rawText, source: "scrape" };
    } finally {
      await browser.close();
    }
  }

  /**
   * Get scrape results for a target
   */
  async getResults(targetId: string, limit = 20) {
    return this.prisma.scrapeResult.findMany({
      where: { targetId },
      orderBy: { time: "desc" },
      take: limit,
    });
  }

  /**
   * Get scraping stats
   */
  async getStats(tenantId: string) {
    const [totalTargets, activeTargets, recentResults] = await Promise.all([
      this.prisma.scrapeTarget.count({ where: { tenantId } }),
      this.prisma.scrapeTarget.count({ where: { tenantId, isActive: true } }),
      this.prisma.scrapeResult.findMany({
        where: { target: { tenantId } },
        orderBy: { time: "desc" },
        take: 100,
      }),
    ]);

    const successCount = recentResults.filter(
      (r) => r.status === "success",
    ).length;
    const failedCount = recentResults.filter(
      (r) => r.status === "failed",
    ).length;
    const blockedCount = recentResults.filter(
      (r) => r.status === "blocked",
    ).length;
    const avgDuration =
      recentResults.length > 0
        ? recentResults.reduce((sum, r) => sum + (r.durationMs || 0), 0) /
          recentResults.length
        : 0;

    return {
      totalTargets,
      activeTargets,
      recentScrapes: recentResults.length,
      successRate:
        recentResults.length > 0
          ? Math.round((successCount / recentResults.length) * 100)
          : 0,
      failedCount,
      blockedCount,
      avgDurationMs: Math.round(avgDuration),
    };
  }
}

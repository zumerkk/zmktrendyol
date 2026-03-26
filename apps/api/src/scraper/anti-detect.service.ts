import { Injectable, Logger } from "@nestjs/common";

/**
 * AntiDetectService — Cloudflare/Bot Koruması Atlatma
 *
 * Proxy rotation, User-Agent rotation, fingerprint randomization.
 * Rate limiting: IP başına max 1 request / 5 saniye.
 *
 * ⚠️ ToS riski biliniyor — yavaş scrape + proxy pool ile minimize edilir.
 */
@Injectable()
export class AntiDetectService {
  private readonly logger = new Logger(AntiDetectService.name);

  // Modern browser User-Agent pool (2024-2026)
  private readonly userAgents: string[] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 OPR/108.0.0.0",
  ];

  // Proxy pool (configured via environment)
  private proxyIndex = 0;
  private lastRequestTime = new Map<string, number>();

  /**
   * Get a random User-Agent string
   */
  getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Get next proxy from pool (round-robin)
   */
  getProxy(): string | null {
    const proxyPoolUrl = process.env.PROXY_POOL_URL;
    if (!proxyPoolUrl) {
      this.logger.debug("No proxy pool configured, running without proxy");
      return null;
    }

    // Parse proxy list from environment (comma-separated)
    const proxies = proxyPoolUrl
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (proxies.length === 0) return null;

    const proxy = proxies[this.proxyIndex % proxies.length];
    this.proxyIndex++;
    return proxy;
  }

  /**
   * Get browser launch configuration with anti-detection measures
   */
  getBrowserConfig(): {
    userAgent: string;
    proxy: string | null;
    viewport: { width: number; height: number };
    extraHeaders: Record<string, string>;
  } {
    // Randomize viewport slightly to avoid fingerprinting
    const viewportVariations = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 },
      { width: 1366, height: 768 },
      { width: 2560, height: 1440 },
    ];
    const viewport =
      viewportVariations[Math.floor(Math.random() * viewportVariations.length)];

    return {
      userAgent: this.getRandomUserAgent(),
      proxy: this.getProxy(),
      viewport,
      extraHeaders: {
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Ch-Ua":
          '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    };
  }

  /**
   * Rate limit check — ensures minimum delay between requests to same domain
   */
  async enforceRateLimit(domain: string): Promise<void> {
    const minDelayMs = parseInt(process.env.SCRAPER_DELAY_MS || "5000", 10);
    const lastTime = this.lastRequestTime.get(domain) || 0;
    const elapsed = Date.now() - lastTime;

    if (elapsed < minDelayMs) {
      const waitMs = minDelayMs - elapsed;
      this.logger.debug(`Rate limiting: waiting ${waitMs}ms for ${domain}`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.lastRequestTime.set(domain, Date.now());
  }

  /**
   * Random delay to appear more human-like
   */
  async humanDelay(minMs = 1000, maxMs = 3000): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Handle Cloudflare challenge detection
   * Returns true if Cloudflare was detected
   */
  detectCloudflare(pageContent: string): boolean {
    const cfIndicators = [
      "cf-browser-verification",
      "cf_clearance",
      "Checking if the site connection is secure",
      "Enable JavaScript and cookies to continue",
      "cloudflare",
      "cf-challenge",
      "ray ID",
    ];

    return cfIndicators.some((indicator) =>
      pageContent.toLowerCase().includes(indicator.toLowerCase()),
    );
  }
}

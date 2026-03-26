import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../common/prisma/prisma.service";
import axios from "axios";

/**
 * Worker for scraping competitor data from public product pages.
 * Uses anti-detect patterns and respects rate limits.
 */
@Processor("scrape_queue", { concurrency: 2 })
export class ScraperWorkerService extends WorkerHost {
  private readonly logger = new Logger(ScraperWorkerService.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { url, competitorProductId, targetType = 'price' } = job.data;
    this.logger.log(`Processing scrape job: ${job.id} for URL: ${url}`);

    try {
      // Respect rate limits
      const delayMs = Number(process.env.SCRAPER_DELAY_MS || 5000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Make HTTP request with anti-detect headers
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        timeout: 15000,
        validateStatus: (status) => status < 500,
      });

      if (response.status !== 200) {
        this.logger.warn(`Non-200 status (${response.status}) for ${url}`);
        return { success: false, status: response.status };
      }

      const html = response.data as string;

      // Extract data from Trendyol product page
      let extractedPrice: number | null = null;
      let extractedTitle: string | null = null;
      let extractedRating: number | null = null;
      let extractedReviewCount: number | null = null;
      let inStock = true;

      // Price extraction
      const priceMatch = html.match(/"price":\s*(\d+\.?\d*)/);
      if (priceMatch) extractedPrice = parseFloat(priceMatch[1]);

      // Title extraction
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) extractedTitle = titleMatch[1].replace(' | Trendyol', '').trim();

      // Rating extraction
      const ratingMatch = html.match(/"ratingScore":\s*(\d+\.?\d*)/);
      if (ratingMatch) extractedRating = parseFloat(ratingMatch[1]);

      // Review count
      const reviewMatch = html.match(/"ratingCount":\s*(\d+)/);
      if (reviewMatch) extractedReviewCount = parseInt(reviewMatch[1]);

      // Stock status
      if (html.includes('tükendi') || html.includes('stokta yok') || html.includes('out-of-stock')) {
        inStock = false;
      }

      // Save to competitor snapshot
      if (competitorProductId) {
        await this.prisma.competitorSnapshot.create({
          data: {
            competitorProductId,
            price: extractedPrice,
            rating: extractedRating,
            reviewCount: extractedReviewCount,
            inStock,
            deliveryInfo: null,
          },
        });
      }

      this.logger.log(`Scraped: ${extractedTitle || url} — ${extractedPrice ? extractedPrice + ' TL' : 'no price'} — ${inStock ? 'in stock' : 'OOS'}`);

      return {
        success: true,
        url,
        price: extractedPrice,
        title: extractedTitle,
        rating: extractedRating,
        reviewCount: extractedReviewCount,
        inStock,
      };

    } catch (error: any) {
      this.logger.error(`Failed scrape job ${job.id}: ${error.message}`);
      throw error;
    }
  }

  private getRandomUserAgent(): string {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }
}

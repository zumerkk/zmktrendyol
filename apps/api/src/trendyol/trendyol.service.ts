import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { PrismaService } from "../common/prisma/prisma.service";
import { decrypt } from "../common/crypto.util";

/**
 * TrendyolService - Core API client for Trendyol Integration
 *
 * Auth: Basic Auth (supplierId + API Key + API Secret)
 * Rate Limit: 50 requests per 10 seconds per endpoint
 * User-Agent: "{sellerId} - SelfIntegration" format
 */
@Injectable()
export class TrendyolService {
  private readonly logger = new Logger(TrendyolService.name);
  private clients = new Map<string, AxiosInstance>();

  constructor(private prisma: PrismaService) {}

  /**
   * Get or create an authenticated Axios client for a seller
   */
  async getClient(
    tenantId: string,
  ): Promise<{ client: AxiosInstance; sellerId: string }> {
    const connection = await this.prisma.sellerConnection.findFirst({
      where: { tenantId, status: "active" },
    });

    if (!connection) {
      throw new Error("No active Trendyol connection found");
    }

    const cacheKey = connection.id;
    if (this.clients.has(cacheKey)) {
      return {
        client: this.clients.get(cacheKey)!,
        sellerId: connection.sellerId,
      };
    }

    const baseURL =
      process.env.TRENDYOL_API_BASE_URL || "https://api.trendyol.com/sapigw";

    const apiKey = decrypt(connection.apiKeyRef);
    const apiSecret = decrypt(connection.apiSecretRef);
    const authToken = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const client = axios.create({
      baseURL,
      headers: {
        Authorization: `Basic ${authToken}`,
        "User-Agent": `${connection.sellerId} - SelfIntegration`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    // Rate limit interceptor
    let requestCount = 0;
    let windowStart = Date.now();

    client.interceptors.request.use(async (config) => {
      const now = Date.now();
      if (now - windowStart > 10000) {
        requestCount = 0;
        windowStart = now;
      }
      if (requestCount >= 45) {
        // 45 to stay safely under 50 limit
        const waitMs = 10000 - (now - windowStart);
        this.logger.warn(`Rate limit approaching, waiting ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        requestCount = 0;
        windowStart = Date.now();
      }
      requestCount++;
      return config;
    });

    // Error interceptor with retry
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          this.logger.warn("Rate limited by Trendyol, retrying after 10s");
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return client(error.config);
        }
        throw error;
      },
    );

    this.clients.set(cacheKey, client);
    return { client, sellerId: connection.sellerId };
  }

  /**
   * Health check: verify Trendyol connection
   */
  async healthCheck(
    tenantId: string,
  ): Promise<{ connected: boolean; message: string }> {
    try {
      const { client, sellerId } = await this.getClient(tenantId);
      const res = await client.get(
        `/integration/sellers/${sellerId}/addresses`,
      );
      return {
        connected: true,
        message: `Connected to seller ${sellerId}. ${res.data?.length || 0} addresses found.`,
      };
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 403) {
        return {
          connected: false,
          message:
            "API kimlik bilgileri geçersiz veya süresi dolmuş. Trendyol Satıcı Paneli'nden yeni API Key/Secret oluşturun.",
        };
      }
      if (status === 401) {
        return {
          connected: false,
          message:
            "API yetkilendirme hatası. API Key ve Secret doğru olduğundan emin olun.",
        };
      }
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return {
          connected: false,
          message: "Trendyol API'ye bağlantı zaman aşımına uğradı.",
        };
      }
      return {
        connected: false,
        message: error.message || "Bağlantı hatası.",
      };
    }
  }
}

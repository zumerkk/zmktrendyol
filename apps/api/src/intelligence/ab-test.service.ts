import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { OrchestratorService } from "../ai/orchestrator.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { v4 as uuid } from "uuid";

/**
 * AbTestService — A/B Test Motoru
 *
 * Başlık, açıklama, fiyat için otomatik A/B test:
 * - AI ile varyasyon üret
 * - Her birini 48 saat test et
 * - CTR ve dönüşüm oranına göre kazananı seç
 * - Otomatik geçiş
 */
@Injectable()
export class AbTestService {
  private readonly logger = new Logger(AbTestService.name);

  constructor(
    private prisma: PrismaService,
    private orchestrator: OrchestratorService,
    private notifications: NotificationsGateway,
  ) {}

  /**
   * Create a new A/B test with AI-generated variants
   */
  async createTest(
    tenantId: string,
    dto: {
      productId: string;
      field: "title" | "description" | "images" | "price";
      variantsCount?: number;
      durationHours?: number;
      customVariants?: string[];
    },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) return { message: "Product not found", test: null };

    let variants: Array<{
      id: string;
      content: string;
      impressions: number;
      clicks: number;
      conversions: number;
      revenue: number;
    }>;

    if (dto.customVariants && dto.customVariants.length > 0) {
      // User-provided variants
      variants = dto.customVariants.map((content) => ({
        id: uuid(),
        content,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      }));
    } else {
      // AI-generated variants
      const result = await this.orchestrator.generate(tenantId, {
        scenario: "ab_test_variants",
        input: {
          field: dto.field,
          currentValue:
            dto.field === "title"
              ? product.title
              : (product as any).description,
          category: product.categoryName,
          brand: product.brand,
          variantsCount: dto.variantsCount || 3,
        },
      });

      const aiVariants = result.variations || [product.title || ""];
      variants = aiVariants.map((content: string) => ({
        id: uuid(),
        content,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      }));
    }

    // Always include current value as control
    const currentValue =
      dto.field === "title"
        ? product.title
        : (product as any).description || "";
    if (!variants.find((v) => v.content === currentValue)) {
      variants.unshift({
        id: uuid() + "-control",
        content: currentValue,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      });
    }

    const test = await this.prisma.abTest.create({
      data: {
        tenantId,
        productId: dto.productId,
        field: dto.field,
        variants: variants as any,
        durationHours: dto.durationHours || 48,
      },
    });

    this.logger.log(
      `A/B test created: ${test.id} for product ${dto.productId} (${variants.length} variants)`,
    );
    return test;
  }

  /**
   * Record metric update for a variant
   */
  async recordVariantMetric(
    testId: string,
    variantId: string,
    metric: {
      impressions?: number;
      clicks?: number;
      conversions?: number;
      revenue?: number;
    },
  ) {
    const test = await this.prisma.abTest.findUnique({ where: { id: testId } });
    if (!test || test.status !== "running")
      throw new Error("Test not found or not running");

    const variants = test.variants as any[];
    const variant = variants.find((v: any) => v.id === variantId);
    if (!variant) throw new Error("Variant not found");

    if (metric.impressions) variant.impressions += metric.impressions;
    if (metric.clicks) variant.clicks += metric.clicks;
    if (metric.conversions) variant.conversions += metric.conversions;
    if (metric.revenue) variant.revenue += metric.revenue;

    await this.prisma.abTest.update({
      where: { id: testId },
      data: { variants: variants as any },
    });

    return variant;
  }

  /**
   * Get test results with statistical analysis
   */
  async getTestResults(testId: string) {
    const test = await this.prisma.abTest.findUnique({
      where: { id: testId },
      include: { product: true },
    });
    if (!test) throw new Error("Test not found");

    const variants = (test.variants as any[]).map((v: any) => ({
      ...v,
      ctr:
        v.impressions > 0
          ? Math.round((v.clicks / v.impressions) * 100 * 100) / 100
          : 0,
      conversionRate:
        v.clicks > 0
          ? Math.round((v.conversions / v.clicks) * 100 * 100) / 100
          : 0,
      revenuePerImpression:
        v.impressions > 0
          ? Math.round((v.revenue / v.impressions) * 100) / 100
          : 0,
    }));

    // Determine winner by revenue per impression
    const sorted = [...variants].sort(
      (a, b) => b.revenuePerImpression - a.revenuePerImpression,
    );

    return {
      testId: test.id,
      productId: test.productId,
      productTitle: test.product.title,
      field: test.field,
      status: test.status,
      variants: sorted,
      winner: sorted[0],
      confidence: this.calculateConfidence(sorted),
      durationHours: test.durationHours,
      startedAt: test.startedAt,
      endedAt: test.endedAt,
    };
  }

  /**
   * Get all tests for a tenant
   */
  async getTests(tenantId: string, status?: string) {
    return this.prisma.abTest.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: { product: { select: { title: true, barcode: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * End a test and pick winner
   */
  async endTest(testId: string, applyWinner = false) {
    const test = await this.prisma.abTest.findUnique({ where: { id: testId } });
    if (!test) throw new Error("Test not found");

    const variants = (test.variants as any[]).sort(
      (a: any, b: any) =>
        b.revenue / Math.max(b.impressions, 1) -
        a.revenue / Math.max(a.impressions, 1),
    );

    const winner = variants[0];

    await this.prisma.abTest.update({
      where: { id: testId },
      data: {
        status: "completed",
        winnerId: winner.id,
        endedAt: new Date(),
      },
    });

    // Notify
    await this.notifications.pushNotification(test.tenantId, {
      type: "ab_test_complete",
      title: `🏆 A/B Test Tamamlandı`,
      message: `"${test.field}" testi sona erdi. Kazanan varyant: ${winner.content?.substring(0, 50)}...`,
      severity: "info",
      data: { testId, winnerId: winner.id },
    });

    return { testId, winner, applied: false };
  }

  /**
   * CRON: Check for expired tests
   */
  @Cron("0 */2 * * *") // Every 2 hours
  async checkExpiredTests() {
    const runningTests = await this.prisma.abTest.findMany({
      where: { status: "running" },
    });

    for (const test of runningTests) {
      const elapsed =
        (Date.now() - test.startedAt.getTime()) / (1000 * 60 * 60);
      if (elapsed >= test.durationHours) {
        await this.endTest(test.id);
        this.logger.log(
          `A/B test ${test.id} auto-ended after ${test.durationHours}h`,
        );
      }
    }
  }

  private calculateConfidence(variants: any[]): number {
    if (variants.length < 2) return 0;
    const totalImpressions = variants.reduce(
      (sum: number, v: any) => sum + v.impressions,
      0,
    );
    if (totalImpressions < 100) return Math.min(totalImpressions, 30);
    if (totalImpressions < 500) return 50;
    if (totalImpressions < 1000) return 70;
    return 90;
  }
}

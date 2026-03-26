import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TrendyolService } from "../trendyol.service";

/**
 * FinanceService — Trendyol Cari Hesap & Finansal İstihbarat
 *
 * Trendyol Financial API üzerinden:
 * - Cari hesap dökümü (Current Account Statement)
 * - Settlement (ödeme) takibi
 * - Komisyon doğrulama
 * - Gelir/gider ayrıştırması
 * - Ödeme takvimi & nakit akışı projeksiyonu
 */
@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private prisma: PrismaService,
    private trendyol: TrendyolService,
  ) {}

  /**
   * Sync financial transactions from Trendyol
   * Endpoint: GET /integration/finance/che/sellers/{sellerId}/transactions
   */
  async syncFinancialTransactions(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ synced: number; totalAmount: number }> {
    const { client, sellerId } = await this.trendyol.getClient(tenantId);

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    let page = 0;
    let totalSynced = 0;
    let totalAmount = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const res = await client.get(
          `/integration/finance/che/sellers/${sellerId}/transactions`,
          {
            params: {
              startDate: start.getTime(),
              endDate: end.getTime(),
              page,
              size: 100,
            },
          },
        );

        const transactions = res.data?.content || [];
        hasMore = transactions.length === 100;
        page++;

        for (const tx of transactions) {
          const amount = Number(tx.amount || 0);
          totalAmount += amount;

          await this.prisma.financialTransaction.upsert({
            where: { id: tx.id?.toString() || `ty-fin-${Date.now()}-${Math.random()}` },
            create: {
              id: tx.id?.toString() || `ty-fin-${Date.now()}-${Math.random()}`,
              tenantId,
              transactionDate: new Date(tx.transactionDate || Date.now()),
              type: this.mapTransactionType(tx.transactionType),
              description: tx.description || tx.transactionType,
              amount,
              currency: tx.currency || "TRY",
              orderId: tx.orderNumber?.toString(),
              trendyolRef: tx.referenceNumber?.toString(),
            },
            update: {
              amount,
              description: tx.description || tx.transactionType,
            },
          });
          totalSynced++;
        }
      } catch (error: any) {
        this.logger.error(`Finance sync failed at page ${page}: ${error.message}`);
        if (error.response?.status === 404 || error.response?.status === 403) {
          this.logger.warn("Financial API may not be available for this seller. Using order-based estimation.");
          return this.estimateFromOrders(tenantId, start, end);
        }
        throw error;
      }
    }

    this.logger.log(`Synced ${totalSynced} financial transactions for tenant ${tenantId}`);
    return { synced: totalSynced, totalAmount: Math.round(totalAmount * 100) / 100 };
  }

  /**
   * Estimate financial data from orders when API is unavailable
   */
  private async estimateFromOrders(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ synced: number; totalAmount: number }> {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        orderDate: { gte: startDate, lte: endDate },
      },
      include: { items: true },
    });

    let synced = 0;
    let totalAmount = 0;

    for (const order of orders) {
      const orderAmount = Number(order.totalPrice);
      totalAmount += orderAmount;

      // Create estimated revenue transaction
      await this.prisma.financialTransaction.create({
        data: {
          tenantId,
          transactionDate: order.orderDate,
          type: "payment",
          description: `Sipariş #${order.trendyolOrderNumber} (tahmini)`,
          amount: orderAmount,
          orderId: order.id,
        },
      });

      // Create estimated commission transaction
      const estimatedCommission = orderAmount * 0.15; // default %15
      await this.prisma.financialTransaction.create({
        data: {
          tenantId,
          transactionDate: order.orderDate,
          type: "commission",
          description: `Komisyon - Sipariş #${order.trendyolOrderNumber} (tahmini)`,
          amount: -estimatedCommission,
          orderId: order.id,
        },
      });

      synced += 2;
    }

    return { synced, totalAmount: Math.round(totalAmount * 100) / 100 };
  }

  /**
   * Get financial summary for a period
   */
  async getFinancialSummary(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        tenantId,
        transactionDate: { gte: start, lte: end },
      },
      orderBy: { transactionDate: "desc" },
    });

    // Aggregate by type
    const summary = {
      period: { start: start.toISOString(), end: end.toISOString() },
      totalIncome: 0,
      totalExpense: 0,
      netAmount: 0,
      breakdown: {} as Record<string, { count: number; total: number }>,
      dailyFlow: [] as Array<{ date: string; income: number; expense: number; net: number }>,
      transactionCount: transactions.length,
    };

    const dailyMap = new Map<string, { income: number; expense: number }>();

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      const type = tx.type;
      const dateKey = tx.transactionDate.toISOString().split("T")[0];

      if (amount >= 0) {
        summary.totalIncome += amount;
      } else {
        summary.totalExpense += Math.abs(amount);
      }

      if (!summary.breakdown[type]) {
        summary.breakdown[type] = { count: 0, total: 0 };
      }
      summary.breakdown[type].count++;
      summary.breakdown[type].total += amount;

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { income: 0, expense: 0 });
      }
      const day = dailyMap.get(dateKey)!;
      if (amount >= 0) day.income += amount;
      else day.expense += Math.abs(amount);
    }

    summary.netAmount = summary.totalIncome - summary.totalExpense;

    // Convert daily map to sorted array
    summary.dailyFlow = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { income, expense }]) => ({
        date,
        income: round(income),
        expense: round(expense),
        net: round(income - expense),
      }));

    // Round all values
    summary.totalIncome = round(summary.totalIncome);
    summary.totalExpense = round(summary.totalExpense);
    summary.netAmount = round(summary.netAmount);

    for (const key of Object.keys(summary.breakdown)) {
      summary.breakdown[key].total = round(summary.breakdown[key].total);
    }

    return summary;
  }

  /**
   * Commission verification — compare actual vs expected commission
   */
  async verifyCommissions(tenantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const commissionTxs = await this.prisma.financialTransaction.findMany({
      where: {
        tenantId,
        type: "commission",
        transactionDate: { gte: startDate },
      },
    });

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        orderDate: { gte: startDate },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    const actualCommission = commissionTxs.reduce(
      (sum, tx) => sum + Math.abs(Number(tx.amount)),
      0,
    );

    // Calculate expected commission based on products
    let expectedCommission = 0;
    for (const order of orders) {
      for (const item of order.items) {
        const rate = item.product?.commissionRate
          ? Number(item.product.commissionRate) / 100
          : 0.15;
        expectedCommission += Number(item.amount) * rate;
      }
    }

    const difference = actualCommission - expectedCommission;
    const diffPercent =
      expectedCommission > 0 ? (difference / expectedCommission) * 100 : 0;

    return {
      period: `Son ${days} gün`,
      actualCommission: round(actualCommission),
      expectedCommission: round(expectedCommission),
      difference: round(difference),
      differencePercent: round(diffPercent),
      status:
        Math.abs(diffPercent) < 5
          ? "✅ Normal"
          : diffPercent > 0
            ? "⚠️ Beklenen üstünde komisyon kesiliyor!"
            : "ℹ️ Beklenen altında komisyon",
      source: "api" as const,
    };
  }

  /**
   * Cash flow projection — 30/60/90 day forecast
   */
  async getCashFlowProjection(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get recent financial activity
    const recentTxs = await this.prisma.financialTransaction.findMany({
      where: {
        tenantId,
        transactionDate: { gte: thirtyDaysAgo },
      },
    });

    const dailyIncome =
      recentTxs
        .filter((tx) => Number(tx.amount) > 0)
        .reduce((sum, tx) => sum + Number(tx.amount), 0) / 30;

    const dailyExpense =
      recentTxs
        .filter((tx) => Number(tx.amount) < 0)
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0) / 30;

    const dailyNet = dailyIncome - dailyExpense;

    return {
      basedOn: "Son 30 günlük veri",
      dailyAverages: {
        income: round(dailyIncome),
        expense: round(dailyExpense),
        net: round(dailyNet),
      },
      projections: [
        {
          period: "30 gün",
          projectedIncome: round(dailyIncome * 30),
          projectedExpense: round(dailyExpense * 30),
          projectedNet: round(dailyNet * 30),
        },
        {
          period: "60 gün",
          projectedIncome: round(dailyIncome * 60),
          projectedExpense: round(dailyExpense * 60),
          projectedNet: round(dailyNet * 60),
        },
        {
          period: "90 gün",
          projectedIncome: round(dailyIncome * 90),
          projectedExpense: round(dailyExpense * 90),
          projectedNet: round(dailyNet * 90),
        },
      ],
      alerts:
        dailyNet < 0
          ? [
              {
                severity: "critical",
                message: `⚠️ Günlük nakit akışı negatif (₺${round(dailyNet)}). Acil aksiyon gerekli!`,
              },
            ]
          : dailyNet < dailyIncome * 0.1
            ? [
                {
                  severity: "warning",
                  message: `⚠️ Net kâr marjı çok düşük (%${round((dailyNet / dailyIncome) * 100)}). Maliyetleri gözden geçir.`,
                },
              ]
            : [],
      source: "estimate" as const,
    };
  }

  /**
   * Payment calendar — upcoming payment dates
   */
  async getPaymentCalendar(tenantId: string) {
    const settlements = await this.prisma.settlementPeriod.findMany({
      where: { tenantId },
      orderBy: { periodEnd: "desc" },
      take: 12,
    });

    // Trendyol typically pays biweekly
    const today = new Date();
    const nextPaymentDates = [];

    // Generate expected upcoming payment dates (biweekly)
    for (let i = 0; i < 4; i++) {
      const payDate = new Date(today);
      payDate.setDate(payDate.getDate() + (14 * (i + 1)));

      // Skip weekends
      if (payDate.getDay() === 0) payDate.setDate(payDate.getDate() + 1);
      if (payDate.getDay() === 6) payDate.setDate(payDate.getDate() + 2);

      nextPaymentDates.push({
        expectedDate: payDate.toISOString().split("T")[0],
        daysUntil: Math.ceil((payDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      });
    }

    return {
      pastSettlements: settlements.map((s) => ({
        periodStart: s.periodStart.toISOString().split("T")[0],
        periodEnd: s.periodEnd.toISOString().split("T")[0],
        netAmount: Number(s.netAmount),
        status: s.paymentStatus,
        paymentDate: s.paymentDate?.toISOString().split("T")[0],
      })),
      upcomingPayments: nextPaymentDates,
      source: "estimate" as const,
    };
  }

  private mapTransactionType(type: string): string {
    const typeMap: Record<string, string> = {
      Sale: "payment",
      Commission: "commission",
      ShippingFee: "shipping_fee",
      ReturnDeduction: "return_deduction",
      AdvertisementPayment: "ad_charge",
      CouponDiscount: "coupon_discount",
      ServiceFee: "service_fee",
    };
    return typeMap[type] || type?.toLowerCase() || "unknown";
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

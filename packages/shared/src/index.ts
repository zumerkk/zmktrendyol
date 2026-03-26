// ─── User & Auth Types ───────────────────────
export type UserRole = 'owner' | 'admin' | 'analyst';

export interface UserPayload {
    id: string;
    email: string;
    role: UserRole;
    tenantId: string;
}

// ─── Trendyol Types ─────────────────────────
export interface TrendyolCredentials {
    sellerId: string;
    apiKey: string;
    apiSecret: string;
}

export interface TrendyolProduct {
    id: number;
    barcode: string;
    title: string;
    productMainId: string;
    brandId: number;
    brandName: string;
    categoryName: string;
    pimCategoryId: number;
    quantity: number;
    listPrice: number;
    salePrice: number;
    images: { url: string }[];
    approved: boolean;
    onSale: boolean;
    stockCode: string;
    attributes: { attributeId: number; attributeName: string; attributeValue: string }[];
}

export interface TrendyolOrder {
    shipmentPackageId: number;
    orderNumber: string;
    orderDate: number;
    totalPrice: number;
    status: string;
    customerId: number;
    lines: TrendyolOrderLine[];
}

export interface TrendyolOrderLine {
    lineId: number;
    productId: number;
    barcode: string;
    quantity: number;
    salesCampaignId: number;
    productSize: string;
    merchantSku: string;
    productName: string;
    amount: number;
    price: number;
    discount: number;
}

// ─── KPI Types ──────────────────────────────
export interface DailyKPI {
    date: string;
    grossRevenue: number;
    units: number;
    orders: number;
    returns: number;
    avgBasket: number;
}

export interface MonthlyKPI {
    month: string;
    grossRevenue: number;
    units: number;
    orders: number;
    returnRate: number;
    avgBasket: number;
}

// ─── Competitor Types ───────────────────────
export type DataSource = 'api' | 'user_data' | 'public' | 'estimate';

export interface MetricWithSource<T = number> {
    value: T;
    source: DataSource;
    confidence?: number; // 0-100, only for estimates
    updatedAt: string;
}

export interface CompetitorSnapshot {
    price: MetricWithSource;
    rating: MetricWithSource;
    reviewCount: MetricWithSource;
    inStock: MetricWithSource<boolean>;
    deliveryInfo: MetricWithSource<string>;
    estimatedSales?: MetricWithSource; // always "estimate" source
}

// ─── AI Types ───────────────────────────────
export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface AIGenerateRequest {
    scenario: 'title_optimization' | 'description_generation' | 'price_suggestion' | 'campaign_text' | 'customer_reply' | 'image_alt_text';
    input: Record<string, unknown>;
    provider?: AIProvider;
}

export interface AIGenerateResponse {
    variations: string[];
    metadata: {
        provider: AIProvider;
        model: string;
        tokensUsed: number;
        cost: number;
    };
}

// ─── Alert Types ────────────────────────────
export interface AlertRule {
    id: string;
    type: 'price_drop' | 'stock_low' | 'competitor_price' | 'return_rate';
    conditions: Record<string, unknown>;
    isActive: boolean;
}

// ─── Audit Types ────────────────────────────
export interface AuditEntry {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeValue?: Record<string, unknown>;
    afterValue?: Record<string, unknown>;
    ipAddress: string;
    createdAt: string;
}

// ─── API Response ───────────────────────────
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    meta?: {
        page?: number;
        pageSize?: number;
        totalCount?: number;
        totalPages?: number;
    };
}

// ─── Constants ──────────────────────────────
export const TRENDYOL_API = {
    PROD_BASE: 'https://api.trendyol.com/sapigw',
    STAGE_BASE: 'https://stageapi.trendyol.com/stagesapigw',
    RATE_LIMIT: { maxRequests: 50, windowSeconds: 10 },
    ORDER_RATE_LIMIT: { maxRequests: 1000, windowMinutes: 1 },
    MAX_ORDER_HISTORY_DAYS: 90,
} as const;

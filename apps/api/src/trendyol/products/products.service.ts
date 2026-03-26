import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TrendyolService } from "../trendyol.service";

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private trendyol: TrendyolService,
  ) {}

  /**
   * Sync products from Trendyol API to local DB
   * Endpoint: GET /integration/product/sellers/{sellerId}/products
   */
  async syncProducts(
    tenantId: string,
    page = 0,
    size = 50,
  ): Promise<{ synced: number; total: number }> {
    const { client, sellerId } = await this.trendyol.getClient(tenantId);
    let totalSynced = 0;
    let totalProducts = 0;

    try {
      const res = await client.get(
        `/integration/product/sellers/${sellerId}/products`,
        { params: { page, size, approved: true } },
      );

      const products = res.data?.content || [];
      totalProducts = res.data?.totalElements || 0;

      for (const p of products) {
        await this.prisma.product.upsert({
          where: { id: p.stockCode || `ty-${p.id}` },
          create: {
            id: p.stockCode || `ty-${p.id}`,
            tenantId,
            trendyolId: BigInt(p.id),
            barcode: p.barcode,
            title: p.title,
            brand: p.brand,
            categoryId: p.pimCategoryId,
            categoryName: p.categoryName,
            imageUrl: p.images?.[0]?.url,
            approved: p.approved || false,
            onSale: p.onSale || false,
          },
          update: {
            title: p.title,
            brand: p.brand,
            categoryId: p.pimCategoryId,
            categoryName: p.categoryName,
            imageUrl: p.images?.[0]?.url,
            approved: p.approved || false,
            onSale: p.onSale || false,
            updatedAt: new Date(),
          },
        });
        totalSynced++;
      }

      this.logger.log(`Synced ${totalSynced} products for tenant ${tenantId}`);
    } catch (error: any) {
      this.logger.error(`Product sync failed: ${error.message}`);
      throw error;
    }

    return { synced: totalSynced, total: totalProducts };
  }

  /**
   * Get products from local DB
   */
  async getProducts(
    tenantId: string,
    filters?: {
      category?: string;
      brand?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters?.page || 0;
    const pageSize = filters?.pageSize || 20;

    const where: any = { tenantId };
    if (filters?.category)
      where.categoryName = { contains: filters.category, mode: "insensitive" };
    if (filters?.brand)
      where.brand = { contains: filters.brand, mode: "insensitive" };
    if (filters?.status) where.status = filters.status;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { variants: true },
        skip: page * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        page,
        pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get product detail with price history
   */
  async getProductDetail(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: {
        variants: true,
        priceHistory: {
          orderBy: { time: "desc" },
          take: 180, // ~6 months of daily data
        },
        inventoryHistory: {
          orderBy: { time: "desc" },
          take: 180,
        },
      },
    });
    return product;
  }

  /**
   * Sync categories from Trendyol
   * Endpoint: GET /integration/product/product-categories
   */
  async syncCategories(tenantId: string) {
    const { client } = await this.trendyol.getClient(tenantId);
    const res = await client.get("/integration/product/product-categories");
    const categories = res.data?.categories || [];

    let synced = 0;
    for (const cat of categories) {
      await this.prisma.category.upsert({
        where: { id: cat.id },
        create: { id: cat.id, name: cat.name, parentId: cat.parentId },
        update: { name: cat.name, parentId: cat.parentId },
      });
      synced++;
    }
    return { synced };
  }

  /**
   * Sync brands from Trendyol
   * Endpoint: GET /integration/product/brands
   */
  async syncBrands(tenantId: string, page = 0, size = 500) {
    const { client } = await this.trendyol.getClient(tenantId);
    const res = await client.get("/integration/product/brands", {
      params: { page, size },
    });
    const brands = res.data?.brands || [];

    let synced = 0;
    for (const brand of brands) {
      await this.prisma.brand.upsert({
        where: { id: brand.id },
        create: { id: brand.id, name: brand.name },
        update: { name: brand.name },
      });
      synced++;
    }
    return { synced };
  }
}

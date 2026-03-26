import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * SupplierDiscoveryService — Tedarikçi Keşif Motoru
 *
 * Ürün bazlı en uygun tedarikçi önerileri:
 * - Alibaba, Toptancı pazar verileri
 * - Maliyet karşılaştırması
 * - Yeni ürün fırsat tespiti
 * - Tedarikçi güvenilirlik skoru
 */
@Injectable()
export class SupplierDiscoveryService {
  private readonly logger = new Logger(SupplierDiscoveryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Suggest suppliers for a product category
   */
  async suggestSuppliers(tenantId: string, categoryName: string) {
    // In production: query Alibaba/1688 and local wholesale directories
    const suppliers = [
      {
        name: "Alibaba.com",
        type: "Uluslararası",
        region: "Çin",
        avgLeadTime: "15-30 gün",
        minOrder: "$500",
        categories: ["Elektronik", "Ev & Yaşam", "Giyim"],
        rating: 4.2,
        url: "https://alibaba.com",
      },
      {
        name: "1688.com",
        type: "Uluslararası (B2B)",
        region: "Çin",
        avgLeadTime: "20-40 gün",
        minOrder: "¥1000",
        categories: ["Hepsi"],
        rating: 4.0,
        url: "https://1688.com",
      },
      {
        name: "İstanbul Toptancılar",
        type: "Yerel",
        region: "İstanbul",
        avgLeadTime: "1-3 gün",
        minOrder: "₺1000",
        categories: ["Giyim", "Aksesuar"],
        rating: 3.8,
        url: null,
      },
      {
        name: "İzmir Kemeraltı",
        type: "Yerel",
        region: "İzmir",
        avgLeadTime: "2-5 gün",
        minOrder: "₺500",
        categories: ["Giyim", "Ev Tekstil"],
        rating: 3.5,
        url: null,
      },
    ];

    // Filter by category
    const relevant = suppliers.filter(
      (s) =>
        s.categories.includes("Hepsi") ||
        s.categories.some((c) =>
          c.toLowerCase().includes(categoryName.toLowerCase()),
        ),
    );

    return {
      category: categoryName,
      totalSuppliers: relevant.length,
      suppliers: relevant,
      tips: [
        "💡 İlk siparişte küçük miktarla test et",
        "💡 Birden fazla tedarikçiden teklif al",
        "💡 Numune isteyi prensip olarak yap",
        "💡 Ödeme koşullarını müzakere et (TT, L/C)",
      ],
      source: "estimate" as const,
    };
  }

  /**
   * Cost analysis — should we source domestically or import?
   */
  async analyzeSourcingOptions(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) throw new Error("Ürün bulunamadı");

    const salePrice = Number((product as any).salePrice || 0);
    const currentCost = Number(product.costPrice || salePrice * 0.4);

    return {
      product: product.title,
      currentCost: round(currentCost),
      options: [
        {
          source: "Mevcut Tedarikçi",
          estimatedCost: round(currentCost),
          leadTime: "Mevcut",
          risk: "Düşük",
          savings: "₺0",
        },
        {
          source: "Alibaba (Çin)",
          estimatedCost: round(currentCost * 0.6),
          leadTime: "20-30 gün",
          risk: "Orta (kargo, gümrük)",
          savings: `₺${round(currentCost * 0.4)} / adet`,
        },
        {
          source: "Yerel Toptancı",
          estimatedCost: round(currentCost * 0.85),
          leadTime: "2-5 gün",
          risk: "Düşük",
          savings: `₺${round(currentCost * 0.15)} / adet`,
        },
      ],
      recommendation:
        currentCost > 100
          ? "💡 Yüksek maliyetli ürün — Alibaba'dan tedarik %40 tasarruf sağlayabilir"
          : "💡 Düşük maliyetli ürün — yerel toptancıda kalman daha mantıklı (kargo+gümrük maliyeti)",
      source: "estimate" as const,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

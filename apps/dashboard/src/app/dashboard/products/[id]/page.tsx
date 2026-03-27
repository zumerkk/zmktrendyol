"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../../lib/api";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;

  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/trendyol/products?page=0&pageSize=100"),
    enabled: isAuthenticated(),
  });

  const { data: priceHistory } = useQuery({
    queryKey: ["price-history", productId],
    queryFn: () => api.get(`/trendyol/inventory/price-history/${productId}`),
    enabled: isAuthenticated() && !!productId,
  });

  const { data: priceExtremes } = useQuery({
    queryKey: ["price-extremes", productId],
    queryFn: () => api.get(`/trendyol/inventory/price-extremes/${productId}`),
    enabled: isAuthenticated() && !!productId,
  });

  const { data: stockBreakage } = useQuery({
    queryKey: ["stock-breakage", productId],
    queryFn: () => api.get(`/trendyol/inventory/stock-breakage/${productId}`),
    enabled: isAuthenticated() && !!productId,
  });

  const { data: mlPrediction } = useQuery({
    queryKey: ["ml-prediction", productId],
    queryFn: () => api.get(`/intelligence/prediction/${productId}`),
    enabled: isAuthenticated() && !!productId,
  });

  const { data: optimalPrice } = useQuery({
    queryKey: ["optimal-price", productId],
    queryFn: () => api.get(`/intelligence/optimal-price/${productId}`),
    enabled: isAuthenticated() && !!productId,
  });

  // Find the specific product from the list
  const productList: any[] = Array.isArray(products) ? products : products?.products || products?.items || [];
  const product = productList.find((p: any) => p.id === productId) || null;

  const history: any[] = Array.isArray(priceHistory) ? priceHistory : priceHistory?.history || [];
  const extremes: any = priceExtremes || {};
  const breakage: any = stockBreakage || {};
  const prediction: any = mlPrediction || {};
  const optimal: any = optimalPrice || {};

  const fmt = (n: number) => (n || 0).toLocaleString("tr-TR");
  const fmtMoney = (n: number) => `₺${(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;

  const chartHeight = 160;
  const chartWidth = 400;

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/dashboard/products" style={{ color: "var(--text-muted)", fontSize: 13 }}>
            ← Ürünler
          </a>
          <h1 className="page-title">🧠 Ürün Detay Zeka Paneli</h1>
        </div>
        <p className="page-subtitle">
          {product ? product.title : `Ürün ID: ${productId}`}
        </p>
      </div>

      <div className="page-content animate-fade-in">
        {/* Product Header */}
        <div className="card" style={{ marginBottom: 24, display: "flex", gap: 24 }}>
          <div style={{
            width: 120, height: 120, borderRadius: "var(--radius-md)",
            background: "var(--gradient-card)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 40, flexShrink: 0
          }}>
            📦
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {product?.title || "Ürün bulunamadı"}
            </h2>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: "var(--text-secondary)" }}>
              {product?.brand && <span>🏷️ {product.brand}</span>}
              {product?.categoryName && <span>📂 {product.categoryName}</span>}
              {product?.barcode && <span>📊 Barkod: {product.barcode}</span>}
              {product?.stockCode && <span>🔖 SKU: {product.stockCode}</span>}
              {(product?.onSale || product?.status === "active") && (
                <span className="status-badge active">✅ Satışta</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Liste Fiyat</div>
                <div style={{ fontSize: 16, fontWeight: 700, textDecoration: "line-through", color: "var(--text-muted)" }}>
                  {product?.listPrice ? fmtMoney(product.listPrice) : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Satış Fiyat</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent-success)" }}>
                  {product?.salePrice ? fmtMoney(product.salePrice) : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Stok</div>
                <div style={{
                  fontSize: 24, fontWeight: 800,
                  color: (product?.quantity ?? 0) < 20 ? "var(--accent-warning)" : "var(--text-primary)"
                }}>
                  {product?.quantity ?? product?.stock ?? 0} ad.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intel Panel */}
        <div className="grid-2">
          {/* Price Extremes */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📈 Fiyat Uç Noktaları</div>
              <span className="source-badge api">API</span>
            </div>
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              <div className="kpi-card">
                <div className="kpi-label">En Yüksek</div>
                <div className="kpi-value" style={{ color: "var(--accent-danger)" }}>
                  {fmtMoney(extremes.highest || extremes.maxPrice || 0)}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">En Düşük</div>
                <div className="kpi-value" style={{ color: "var(--accent-success)" }}>
                  {fmtMoney(extremes.lowest || extremes.minPrice || 0)}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Değişim Sayısı</div>
                <div className="kpi-value">
                  {extremes.changeCount || extremes.priceChanges || 0}×
                </div>
              </div>
            </div>
          </div>

          {/* Stock Breakage Analysis */}
          <div className="card" style={{ borderColor: "rgba(245,158,11,0.3)" }}>
            <div className="card-header">
              <div className="card-title" style={{ color: "var(--accent-warning)" }}>
                📦 Stok Kırılma Analizi
              </div>
              <span className="source-badge zmk-engine">ZMK ENGINE</span>
            </div>
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              <div className="kpi-card">
                <div className="kpi-label">Günlük Satış</div>
                <div className="kpi-value">{(breakage.dailySalesRate || 0).toFixed(1)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Tahmini Gün</div>
                <div className="kpi-value" style={{
                  color: (breakage.estimatedDaysLeft || 0) < 14 ? "var(--accent-warning)" : "var(--text-primary)"
                }}>
                  {breakage.estimatedDaysLeft || breakage.daysLeft || "—"}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Durum</div>
                <div className="kpi-value" style={{ fontSize: 14 }}>
                  {breakage.status || breakage.recommendation || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Predictions */}
        <div className="grid-2" style={{ marginTop: 24 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">🧠 ML Satış Tahmini</div>
              <span className="source-badge zmk-engine">AI</span>
            </div>
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              <div className="kpi-card">
                <div className="kpi-label">7 Gün Tahmin</div>
                <div className="kpi-value">{prediction.predicted7Days || prediction.next7Days || 0}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">30 Gün Tahmin</div>
                <div className="kpi-value">{prediction.predicted30Days || prediction.next30Days || 0}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Güven Skoru</div>
                <div className="kpi-value">
                  %{((prediction.confidence || prediction.accuracy || 0) * 100).toFixed(0)}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">💰 Optimal Fiyat Önerisi</div>
              <span className="source-badge zmk-engine">AI</span>
            </div>
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              <div className="kpi-card">
                <div className="kpi-label">Önerilen Fiyat</div>
                <div className="kpi-value" style={{ color: "var(--accent-success)" }}>
                  {fmtMoney(optimal.recommendedPrice || optimal.optimalPrice || 0)}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Mevcut Fiyat</div>
                <div className="kpi-value">
                  {fmtMoney(optimal.currentPrice || product?.salePrice || 0)}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Strateji</div>
                <div className="kpi-value" style={{ fontSize: 12 }}>
                  {optimal.strategy || optimal.reasoning || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Price History */}
        {history.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <div className="card-title">📊 Fiyat Geçmişi</div>
              <span className="source-badge api">API</span>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Tarih</th><th>Fiyat</th><th>Değişim</th></tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((h: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {h.date ? new Date(h.date).toLocaleDateString("tr-TR") : h.period || "—"}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {fmtMoney(h.price || h.salePrice || 0)}
                    </td>
                    <td style={{
                      fontWeight: 600,
                      color: (h.change || 0) > 0 ? "var(--accent-success)" : (h.change || 0) < 0 ? "var(--accent-danger)" : "var(--text-muted)"
                    }}>
                      {h.change ? `${h.change > 0 ? "+" : ""}${h.change}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* AI Actions Sidebar */}
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>🤖 AI Aksiyonlar</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { icon: "💰", label: "Fiyat Öner" },
              { icon: "📦", label: "Stok Güncelle" },
              { icon: "✍️", label: "AI Açıklama" },
              { icon: "📢", label: "Kampanya" },
              { icon: "🔤", label: "Başlık Öner" },
              { icon: "💬", label: "Mesaj Yanıtla" },
            ].map((btn, i) => (
              <button key={i} style={{
                padding: "10px 16px", borderRadius: 8,
                border: "1px solid var(--border-accent)", background: "var(--bg-glass)",
                color: "var(--text-primary)", cursor: "pointer", fontSize: 13,
                display: "flex", alignItems: "center", gap: 6
              }}>
                <span>{btn.icon}</span> {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

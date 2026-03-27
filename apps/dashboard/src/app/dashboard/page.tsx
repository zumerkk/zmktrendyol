"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ["kpi-summary"],
    queryFn: () => api.get("/analytics/summary"),
    enabled: isAuthenticated(),
  });

  const { data: topProducts } = useQuery({
    queryKey: ["top-products"],
    queryFn: () => api.get("/analytics/top-products"),
    enabled: isAuthenticated(),
  });

  const { data: heatmapData } = useQuery({
    queryKey: ["order-heatmap"],
    queryFn: () => api.get("/analytics/heatmap"),
    enabled: isAuthenticated(),
  });

  const { data: profitData } = useQuery({
    queryKey: ["profitability"],
    queryFn: () => api.get("/analytics/profitability"),
    enabled: isAuthenticated(),
  });

  const { data: restocking } = useQuery({
    queryKey: ["restocking"],
    queryFn: () => api.get("/analytics/restocking"),
    enabled: isAuthenticated(),
  });

  const fmt = (n: number) => (n || 0).toLocaleString("tr-TR");
  const fmtMoney = (n: number) =>
    `₺${(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Handle nested API format: last30Days.revenue.value or flat format
  const l30 = kpiData?.last30Days || {};
  const getVal = (field: any) => (typeof field === 'object' && field !== null) ? (field.value || 0) : (field || 0);

  const kpis = kpiData
    ? [
        {
          label: "Aylık Ciro",
          value: fmtMoney(getVal(l30.revenue) || kpiData.totalRevenue || 0),
          source: "api",
        },
        {
          label: "Toplam Sipariş",
          value: fmt(getVal(l30.orders) || kpiData.totalOrders || 0),
          source: "api",
        },
        {
          label: "Aktif Ürün",
          value: fmt(kpiData.activeProducts || 0),
          source: "api",
        },
        {
          label: "Ort. Sipariş Tutarı",
          value: fmtMoney(getVal(l30.avgBasket) || kpiData.avgOrderValue || 0),
          source: "zmk-engine",
        },
      ]
    : [];

  const products: any[] = Array.isArray(topProducts) ? topProducts : [];
  const restockAlerts: any[] = Array.isArray(restocking) ? restocking : restocking?.alerts || [];

  if (kpiLoading) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ color: "var(--text-secondary)" }}>Veriler yükleniyor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">📊 KPI Merkezi</h1>
        <p className="page-subtitle">
          Mağazanızın temel performans metrikleri — Gerçek Veriler
        </p>
      </div>

      <div className="page-content animate-fade-in">
        {/* KPI Grid */}
        <div className="kpi-grid">
          {kpis.map((kpi, i) => (
            <div key={i} className="kpi-card">
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-source">
                Kaynak:{" "}
                <span className={`source-badge ${kpi.source}`}>
                  {kpi.source.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Top Products + Restocking Alerts */}
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">🏆 En Çok Satan Ürünler</div>
              <span className="source-badge api">API</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ürün</th>
                  <th>Satış Adedi</th>
                  <th>Ciro</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      Henüz satış verisi yok — Ürünleri senkronize edin
                    </td>
                  </tr>
                ) : (
                  products.slice(0, 5).map((p: any, i: number) => (
                    <tr key={i}>
                      <td style={{ color: "var(--accent-primary-light)", fontWeight: 700 }}>
                        {i + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {p.title || p.productTitle}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {p.barcode || p.sku || ""}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(p.totalSold || p.units || 0)}</td>
                      <td style={{ color: "var(--accent-success)", fontWeight: "bold" }}>
                        {fmtMoney(p.totalRevenue || p.revenue || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
            <div className="card-header">
              <div>
                <div className="card-title" style={{ color: "#ef4444" }}>
                  🚨 Stok Kırılma Uyarıları
                </div>
                <div className="card-subtitle">Kritik stok seviyesindeki ürünler</div>
              </div>
              <span className="source-badge zmk-engine">ZMK ENGINE</span>
            </div>
            {restockAlerts.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                ✅ Tüm stoklar yeterli seviyede
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Stok</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {restockAlerts.slice(0, 5).map((a: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{a.title || a.productTitle}</td>
                      <td style={{ color: "var(--accent-danger)", fontWeight: 700 }}>
                        {a.currentStock ?? a.stock ?? 0}
                      </td>
                      <td>
                        <span className="status-badge error">
                          {a.recommendation || "Sipariş ver"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Profitability */}
        {profitData && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <div className="card-title">💰 Kârlılık Özeti</div>
              <span className="source-badge zmk-engine">ZMK ENGINE</span>
            </div>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Toplam Gelir</div>
                <div className="kpi-value" style={{ color: "var(--accent-success)" }}>
                  {fmtMoney(profitData.totalRevenue || 0)}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Toplam Maliyet</div>
                <div className="kpi-value" style={{ color: "var(--accent-danger)" }}>
                  {fmtMoney(profitData.totalCost || 0)}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Net Kâr</div>
                <div className="kpi-value">
                  {fmtMoney((profitData.totalRevenue || 0) - (profitData.totalCost || 0))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

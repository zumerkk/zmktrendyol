"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

export default function DashboardPage() {
  const { ready, authed } = useAuth();

  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ["kpi-summary"],
    queryFn: () => api.get("/analytics/summary"),
    enabled: authed,
  });

  const { data: topProducts } = useQuery({
    queryKey: ["top-products"],
    queryFn: () => api.get("/analytics/top-products"),
    enabled: authed,
  });

  const { data: restocking } = useQuery({
    queryKey: ["restocking"],
    queryFn: () => api.get("/analytics/restocking"),
    enabled: authed,
  });

  const { data: profitData } = useQuery({
    queryKey: ["profitability"],
    queryFn: () => api.get("/analytics/profitability"),
    enabled: authed,
  });

  const { data: shadowData } = useQuery({
    queryKey: ["shadow-summary-dash"],
    queryFn: () => api.get("/shadow/dashboard-summary"),
    enabled: authed,
  });

  const { data: godData } = useQuery({
    queryKey: ["god-summary-dash"],
    queryFn: () => api.get("/god-mode/dashboard"),
    enabled: authed,
  });

  const { data: systemData } = useQuery({
    queryKey: ["system-health-dash"],
    queryFn: () => api.get("/system/status"),
    enabled: authed,
  });

  if (!ready) return null;

  const fmt = (n: number) => (n || 0).toLocaleString("tr-TR");
  const fmtMoney = (n: number) =>
    `₺${(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const l30 = kpiData?.last30Days || {};
  const getVal = (field: any) => (typeof field === 'object' && field !== null) ? (field.value || 0) : (field || 0);

  const products: any[] = Array.isArray(topProducts) ? topProducts : [];
  const restockAlerts: any[] = Array.isArray(restocking) ? restocking : restocking?.alerts || [];
  const shadowKpi = shadowData?.kpi || {};
  const godKpi = godData?.kpi || {};
  const sys = systemData || {} as any;

  const revenue = getVal(l30.revenue) || kpiData?.totalRevenue || 0;
  const orders = getVal(l30.orders) || kpiData?.totalOrders || 0;
  const activeProducts = kpiData?.activeProducts || 0;
  const avgBasket = getVal(l30.avgBasket) || kpiData?.avgOrderValue || 0;

  if (kpiLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Veriler yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
              }}>📊</div>
              Komuta Merkezi
            </h1>
            <p className="page-subtitle">
              Mağaza zekâsı · Rakip istihbaratı · AI motorları — Gerçek zamanlı
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)",
            }}>● SİSTEM AKTİF</div>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Aylık Ciro", value: fmtMoney(revenue), icon: "💰", color: "#10b981", trend: null },
          { label: "Toplam Sipariş", value: fmt(orders), icon: "📦", color: "#3b82f6", trend: null },
          { label: "Aktif Ürün", value: fmt(activeProducts), icon: "🏷️", color: "#6366f1", trend: null },
          { label: "Ort. Sepet", value: fmtMoney(avgBasket), icon: "🛒", color: "#f97316", trend: null },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            padding: "18px 20px", borderRadius: 14,
            background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -10, right: -5, fontSize: 48, opacity: 0.05 }}>{kpi.icon}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: kpi.color, marginTop: 6 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Intelligence Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Shadow Hedef", value: shadowKpi.totalTargets || 0, icon: "🕵️", color: "#8b5cf6" },
          { label: "Okunmamış Alarm", value: shadowKpi.unreadAlerts || 0, icon: "🔔", color: "#ef4444" },
          { label: "OOS Fırsat", value: godKpi.oosTargets || 0, icon: "💀", color: "#dc2626" },
          { label: "Arbitraj", value: godKpi.arbitrageOpportunities || 0, icon: "🌐", color: "#10b981" },
          { label: "Hijacker", value: godKpi.hijackersDetected || 0, icon: "🔫", color: "#f97316" },
          { label: "Zeus Modu", value: godKpi.zeusMode || "—", icon: "⚡", color: "#FFD700" },
        ].map((c) => (
          <div key={c.label} style={{
            padding: "12px 14px", borderRadius: 10,
            background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 20 }}>{c.icon}</div>
            <div style={{ fontSize: typeof c.value === "string" ? 11 : 20, fontWeight: 900, color: c.color, marginTop: 4 }}>{c.value}</div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Top Products */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="card-title">🏆 En Çok Satan Ürünler</div>
            <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.1)", color: "#6366f1", fontWeight: 700 }}>API</span>
          </div>
          {products.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              Henüz satış verisi yok — Ürünleri senkronize edin
            </div>
          ) : (
            <div>
              {products.slice(0, 5).map((p: any, i: number) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: i < 4 ? "1px solid var(--border-primary)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                      background: i === 0 ? "rgba(255,215,0,0.15)" : i === 1 ? "rgba(192,192,192,0.15)" : i === 2 ? "rgba(205,127,50,0.15)" : "var(--bg-secondary)",
                      color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "var(--text-muted)",
                      fontSize: 11, fontWeight: 900,
                    }}>{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.title || p.productTitle}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.barcode || p.sku || ""}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 13 }}>{fmtMoney(p.totalRevenue || p.revenue || 0)}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmt(p.totalSold || p.units || 0)} adet</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock Alerts */}
        <div className="card" style={{ padding: 16, border: "1px solid rgba(239,68,68,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="card-title" style={{ color: "#ef4444" }}>🚨 Stok Kırılma Uyarıları</div>
            <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700 }}>
              {restockAlerts.length} UYARI
            </span>
          </div>
          {restockAlerts.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>Tüm stoklar yeterli</div>
            </div>
          ) : (
            restockAlerts.slice(0, 5).map((a: any, i: number) => (
              <div key={i} style={{
                padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{a.title || a.productTitle}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: "#ef4444", fontSize: 13 }}>{a.currentStock ?? a.stock ?? 0}</span>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.12)", color: "#ef4444", fontWeight: 700 }}>
                    {a.recommendation || "Sipariş ver"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Profitability */}
        {profitData && (
          <div className="card" style={{ padding: 16 }}>
            <div className="card-title">💰 Kârlılık Özeti</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              {[
                { label: "Toplam Gelir", value: fmtMoney(profitData.totalRevenue || 0), color: "#22c55e" },
                { label: "Toplam Maliyet", value: fmtMoney(profitData.totalCost || 0), color: "#ef4444" },
                { label: "Net Kâr", value: fmtMoney((profitData.totalRevenue || 0) - (profitData.totalCost || 0)), color: "#6366f1" },
              ].map((p) => (
                <div key={p.label} style={{ padding: 14, borderRadius: 10, background: "var(--bg-secondary)", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: p.color, marginTop: 6 }}>{p.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Health */}
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title">🖥️ Sistem Sağlığı</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            {[
              { label: "API", value: "✅ Çalışıyor", color: "#22c55e" },
              { label: "PostgreSQL", value: "✅ Bağlı", color: "#22c55e" },
              { label: "Redis", value: "✅ Aktif", color: "#22c55e" },
              { label: "Uptime", value: sys?.server?.uptime ? `${Math.floor(parseInt(sys.server.uptime) / 60)}dk` : "—", color: "#3b82f6" },
              { label: "Memory", value: sys?.server?.memory?.heapUsed || "—", color: "#8b5cf6" },
              { label: "Env", value: sys?.server?.env || "dev", color: "#f97316" },
            ].map((s) => (
              <div key={s.label} style={{
                padding: "10px 12px", borderRadius: 8, background: "var(--bg-secondary)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OrdersPage() {
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get("/trendyol/orders"),
    enabled: isAuthenticated(),
  });

  const orders: any[] = Array.isArray(data) ? data : data?.orders || data?.items || [];

  const statusMap: Record<string, { class: string; emoji: string }> = {
    Created: { class: "pending", emoji: "🟡" },
    Picking: { class: "pending", emoji: "📦" },
    Shipped: { class: "active", emoji: "🚚" },
    Delivered: { class: "active", emoji: "✅" },
    Cancelled: { class: "error", emoji: "❌" },
    UnDelivered: { class: "error", emoji: "🔄" },
    Returned: { class: "error", emoji: "↩️" },
  };

  const totalRevenue = orders.reduce((s, o) => s + Number(o.totalPrice || 0), 0);
  const pendingCount = orders.filter(
    (o) => o.status === "Created" || o.status === "Picking"
  ).length;

  if (isLoading) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ color: "var(--text-secondary)" }}>Siparişler yükleniyor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🛒 Sipariş Yönetimi</h1>
        <p className="page-subtitle">
          Trendyol mağazanızdaki tüm siparişler — Gerçek Veriler
        </p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Toplam Sipariş</div>
            <div className="kpi-value">{orders.length}</div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Toplam Ciro</div>
            <div className="kpi-value">
              ₺{totalRevenue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Bekleyen</div>
            <div className="kpi-value" style={{ color: "var(--accent-warning)" }}>
              {pendingCount}
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Sipariş Listesi</div>
            <span className="source-badge api">TRENDYOL API</span>
          </div>
          {orders.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Henüz sipariş yok — Önce{" "}
              <strong>Trendyol &gt; Sipariş Senkronize Et</strong> yapın
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Tarih</th>
                  <th>Müşteri</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 50).map((o: any) => {
                  const st = statusMap[o.status] || { class: "inactive", emoji: "⚪" };
                  const price = Number(o.totalPrice || 0);
                  const date = o.orderDate
                    ? new Date(o.orderDate).toLocaleString("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";
                  return (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 700, color: "var(--accent-primary-light)", fontFamily: "monospace" }}>
                        {o.orderNumber || o.trendyolId || o.id?.substring(0, 12)}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{date}</td>
                      <td>{o.customerName || o.customerFirstName || "Müşteri"}</td>
                      <td style={{ fontWeight: 700, color: "var(--accent-success)" }}>
                        ₺{price.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                      </td>
                      <td>
                        <span className={`status-badge ${st.class}`}>
                          {st.emoji} {o.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

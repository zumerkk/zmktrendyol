"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ReturnsPage() {
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ["claims"],
    queryFn: () => api.get("/trendyol/claims/analytics?days=30"),
    enabled: isAuthenticated(),
  });

  const claims: any = data || {};
  const claimList: any[] = claims.recentClaims || claims.claims || [];

  const statusMap: Record<string, { class: string; label: string }> = {
    Created: { class: "pending", label: "⏳ Bekliyor" },
    Approved: { class: "active", label: "✅ Onaylandı" },
    Resolved: { class: "active", label: "💰 Çözüldü" },
    Rejected: { class: "error", label: "❌ Reddedildi" },
  };

  if (isLoading) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ color: "var(--text-secondary)" }}>İadeler yükleniyor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🔄 İade Yönetimi</h1>
        <p className="page-subtitle">İade takibi ve analiz — Gerçek Veriler</p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Toplam İade</div>
            <div className="kpi-value">{claims.totalClaims || claimList.length || 0}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">İade Oranı</div>
            <div className="kpi-value" style={{ color: "var(--accent-danger)" }}>
              %{(claims.returnRate || 0).toFixed(1)}
            </div>
            <div className="kpi-source">Kaynak: <span className="source-badge zmk-engine">ZMK</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Toplam İade Tutarı</div>
            <div className="kpi-value" style={{ color: "var(--accent-danger)" }}>
              ₺{(claims.totalRefundAmount || 0).toLocaleString("tr-TR")}
            </div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Son İadeler</div>
              <span className="source-badge api">API</span>
            </div>
            {claimList.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                Henüz iade verisi yok — Senkronize edin
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Ürün</th><th>Sebep</th><th>Tutar</th><th>Durum</th></tr>
                </thead>
                <tbody>
                  {claimList.slice(0, 10).map((c: any, i: number) => {
                    const st = statusMap[c.status] || { class: "inactive", label: c.status };
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{c.productTitle || c.claimType || "—"}</td>
                        <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          {c.reason || c.claimType || "—"}
                        </td>
                        <td style={{ fontWeight: 700, color: "var(--accent-danger)" }}>
                          ₺{Number(c.amount || c.totalPrice || 0).toLocaleString("tr-TR")}
                        </td>
                        <td>
                          <span className={`status-badge ${st.class}`}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">İade Sebep Dağılımı</div>
              <span className="source-badge zmk-engine">ZMK ENGINE</span>
            </div>
            {claims.byReason && Object.keys(claims.byReason).length > 0 ? (
              Object.entries(claims.byReason).map(([reason, count]: [string, any]) => (
                <div key={reason} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{reason}</span>
                    <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-tertiary)", overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.min((count / (claims.totalClaims || 1)) * 100, 100)}%`,
                      height: "100%", borderRadius: 3, background: "var(--accent-primary)"
                    }} />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                İade sebep verisi henüz oluşmadı
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

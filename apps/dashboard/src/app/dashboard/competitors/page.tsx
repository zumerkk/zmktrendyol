"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CompetitorsPage() {
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data: competitors, isLoading } = useQuery({
    queryKey: ["competitors"],
    queryFn: () => api.get("/competitors"),
    enabled: isAuthenticated(),
  });

  const { data: buybox } = useQuery({
    queryKey: ["buybox"],
    queryFn: () => api.get("/competitors/buybox/status"),
    enabled: isAuthenticated(),
  });

  const { data: probes } = useQuery({
    queryKey: ["probes"],
    queryFn: () => api.get("/competitors/probes/active"),
    enabled: isAuthenticated(),
  });

  const compList: any[] = Array.isArray(competitors) ? competitors : [];
  const buyboxData: any = buybox || {};
  const probeList: any[] = Array.isArray(probes) ? probes : [];

  if (isLoading) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ color: "var(--text-secondary)" }}>Rakip verileri yükleniyor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">⚔️ Rakip İzleme</h1>
        <p className="page-subtitle">Rakip fiyatları ve buybox durumu — Gerçek Veriler</p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Takip Edilen Rakip</div>
            <div className="kpi-value">{compList.length}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Aktif Probe</div>
            <div className="kpi-value">{probeList.length}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Buybox Uyarısı</div>
            <div className="kpi-value" style={{ color: "var(--accent-danger)" }}>
              {buyboxData.alerts?.length || 0}
            </div>
            <div className="kpi-source">Kaynak: <span className="source-badge estimate">ESTIMATE</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Rakip Listesi</div>
            <span className="source-badge api">API</span>
          </div>
          {compList.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Henüz rakip eklenmedi — Rakip ekleyin
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Ürün</th><th>Marka</th><th>Fiyat</th><th>Takip</th></tr>
              </thead>
              <tbody>
                {compList.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {(c.title || "").substring(0, 50)}
                      </div>
                      {c.trendyolUrl && (
                        <a href={c.trendyolUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, color: "var(--accent-primary-light)" }}>Trendyol'da Gör</a>
                      )}
                    </td>
                    <td>{c.brand || "—"}</td>
                    <td style={{ fontWeight: 700 }}>
                      {c.snapshots?.[0]?.price ? `₺${Number(c.snapshots[0].price).toLocaleString("tr-TR")}` : "—"}
                    </td>
                    <td>
                      <span className="status-badge active">
                        {c.trackedSince ? new Date(c.trackedSince).toLocaleDateString("tr-TR") : "Aktif"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

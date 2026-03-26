"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WarRoomPage() {
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["war-room"],
    queryFn: () => api.get("/intelligence/war-room"),
    enabled: isAuthenticated(),
  });

  const { data: timeline } = useQuery({
    queryKey: ["war-room-timeline"],
    queryFn: () => api.get("/intelligence/war-room/timeline"),
    enabled: isAuthenticated(),
  });

  const { data: strategic } = useQuery({
    queryKey: ["strategic-report"],
    queryFn: () => api.get("/intelligence/strategic-report"),
    enabled: isAuthenticated(),
  });

  const wr: any = dashboard || {};
  const events: any[] = Array.isArray(timeline) ? timeline : [];
  const report: any = strategic || {};

  if (isLoading) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚔️</div>
        <div style={{ color: "var(--text-secondary)" }}>Savaş Odası yükleniyor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">⚔️ Savaş Odası 2.0</h1>
        <p className="page-subtitle">Rekabet istihbaratı ve stratejik analiz — Gerçek Veriler</p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Toplam Olay</div>
            <div className="kpi-value">{wr.totalEvents || 0}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Son 7 Gün</div>
            <div className="kpi-value">{wr.last7Days || 0}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Kritik Uyarı</div>
            <div className="kpi-value" style={{ color: "var(--accent-danger)" }}>
              {wr.criticalAlerts?.length || 0}
            </div>
            <div className="kpi-source">Kaynak: <span className="source-badge zmk-engine">ZMK</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Rakip Sayısı</div>
            <div className="kpi-value">{wr.competitorCount || 0}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">📜 Olay Zaman Çizelgesi</div>
              <span className="source-badge api">API</span>
            </div>
            {events.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Henüz rekabet olayı kaydedilmedi
              </div>
            ) : (
              events.slice(0, 10).map((e: any, i: number) => (
                <div key={i} style={{
                  padding: "12px 16px", borderBottom: "1px solid var(--border-primary)",
                  display: "flex", gap: 12, alignItems: "flex-start"
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 6,
                    background: e.impact === "critical" ? "#ef4444" : e.impact === "high" ? "#f59e0b" : "#6366f1"
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{e.description}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                      {e.createdAt ? new Date(e.createdAt).toLocaleString("tr-TR") : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">🎯 Stratejik Rapor</div>
              <span className="source-badge zmk-engine">ZMK ENGINE</span>
            </div>
            {report.recommendations ? (
              <div style={{ padding: 16 }}>
                {(Array.isArray(report.recommendations) ? report.recommendations : []).map((r: any, i: number) => (
                  <div key={i} style={{
                    padding: 12, marginBottom: 8, borderRadius: 8,
                    background: "rgba(99,102,241,0.08)", border: "1px solid var(--border-accent)"
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--accent-primary-light)" }}>
                      {r.title || r}
                    </div>
                    {r.description && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{r.description}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Stratejik rapor oluşturuluyor...
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

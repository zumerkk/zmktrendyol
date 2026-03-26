"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AgentPage() {
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data: status, isLoading } = useQuery({
    queryKey: ["agent-status"],
    queryFn: () => api.get("/api/agent/status"),
    enabled: isAuthenticated(),
  });

  const { data: log } = useQuery({
    queryKey: ["agent-log"],
    queryFn: () => api.get("/api/agent/log"),
    enabled: isAuthenticated(),
  });

  const { data: insights } = useQuery({
    queryKey: ["agent-insights"],
    queryFn: () => api.get("/api/agent/insights"),
    enabled: isAuthenticated(),
  });

  const runMutation = useMutation({
    mutationFn: () => api.post("/api/agent/run"),
  });

  const agent: any = status || {};
  const logEntries: any[] = Array.isArray(log) ? log : log?.entries || [];
  const insightList: any[] = Array.isArray(insights) ? insights : insights?.insights || [];

  if (isLoading) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
        <div style={{ color: "var(--text-secondary)" }}>Otonom Ajan yükleniyor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🤖 Otonom Ajan</h1>
        <p className="page-subtitle">ClawBot otonom ajan durumu ve aksiyonları — Gerçek Veriler</p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Ajan Durumu</div>
            <div className="kpi-value" style={{ color: agent.isActive ? "#22c55e" : "#ef4444" }}>
              {agent.isActive ? "✅ Aktif" : "⏸ Pasif"}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Son Çalışma</div>
            <div className="kpi-value" style={{ fontSize: 14 }}>
              {agent.lastRun ? new Date(agent.lastRun).toLocaleString("tr-TR") : "Henüz yok"}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Toplam İçgörü</div>
            <div className="kpi-value">{insightList.length}</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            style={{
              padding: "12px 32px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #22d3ee, #06b6d4)", color: "#fff",
              fontSize: 15, fontWeight: 700, cursor: "pointer"
            }}
          >
            {runMutation.isPending ? "⏳ Çalışıyor..." : "🚀 Ajanı Çalıştır"}
          </button>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">📋 Ajan Logu</div>
              <span className="source-badge api">API</span>
            </div>
            {logEntries.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Henüz ajan çalışmadı
              </div>
            ) : (
              logEntries.slice(0, 10).map((e: any, i: number) => (
                <div key={i} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-primary)", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{e.action || e.type || "—"}</span>
                  <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{e.message || e.details || ""}</span>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">💡 AI İçgörüleri</div>
              <span className="source-badge zmk-engine">ZMK</span>
            </div>
            {insightList.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Ajanı çalıştırarak içgörü üretin
              </div>
            ) : (
              insightList.slice(0, 5).map((ins: any, i: number) => (
                <div key={i} style={{
                  padding: 12, margin: "8px 16px", borderRadius: 8,
                  background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)"
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "#22d3ee" }}>
                    {ins.title || ins.type || "İçgörü"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {ins.description || ins.message || ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

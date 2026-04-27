"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";

export default function AgentPage() {
  const { ready, authed } = useAuth();
  const qc = useQueryClient();

  const agentsQ = useQuery({
    queryKey: ["agent-fleet"],
    queryFn: () => api.get("/shadow/agents/status"),
    enabled: authed,
    refetchInterval: 10_000,
  });

  const logQ = useQuery({
    queryKey: ["agent-fleet-log"],
    queryFn: () => api.get("/shadow/agents/log?limit=30"),
    enabled: authed,
    refetchInterval: 15_000,
  });

  const summaryQ = useQuery({
    queryKey: ["agent-summary"],
    queryFn: () => api.get("/shadow/dashboard-summary"),
    enabled: authed,
  });

  const runAgent = useMutation({
    mutationFn: (type: string) => api.post(`/shadow/agents/${type}/run`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-fleet"] });
      qc.invalidateQueries({ queryKey: ["agent-fleet-log"] });
      qc.invalidateQueries({ queryKey: ["agent-summary"] });
    },
  });

  const toggleAgent = useMutation({
    mutationFn: (type: string) => api.post(`/shadow/agents/${type}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-fleet"] }),
  });

  if (!ready) return null;

  const agents: any[] = Array.isArray(agentsQ.data) ? agentsQ.data : [];
  const logEntries: any[] = Array.isArray(logQ.data) ? logQ.data : [];
  const kpi = summaryQ.data?.kpi || {};

  const totalRuns = agents.reduce((s, a) => s + (a.totalRuns || 0), 0);
  const totalFindings = agents.reduce((s, a) => s + (a.totalFindings || 0), 0);
  const activeAgents = agents.filter(a => a.enabled).length;
  const runningAgents = agents.filter(a => a.isRunning).length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>🤖</span> Otonom Ajan Filosu
            </h1>
            <p className="page-subtitle">
              5 Özel Ajan · Otonom Gözetleme · Gerçek Zamanlı Analiz · Akıllı Aksiyonlar
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => agents.forEach(a => runAgent.mutate(a.type))}
              disabled={runAgent.isPending}
              style={{
                padding: "10px 20px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #22d3ee, #06b6d4)",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 12px rgba(6,182,212,0.3)",
              }}
            >
              {runAgent.isPending ? "⏳ Çalışıyor..." : "🚀 Tümünü Çalıştır"}
            </button>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Aktif Ajan", value: `${activeAgents}/${agents.length}`, icon: "🤖", color: "#22d3ee" },
          { label: "Şu An Çalışan", value: runningAgents, icon: "⚡", color: "#10b981" },
          { label: "Toplam Koşu", value: totalRuns, icon: "🔄", color: "#6366f1" },
          { label: "Toplam Bulgu", value: totalFindings, icon: "🔍", color: "#f97316" },
          { label: "İzlenen Hedef", value: kpi.totalTargets || 0, icon: "🎯", color: "#3b82f6" },
          { label: "Okunmamış Alarm", value: kpi.unreadAlerts || 0, icon: "🔔", color: "#ef4444" },
        ].map((c) => (
          <div key={c.label} style={{
            padding: "14px 16px", borderRadius: 12, background: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -6, right: -6, fontSize: 40, opacity: 0.06 }}>{c.icon}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c.color, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Agent Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginBottom: 20 }}>
        {agents.map((agent) => (
          <div key={agent.type} className="card" style={{
            padding: 16, position: "relative", overflow: "hidden",
            border: agent.isRunning ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--border-primary)",
          }}>
            {agent.isRunning && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: "linear-gradient(90deg, #10b981, #059669, #10b981)",
                backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
              }} />
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>{agent.emoji}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{agent.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{agent.description}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "var(--bg-secondary)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Çalışma</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{agent.totalRuns}</div>
              </div>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "var(--bg-secondary)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Bulgu</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f97316" }}>{agent.totalFindings}</div>
              </div>
              <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "var(--bg-secondary)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Durum</div>
                <div style={{ fontSize: 18 }}>{agent.enabled ? "✅" : "⛔"}</div>
              </div>
            </div>

            {agent.lastRunAt && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>
                Son: {new Date(agent.lastRunAt).toLocaleString("tr-TR")}
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button
                onClick={() => runAgent.mutate(agent.type)}
                disabled={agent.isRunning || runAgent.isPending}
                style={{
                  flex: 1, padding: "8px", borderRadius: 8, border: "none",
                  background: agent.isRunning ? "rgba(100,100,100,0.2)" : "linear-gradient(135deg, #6366f1, #818cf8)",
                  color: "#fff", fontWeight: 700, fontSize: 11, cursor: agent.isRunning ? "wait" : "pointer",
                }}
              >
                {agent.isRunning ? "⏳ Çalışıyor" : "▶ Çalıştır"}
              </button>
              <button
                onClick={() => toggleAgent.mutate(agent.type)}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: "none",
                  background: agent.enabled ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                  color: agent.enabled ? "#ef4444" : "#22c55e",
                  fontWeight: 700, fontSize: 11, cursor: "pointer",
                }}
              >
                {agent.enabled ? "⏸ Durdur" : "▶ Aktifleştir"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Agent Log */}
      <div className="card" style={{ padding: 16 }}>
        <div className="card-title">📜 Ajan Görev Geçmişi</div>
        <div style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
          {logEntries.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              Henüz görev kaydı yok — bir ajan çalıştırın
            </div>
          ) : logEntries.map((task: any) => (
            <div key={task.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", borderBottom: "1px solid var(--border-primary)", fontSize: 12,
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{
                  padding: "3px 8px", borderRadius: 6, fontWeight: 700, fontSize: 10,
                  background: task.status === "completed" ? "rgba(34,197,94,0.1)" : task.status === "failed" ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)",
                  color: task.status === "completed" ? "#22c55e" : task.status === "failed" ? "#ef4444" : "#eab308",
                }}>{task.status}</span>
                <span style={{ fontWeight: 600 }}>{task.agentType}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {task.findings > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316" }}>{task.findings} bulgu</span>
                )}
                <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                  {new Date(task.createdAt).toLocaleString("tr-TR")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

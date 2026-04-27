"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../lib/useAuth";
import { api } from "../../../lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ──────────────────────────────────────

type ShadowTarget = {
  id: string;
  trendyolUrl: string;
  productName: string | null;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  currentPrice: string | null;
  lastStockCount: number | null;
  lastStockSignal: string | null;
  reviewCount: number | null;
  rating: string | null;
  sellerName: string | null;
  isActive: boolean;
  lastScanAt: string | null;
  watchlist?: { id: string; name: string } | null;
  alerts?: any[];
};

type AgentStatus = {
  type: string;
  name: string;
  emoji: string;
  description: string;
  enabled: boolean;
  isRunning: boolean;
  lastRunAt: string | null;
  totalRuns: number;
  totalFindings: number;
};

// ─── Helpers ────────────────────────────────────

const fmt = (n: any) => {
  const v = typeof n === "string" ? Number(n) : typeof n === "number" ? n : 0;
  return `₺${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
};

const signalColors: Record<string, { bg: string; text: string; label: string }> = {
  out_of_stock: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", label: "Stok Yok" },
  critical: { bg: "rgba(249,115,22,0.12)", text: "#f97316", label: "Kritik" },
  low: { bg: "rgba(234,179,8,0.12)", text: "#eab308", label: "Düşük" },
  medium: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", label: "Orta" },
  high: { bg: "rgba(34,197,94,0.12)", text: "#22c55e", label: "Yüksek" },
  unknown: { bg: "rgba(148,163,184,0.12)", text: "#94a3b8", label: "Bilinmiyor" },
};

const severityStyles: Record<string, { bg: string; border: string; text: string }> = {
  emergency: { bg: "rgba(220,38,38,0.1)", border: "rgba(220,38,38,0.4)", text: "#ef4444" },
  critical: { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.4)", text: "#f97316" },
  warning: { bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.3)", text: "#eab308" },
  info: { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)", text: "#3b82f6" },
};

// ─── Component ──────────────────────────────────

export default function ShadowPage() {
  const { ready, authed } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "agents" | "reports">("overview");
  const [newUrl, setNewUrl] = useState("");

  // ── Queries ────────────────────────────────────

  const summaryQ = useQuery({
    queryKey: ["shadow-summary"],
    queryFn: () => api.get("/shadow/dashboard-summary"),
    enabled: authed,
    refetchInterval: 30_000,
  });

  const targetsQ = useQuery({
    queryKey: ["shadow-targets"],
    queryFn: () => api.get("/shadow/targets"),
    enabled: authed,
  });

  const agentsQ = useQuery({
    queryKey: ["shadow-agents"],
    queryFn: () => api.get("/shadow/agents/status"),
    enabled: authed && activeTab === "agents",
    refetchInterval: 15_000,
  });

  const agentLogQ = useQuery({
    queryKey: ["shadow-agent-log"],
    queryFn: () => api.get("/shadow/agents/log?limit=20"),
    enabled: authed && activeTab === "agents",
  });

  const alertsQ = useQuery({
    queryKey: ["shadow-alerts"],
    queryFn: () => api.get("/shadow/alerts?limit=30"),
    enabled: authed,
    refetchInterval: 30_000,
  });

  const detailQ = useQuery({
    queryKey: ["shadow-detail", selectedId],
    queryFn: () => api.get(`/shadow/targets/${selectedId}`),
    enabled: authed && !!selectedId,
    refetchInterval: 30_000,
  });

  const salesQ = useQuery({
    queryKey: ["shadow-sales", selectedId],
    queryFn: () => api.get(`/shadow/targets/${selectedId}/sales-analysis?period=daily`),
    enabled: authed && !!selectedId,
  });

  const weeklyQ = useQuery({
    queryKey: ["shadow-weekly"],
    queryFn: () => api.get("/shadow/reports/weekly"),
    enabled: authed && activeTab === "reports",
  });

  const monthlyQ = useQuery({
    queryKey: ["shadow-monthly"],
    queryFn: () => api.get("/shadow/reports/monthly"),
    enabled: authed && activeTab === "reports",
  });

  // ── Mutations ──────────────────────────────────

  const addTarget = useMutation({
    mutationFn: (body: { url: string }) => api.post("/shadow/targets", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shadow-targets"] });
      qc.invalidateQueries({ queryKey: ["shadow-summary"] });
      setNewUrl("");
    },
  });

  const runAgent = useMutation({
    mutationFn: (type: string) => api.post(`/shadow/agents/${type}/run`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shadow-agents"] });
      qc.invalidateQueries({ queryKey: ["shadow-agent-log"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/shadow/alerts/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shadow-alerts"] });
      qc.invalidateQueries({ queryKey: ["shadow-summary"] });
    },
  });

  const targets: ShadowTarget[] = Array.isArray(targetsQ.data?.targets) ? targetsQ.data.targets : Array.isArray(targetsQ.data) ? targetsQ.data : [];
  const kpi = summaryQ.data?.kpi || {};
  const alerts: any[] = Array.isArray(alertsQ.data) ? alertsQ.data : [];
  const agents: AgentStatus[] = Array.isArray(agentsQ.data) ? agentsQ.data : [];
  const detail = detailQ.data;
  const sales = salesQ.data;

  useEffect(() => {
    if (!selectedId && targets.length) setSelectedId(targets[0].id);
  }, [selectedId, targets]);

  if (!ready) return null;

  return (
    <div>
      {/* ── Header ───────────────────────────────── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🕵️</span>
            Gölge İstihbarat Komuta Merkezi
          </h1>
          <p className="page-subtitle">
            Rakip izleme · Stok nöbetçisi · AI ajan filosu · Anlık alarmlar · Detaylı raporlama
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["overview", "agents", "reports"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: activeTab === tab ? "1px solid rgba(16,185,129,0.5)" : "1px solid var(--border-primary)",
                background: activeTab === tab ? "rgba(16,185,129,0.1)" : "var(--bg-secondary)",
                color: activeTab === tab ? "#10b981" : "var(--text-secondary)",
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {tab === "overview" ? "📊 Genel Bakış" : tab === "agents" ? "🤖 Ajan Filosu" : "📋 Raporlar"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Alert Banner ─────────────────────────── */}
      {alerts.filter((a: any) => !a.isRead && (a.severity === "emergency" || a.severity === "critical")).length > 0 && (
        <div style={{
          margin: "0 0 16px 0",
          padding: "12px 16px",
          borderRadius: 12,
          background: "linear-gradient(135deg, rgba(220,38,38,0.08), rgba(249,115,22,0.06))",
          border: "1px solid rgba(239,68,68,0.25)",
          display: "flex",
          gap: 12,
          overflowX: "auto",
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🚨</span>
          <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
            {alerts.filter((a: any) => !a.isRead && (a.severity === "emergency" || a.severity === "critical")).slice(0, 5).map((a: any) => (
              <button
                key={a.id}
                onClick={() => markRead.mutate(a.id)}
                style={{
                  flexShrink: 0,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${severityStyles[a.severity]?.border || "rgba(239,68,68,0.3)"}`,
                  background: severityStyles[a.severity]?.bg || "rgba(239,68,68,0.05)",
                  color: severityStyles[a.severity]?.text || "#ef4444",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                  maxWidth: 280,
                }}
              >
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{a.target?.productName || ""} · Tıkla → okundu</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "İzlenen Ürün", value: kpi.totalTargets || 0, icon: "🎯", color: "#6366f1" },
          { label: "Aktif Hedef", value: kpi.activeTargets || 0, icon: "✅", color: "#22c55e" },
          { label: "Okunmamış Alarm", value: kpi.unreadAlerts || 0, icon: "🔔", color: "#f97316" },
          { label: "Kritik (24s)", value: kpi.criticalAlerts24h || 0, icon: "🚨", color: "#ef4444" },
          { label: "Stok Bitti", value: kpi.oosTargets || 0, icon: "💀", color: "#dc2626" },
          { label: "Düşük Stok", value: kpi.lowStockTargets || 0, icon: "⚠️", color: "#eab308" },
          { label: "Tahm. Satış (24s)", value: kpi.estimatedCompetitorSales24h || 0, icon: "📦", color: "#10b981" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{
              position: "absolute", top: -8, right: -8,
              fontSize: 48, opacity: 0.06,
            }}>{card.icon}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: card.color, marginTop: 4 }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────── */}
      {activeTab === "overview" && (
        <div className="page-content" style={{ display: "grid", gridTemplateColumns: "340px 1fr 340px", gap: 16 }}>
          {/* ── LEFT: Target List ──────────────────── */}
          <div className="card" style={{ padding: 16, maxHeight: "calc(100vh - 400px)", overflowY: "auto" }}>
            <div className="card-title">🎯 Hedef Listesi</div>

            {/* Add form */}
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="trendyol.com/... URL"
                onKeyDown={(e) => e.key === "Enter" && newUrl && addTarget.mutate({ url: newUrl })}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 8,
                  border: "1px solid var(--border-primary)",
                  background: "var(--bg-secondary)", color: "var(--text-primary)",
                  fontSize: 12,
                }}
              />
              <button
                onClick={() => newUrl && addTarget.mutate({ url: newUrl })}
                disabled={!newUrl || addTarget.isPending}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: "none",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                  opacity: !newUrl ? 0.5 : 1,
                }}
              >
                {addTarget.isPending ? "⏳" : "+"}
              </button>
            </div>

            {/* Target list */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {targetsQ.isLoading ? (
                <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 20, textAlign: "center" }}>Yükleniyor…</div>
              ) : targets.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 20, textAlign: "center" }}>
                  Henüz hedef yok. Yukarıdan Trendyol URL'si ekleyin.
                </div>
              ) : (
                targets.map((t) => {
                  const sig = signalColors[t.lastStockSignal || "unknown"] || signalColors.unknown;
                  const unreadCount = t.alerts?.filter((a: any) => !a.isRead).length || 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: selectedId === t.id
                          ? "1px solid rgba(16,185,129,0.5)"
                          : "1px solid var(--border-primary)",
                        background: selectedId === t.id
                          ? "rgba(16,185,129,0.06)"
                          : "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      {unreadCount > 0 && (
                        <span style={{
                          position: "absolute", top: 6, right: 8,
                          background: "#ef4444", color: "#fff",
                          fontSize: 10, fontWeight: 800,
                          padding: "1px 5px", borderRadius: 10,
                        }}>{unreadCount}</span>
                      )}
                      <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
                        {t.productName || "Başlık yok"}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 6,
                          background: sig.bg, color: sig.text, fontWeight: 700,
                        }}>
                          {sig.label} {t.lastStockCount !== null ? `(${t.lastStockCount})` : ""}
                        </span>
                        {t.currentPrice && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                            {fmt(t.currentPrice)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                        {t.lastScanAt ? `Son: ${new Date(t.lastScanAt).toLocaleString("tr-TR")}` : "Henüz taranmadı"}
                        {t.brand ? ` · ${t.brand}` : ""}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── CENTER: Analysis ───────────────────── */}
          <div className="card" style={{ padding: 16 }}>
            <div className="card-title">📈 Analiz Merkezi</div>
            {!selectedId || !detail ? (
              <div style={{ marginTop: 40, textAlign: "center", color: "var(--text-muted)" }}>
                Soldan bir hedef seçin veya yeni ekleyin.
              </div>
            ) : (
              <>
                {/* Target header */}
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{detail.productName || "İsimsiz Ürün"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {detail.brand || ""} · {detail.sellerName || "Satıcı bilinmiyor"} · {detail.category || ""}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Fiyat</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#10b981" }}>{fmt(detail.currentPrice)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Stok</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: (signalColors[detail.lastStockSignal || "unknown"] || signalColors.unknown).text }}>
                        {detail.lastStockCount ?? "?"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Yorum</div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{detail.reviewCount ?? "?"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Puan</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#eab308" }}>★ {detail.rating ? Number(detail.rating).toFixed(1) : "?"}</div>
                    </div>
                  </div>
                </div>

                {/* Sales Analysis */}
                {sales && (
                  <div style={{ marginTop: 14 }}>
                    <div className="label">📦 Satış Analizi (24 saat)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Tahmini Satış</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>{sales.totalSales || 0}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>adet</div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Satış Hızı</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#3b82f6" }}>{sales.salesPerDay || 0}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>adet/gün</div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Tükenme Tahmini</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: sales.daysUntilDepletion && sales.daysUntilDepletion < 3 ? "#ef4444" : "#f97316" }}>
                          {sales.daysUntilDepletion !== null ? `${sales.daysUntilDepletion}` : "∞"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>gün</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                      <div style={{ padding: 10, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Aylık Tahmin</div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{sales.estimatedMonthlySales || 0} adet</div>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Tahm. Ciro</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#10b981" }}>{fmt(sales.estimatedRevenue || 0)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                      Güven: %{sales.confidence || 0} · {sales.dataPoints || 0} veri noktası
                    </div>
                  </div>
                )}

                {/* Stock Logs */}
                {detail.stockLogs && detail.stockLogs.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div className="label">📊 Son Stok Hareketleri</div>
                    <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
                      {detail.stockLogs.slice(0, 10).map((log: any) => (
                        <div key={log.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "6px 10px", borderBottom: "1px solid var(--border-primary)", fontSize: 12,
                        }}>
                          <span style={{
                            padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 10,
                            background: log.eventType === "sale" ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                            color: log.eventType === "sale" ? "#ef4444" : "#22c55e",
                          }}>
                            {log.eventType === "sale" ? "SATIŞ" : log.eventType === "restock" ? "YENİLEME" : log.eventType.toUpperCase()}
                          </span>
                          <span style={{ fontWeight: 700 }}>
                            {log.delta && log.delta > 0 ? `+${log.delta}` : log.delta}
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>
                            Stok: {log.stockAfter}
                          </span>
                          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                            {new Date(log.detectedAt).toLocaleTimeString("tr-TR")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── RIGHT: Alerts ──────────────────────── */}
          <div className="card" style={{ padding: 16, maxHeight: "calc(100vh - 400px)", overflowY: "auto" }}>
            <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🔔 Alarmlar</span>
              <span style={{
                background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800,
                padding: "2px 8px", borderRadius: 10,
              }}>{kpi.unreadAlerts || 0}</span>
            </div>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 20 }}>
                  Aktif alarm yok
                </div>
              ) : (
                alerts.slice(0, 20).map((a: any) => {
                  const sev = severityStyles[a.severity] || severityStyles.info;
                  return (
                    <div key={a.id} style={{
                      padding: 10, borderRadius: 10,
                      border: `1px solid ${sev.border}`,
                      background: sev.bg,
                      opacity: a.isRead ? 0.5 : 1,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: sev.text }}>{a.title}</div>
                        {!a.isRead && (
                          <button
                            onClick={() => markRead.mutate(a.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}
                          >✓</button>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4 }}>
                        {a.message}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                        {a.target?.productName || ""} · {new Date(a.createdAt).toLocaleString("tr-TR")}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Agents Tab ────────────────────────────── */}
      {activeTab === "agents" && (
        <div className="page-content">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {/* Agent Cards */}
            {agents.map((agent) => (
              <div key={agent.type} className="card" style={{
                padding: 16, position: "relative", overflow: "hidden",
                border: agent.isRunning ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--border-primary)",
              }}>
                {agent.isRunning && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 3,
                    background: "linear-gradient(90deg, #10b981, #059669, #10b981)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s infinite",
                  }} />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 24, marginRight: 8 }}>{agent.emoji}</span>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{agent.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => runAgent.mutate(agent.type)}
                      disabled={agent.isRunning || runAgent.isPending}
                      style={{
                        padding: "6px 12px", borderRadius: 8, border: "none",
                        background: "linear-gradient(135deg, #6366f1, #818cf8)",
                        color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer",
                        opacity: agent.isRunning ? 0.5 : 1,
                      }}
                    >
                      {agent.isRunning ? "⏳ Çalışıyor" : "▶ Çalıştır"}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{agent.description}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
                  <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "var(--bg-secondary)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Çalışma</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{agent.totalRuns}</div>
                  </div>
                  <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "var(--bg-secondary)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Bulgu</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#f97316" }}>{agent.totalFindings}</div>
                  </div>
                  <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "var(--bg-secondary)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Durum</div>
                    <div style={{ fontSize: 16 }}>{agent.enabled ? "✅" : "⛔"}</div>
                  </div>
                </div>
                {agent.lastRunAt && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>
                    Son: {new Date(agent.lastRunAt).toLocaleString("tr-TR")}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Agent Log */}
          <div className="card" style={{ marginTop: 16, padding: 16 }}>
            <div className="card-title">📜 Ajan Görev Geçmişi</div>
            <div style={{ marginTop: 12 }}>
              {(agentLogQ.data || []).slice(0, 15).map((task: any) => (
                <div key={task.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", borderBottom: "1px solid var(--border-primary)", fontSize: 12,
                }}>
                  <span style={{ fontWeight: 700 }}>{task.agentType}</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: 10,
                    background: task.status === "completed" ? "rgba(34,197,94,0.1)" : task.status === "failed" ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)",
                    color: task.status === "completed" ? "#22c55e" : task.status === "failed" ? "#ef4444" : "#eab308",
                  }}>{task.status}</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {new Date(task.createdAt).toLocaleString("tr-TR")}
                  </span>
                </div>
              ))}
              {(!agentLogQ.data || agentLogQ.data.length === 0) && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 20, fontSize: 12 }}>
                  Henüz görev kaydı yok
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reports Tab ──────────────────────────── */}
      {activeTab === "reports" && (
        <div className="page-content">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Weekly Report */}
            <div className="card" style={{ padding: 16 }}>
              <div className="card-title">📊 Haftalık Rapor</div>
              {weeklyQ.isLoading ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Yükleniyor…</div>
              ) : weeklyQ.data ? (
                <>
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Toplam Tahmini Satış (7 gün)</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{weeklyQ.data.totalEstimatedSales || 0} adet</div>
                  </div>
                  <div className="label" style={{ marginTop: 14 }}>En Çok Satan Hedefler</div>
                  <div style={{ marginTop: 8 }}>
                    {(weeklyQ.data.targets || []).slice(0, 8).map((t: any, i: number) => (
                      <div key={t.target?.id || i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 0", borderBottom: "1px solid var(--border-primary)", fontSize: 12,
                      }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                            background: i < 3 ? "rgba(234,179,8,0.15)" : "var(--bg-secondary)",
                            color: i < 3 ? "#eab308" : "var(--text-muted)", fontWeight: 800, fontSize: 11,
                          }}>{i + 1}</span>
                          <span style={{ fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.target?.productName || "Bilinmeyen"}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, color: "#10b981" }}>{t.totalSales} adet</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{t.dailyAvgSales}/gün</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Veri yok</div>
              )}
            </div>

            {/* Monthly Report */}
            <div className="card" style={{ padding: 16 }}>
              <div className="card-title">📈 Aylık Rapor</div>
              {monthlyQ.isLoading ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Yükleniyor…</div>
              ) : monthlyQ.data ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                    <div style={{ padding: 12, borderRadius: 10, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Toplam Satış (30g)</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#10b981" }}>{monthlyQ.data.totalEstimatedSales || 0}</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Tahmini Ciro</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#6366f1" }}>{fmt(monthlyQ.data.totalEstimatedRevenue || 0)}</div>
                    </div>
                  </div>
                  <div className="label" style={{ marginTop: 14 }}>Aylık Satış Sıralaması</div>
                  <div style={{ marginTop: 8 }}>
                    {(monthlyQ.data.targets || []).slice(0, 10).map((t: any, i: number) => (
                      <div key={t.target?.id || i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 0", borderBottom: "1px solid var(--border-primary)", fontSize: 12,
                      }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                            background: i < 3 ? "rgba(16,185,129,0.15)" : "var(--bg-secondary)",
                            color: i < 3 ? "#10b981" : "var(--text-muted)", fontWeight: 800, fontSize: 11,
                          }}>{i + 1}</span>
                          <span style={{ fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.target?.productName || "Bilinmeyen"}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, color: "#10b981" }}>{t.totalSales} adet</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>≈{fmt(t.estimatedRevenue || 0)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Veri yok</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

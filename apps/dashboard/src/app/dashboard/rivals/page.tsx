"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../lib/useAuth";
import { api } from "../../../lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Target = { id: string; url: string; title?: string | null; targetMinPrice?: string | null; ourProductId?: string | null; lastScanAt?: string | null; isActive: boolean; brand?: string | null };

export default function RivalsPage() {
  const { ready, authed } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "ai" | "alerts">("overview");
  const [newUrl, setNewUrl] = useState(""); const [newMin, setNewMin] = useState("");

  const targetsQ = useQuery({ queryKey: ["rivals-targets"], queryFn: () => api.get<Target[]>("/rivals/targets"), enabled: authed });
  const targets = (targetsQ.data || []) as Target[];
  useEffect(() => { if (!selectedId && targets.length) setSelectedId(targets[0].id); }, [selectedId, targets]);

  const summaryQ = useQuery({ queryKey: ["rivals-summary", selectedId], queryFn: () => api.get(`/rivals/targets/${selectedId}/summary`), enabled: authed && !!selectedId, refetchInterval: 30_000 });
  const profitQ = useQuery({ queryKey: ["rivals-profit", selectedId], queryFn: () => api.get(`/rivals/targets/${selectedId}/profit`), enabled: authed && !!selectedId });
  const historyQ = useQuery({ queryKey: ["rivals-history", selectedId], queryFn: () => api.get(`/rivals/targets/${selectedId}/history`), enabled: authed && !!selectedId && activeTab === "history" });
  const aiQ = useQuery({ queryKey: ["rivals-ai", selectedId], queryFn: () => api.get(`/rivals/targets/${selectedId}/ai-analysis`), enabled: authed && !!selectedId && activeTab === "ai" });
  const alertsQ = useQuery({ queryKey: ["rivals-alerts", selectedId], queryFn: () => api.get(`/rivals/targets/${selectedId}/alerts`), enabled: authed && !!selectedId && activeTab === "alerts" });

  const scanNow = useMutation({ mutationFn: () => api.post(`/rivals/targets/${selectedId}/scan-now`), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["rivals-summary", selectedId] }); await qc.invalidateQueries({ queryKey: ["rivals-targets"] }); await qc.invalidateQueries({ queryKey: ["rivals-history", selectedId] }); await qc.invalidateQueries({ queryKey: ["rivals-ai", selectedId] }); } });
  const addTarget = useMutation({ mutationFn: (body: { url: string; targetMinPrice?: number }) => api.post("/rivals/targets", body), onSuccess: () => qc.invalidateQueries({ queryKey: ["rivals-targets"] }) });

  const summary: any = summaryQ.data || {};
  const latestScan = summary.latestScan || null;
  const variants: any[] = latestScan?.variants || [];
  const alerts: any[] = summary.alerts || [];
  const decision: any = summary.decision || null;
  const target = summary.target || {};
  const history: any[] = (historyQ.data || []) as any[];
  const aiData: any = aiQ.data || {};
  const allAlerts: any[] = (alertsQ.data || []) as any[];

  const fmtMoney = (n: any) => { const v = typeof n === "string" ? Number(n) : typeof n === "number" ? n : 0; return `${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`; };
  const fmtDate = (d: any) => d ? new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";
  const fmtShort = (d: any) => d ? new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

  if (!ready) return null;

  const stockBadge = (signal: string) => {
    const m: Record<string, { color: string; bg: string; label: string }> = {
      out_of_stock: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Stok Yok" },
      low: { color: "#f97316", bg: "rgba(249,115,22,0.12)", label: "Az" },
      medium: { color: "#eab308", bg: "rgba(234,179,8,0.12)", label: "Orta" },
      high: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "Yuksek" },
      unknown: { color: "#6b7280", bg: "rgba(107,114,128,0.12)", label: "Bilinmiyor" },
    };
    const s = m[signal] || m.unknown;
    return <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: s.color, background: s.bg }}>{s.label}</span>;
  };

  const riskColor = (score: number) => score >= 70 ? "#ef4444" : score >= 40 ? "#f97316" : "#22c55e";

  const tabs = [
    { key: "overview", label: "Genel Bakis", icon: "📊" },
    { key: "history", label: "Tarama Gecmisi", icon: "📅" },
    { key: "ai", label: "AI Analiz", icon: "🧠" },
    { key: "alerts", label: "Alarmlar", icon: "🔔" },
  ] as const;

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🕵️</div>
            Rakip Istihbarat Merkezi
          </h1>
          <p className="page-subtitle">Link bazli izleme · varyant bazinda fiyat/stok · alarmlar · AI analiz · tarama gecmisi</p>
        </div>
        <button onClick={() => scanNow.mutate()} disabled={!selectedId || scanNow.isPending} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
          {scanNow.isPending ? "⏳ Taraniyor..." : "🔄 Simdi Tara"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        {/* SOL: Target Listesi */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Izleme Listesi ({targets.length})</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="Trendyol link" style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 11 }} />
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input value={newMin} onChange={(e) => setNewMin(e.target.value)} placeholder="Alt sinir (TL)" style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 11 }} />
            <button onClick={() => { addTarget.mutate({ url: newUrl, targetMinPrice: newMin ? Number(newMin) : undefined }); setNewUrl(""); setNewMin(""); }} disabled={!newUrl} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>+ Ekle</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {targets.map((t) => (
              <button key={t.id} onClick={() => { setSelectedId(t.id); setActiveTab("overview"); }} style={{ textAlign: "left", padding: "10px 10px", borderRadius: 10, border: selectedId === t.id ? "1px solid rgba(99,102,241,0.5)" : "1px solid var(--border-primary)", background: selectedId === t.id ? "rgba(99,102,241,0.08)" : "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer" }}>
                <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>{t.title || "Baslik yok"}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>{t.lastScanAt ? fmtShort(t.lastScanAt) : "Taranmadi"}</span>
                  {t.brand && <span style={{ color: "#8b5cf6" }}>{t.brand}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* SAG: Detay Panel */}
        <div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: "8px 16px", borderRadius: 8, border: activeTab === t.key ? "1px solid rgba(99,102,241,0.5)" : "1px solid var(--border-primary)", background: activeTab === t.key ? "rgba(99,102,241,0.1)" : "var(--bg-secondary)", color: activeTab === t.key ? "#818cf8" : "var(--text-secondary)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Fiyat Ozeti */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>💰 Fiyat Ozeti</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ padding: 14, borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>En Dusuk Fiyat</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#22c55e", marginTop: 4 }}>{latestScan?.lowestPrice ? fmtMoney(latestScan.lowestPrice) : "—"}</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>En Yuksek Fiyat</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#ef4444", marginTop: 4 }}>{latestScan?.highestPrice ? fmtMoney(latestScan.highestPrice) : "—"}</div>
                  </div>
                </div>
                {/* Tarama Bilgileri */}
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Son Tarama", value: fmtDate(target.lastScanAt) },
                    { label: "Varyant Sayisi", value: variants.length },
                    { label: "Kaynak", value: (latestScan?.rawSignals as any)?.priceSource || "—" },
                    { label: "Kampanya", value: (latestScan?.rawSignals as any)?.basketSignal ? "🏷️ Sepette Gor" : "Yok" },
                  ].map((r) => (
                    <div key={r.label} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--bg-secondary)", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{String(r.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Karar + Alarmlar */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>⚡ Karar & Alarmlar</div>
                <div style={{ padding: 14, borderRadius: 10, background: "var(--bg-secondary)", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Algoritma Karari</div>
                  <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color: decision?.decision === "AGRESIF_INDIR" ? "#ef4444" : decision?.decision === "YUKSEL" ? "#22c55e" : "#f97316" }}>{decision?.decision || "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Skor: {decision?.score || 0}/100</div>
                  {decision?.reasons && <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-secondary)" }}>{(decision.reasons as string[]).join(" · ")}</div>}
                </div>
                {alerts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: 12 }}>✅ Aktif alarm yok</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {alerts.slice(0, 5).map((a: any, i: number) => (
                      <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: a.severity === "critical" ? "rgba(239,68,68,0.06)" : "rgba(249,115,22,0.06)", border: `1px solid ${a.severity === "critical" ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.15)"}` }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: a.severity === "critical" ? "#ef4444" : "#f97316" }}>{a.type}</div>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{a.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Varyant Tablosu */}
              <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>👟 Varyant Detay ({variants.length} beden)</div>
                {variants.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>Tarama yok - "Simdi Tara" ile baslayin</div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Beden</th><th>Satis Fiyati</th><th>Liste Fiyati</th><th>Stok</th><th>Guven</th><th>Durum</th></tr></thead>
                    <tbody>
                      {variants.map((v: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 800 }}>{v.variantKey}</td>
                          <td style={{ color: "#22c55e", fontWeight: 700 }}>{v.salePrice ? fmtMoney(v.salePrice) : "—"}</td>
                          <td style={{ color: "var(--text-muted)" }}>{v.listPrice ? fmtMoney(v.listPrice) : "—"}</td>
                          <td>{stockBadge(v.stockSignal)}</td>
                          <td>{Math.round(Number(v.stockConfidence || 0) * 100)}%</td>
                          <td style={{ fontSize: 11 }}>{v.availabilityText || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Kar Analizi */}
              <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>💰 Kar Analizi (Eslestirilen Urun)</div>
                {!profitQ.data?.mapped ? (
                  <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: 12 }}>Bu rakip henuz bir urunle eslestirilmemis. Target update ile ourProductId girin.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {[
                      { label: "Urun", value: profitQ.data.product?.title, color: "var(--text-primary)" },
                      { label: "Bugun Kar", value: fmtMoney(profitQ.data.day?.profit || 0), color: "#22c55e" },
                      { label: "7 Gun Kar", value: fmtMoney(profitQ.data.week?.profit || 0), color: "#3b82f6" },
                      { label: "30 Gun Kar", value: fmtMoney(profitQ.data.month?.profit || 0), color: "#8b5cf6" },
                    ].map((p) => (
                      <div key={p.label} style={{ padding: 12, borderRadius: 8, background: "var(--bg-secondary)", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: p.color, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>📅 Tarama Gecmisi (Son {history.length} tarama)</div>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>Henuz tarama yapilmamis</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {history.map((h: any, i: number) => (
                    <div key={h.id} style={{ padding: "12px 14px", borderRadius: 10, background: i === 0 ? "rgba(99,102,241,0.06)" : "var(--bg-secondary)", border: i === 0 ? "1px solid rgba(99,102,241,0.2)" : "1px solid var(--border-primary)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: h.status === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: h.status === "success" ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{h.status}</span>
                          <span style={{ fontSize: 12, fontWeight: 800 }}>{fmtDate(h.fetchedAt)}</span>
                          {i === 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontWeight: 700 }}>SON</span>}
                        </div>
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Min:</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#22c55e", marginLeft: 4 }}>{h.lowestPrice ? fmtMoney(h.lowestPrice) : "—"}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Max:</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#ef4444", marginLeft: 4 }}>{h.highestPrice ? fmtMoney(h.highestPrice) : "—"}</span>
                          </div>
                        </div>
                      </div>
                      {h.variants && h.variants.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {h.variants.map((v: any, vi: number) => (
                            <span key={vi} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}>
                              {v.key}: {v.salePrice ? fmtMoney(v.salePrice) : "?"} {stockBadge(v.stockSignal)}
                            </span>
                          ))}
                        </div>
                      )}
                      {h.rawSignals && (
                        <div style={{ marginTop: 6, fontSize: 9, color: "var(--text-muted)" }}>
                          Kaynak: {(h.rawSignals as any).priceSource || "?"} | Kampanya: {(h.rawSignals as any).basketSignal ? "Evet" : "Hayir"} | HTML: {((h.rawSignals as any).htmlSize / 1024).toFixed(0)}KB
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI Analysis Tab */}
          {activeTab === "ai" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Risk Skoru */}
              <div className="card" style={{ padding: 16, textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 16 }}>🎯 Risk Degerlendirmesi</div>
                <div style={{ width: 100, height: 100, borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", border: `4px solid ${riskColor(aiData.riskScore || 50)}`, position: "relative" }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: riskColor(aiData.riskScore || 50) }}>{aiData.riskScore || 50}</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>/100</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 14, fontWeight: 800, color: riskColor(aiData.riskScore || 50) }}>{aiData.riskLevel || "ORTA"} RISK</div>
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>{aiData.scanCount || 0} tarama analiz edildi</div>
              </div>

              {/* Oneriler */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>💡 AI Onerileri</div>
                {(aiData.recommendations || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 12 }}>Yeterli veri yok — daha fazla tarama yapin</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(aiData.recommendations || []).map((r: string, i: number) => (
                      <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>💡 {r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Insights */}
              <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>📊 Detayli Analiz Raporu</div>
                {(aiData.insights || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 12 }}>Henuz analiz verisi yok</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(aiData.insights || []).map((ins: string, i: number) => (
                      <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-secondary)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 14 }}>{i === 0 ? "📈" : i === 1 ? "📉" : i === 2 ? "📊" : "🔍"}</span>
                        <span style={{ fontSize: 12 }}>{ins}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fiyat Gecmisi Tablosu */}
              {aiData.priceHistory && aiData.priceHistory.length > 0 && (
                <div className="card" style={{ padding: 16, gridColumn: "1 / -1" }}>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>📅 Fiyat Trendi</div>
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 120 }}>
                    {[...aiData.priceHistory].reverse().map((p: any, i: number) => {
                      const prices = aiData.priceHistory.map((x: any) => x.price);
                      const min = Math.min(...prices) * 0.9;
                      const max = Math.max(...prices) * 1.1;
                      const h = ((p.price - min) / (max - min)) * 100;
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <div style={{ fontSize: 8, color: "var(--text-muted)" }}>{fmtMoney(p.price)}</div>
                          <div style={{ width: "100%", height: `${h}%`, borderRadius: "4px 4px 0 0", background: `linear-gradient(to top, rgba(99,102,241,0.3), rgba(99,102,241,0.8))`, minHeight: 4 }} />
                          <div style={{ fontSize: 7, color: "var(--text-muted)" }}>{fmtShort(p.date)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === "alerts" && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>🔔 Tum Alarmlar ({allAlerts.length})</div>
              {allAlerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>Alarm gecmisi bos</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {allAlerts.map((a: any, i: number) => (
                    <div key={a.id || i} style={{ padding: "10px 12px", borderRadius: 8, background: a.isActive ? (a.severity === "critical" ? "rgba(239,68,68,0.06)" : "rgba(249,115,22,0.06)") : "var(--bg-secondary)", border: `1px solid ${a.isActive ? (a.severity === "critical" ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.15)") : "var(--border-primary)"}`, opacity: a.isActive ? 1 : 0.5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: a.severity === "critical" ? "rgba(239,68,68,0.15)" : a.severity === "warning" ? "rgba(249,115,22,0.15)" : "rgba(99,102,241,0.15)", color: a.severity === "critical" ? "#ef4444" : a.severity === "warning" ? "#f97316" : "#818cf8", fontWeight: 700 }}>{a.severity}</span>
                          <span style={{ fontWeight: 700, fontSize: 11 }}>{a.type}</span>
                          {a.isActive && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: 700 }}>AKTIF</span>}
                        </div>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtDate(a.updatedAt)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{a.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

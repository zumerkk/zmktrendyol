"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";

export default function WarRoomPage() {
  const { ready, authed } = useAuth();
  const qc = useQueryClient();

  // Pull data from multiple sources for a comprehensive view
  const shadowQ = useQuery({
    queryKey: ["wr-shadow"],
    queryFn: () => api.get("/shadow/dashboard-summary"),
    enabled: authed,
  });

  const targetsQ = useQuery({
    queryKey: ["wr-targets"],
    queryFn: () => api.get("/shadow/targets"),
    enabled: authed,
  });

  const alertsQ = useQuery({
    queryKey: ["wr-alerts"],
    queryFn: () => api.get("/shadow/alerts?limit=50"),
    enabled: authed,
  });

  const rivalsQ = useQuery({
    queryKey: ["wr-rivals"],
    queryFn: () => api.get("/rivals/targets"),
    enabled: authed,
  });

  const productsQ = useQuery({
    queryKey: ["wr-products"],
    queryFn: () => api.get("/products?limit=20"),
    enabled: authed,
  });

  if (!ready) return null;

  const kpi = shadowQ.data?.kpi || {};
  const targets: any[] = Array.isArray(targetsQ.data?.targets) ? targetsQ.data.targets : Array.isArray(targetsQ.data) ? targetsQ.data : [];
  const alerts: any[] = Array.isArray(alertsQ.data) ? alertsQ.data : [];
  const rivals: any[] = Array.isArray(rivalsQ.data) ? rivalsQ.data : Array.isArray(rivalsQ.data?.targets) ? rivalsQ.data.targets : [];
  const products: any[] = Array.isArray(productsQ.data) ? productsQ.data : Array.isArray(productsQ.data?.products) ? productsQ.data.products : [];

  const oosCount = targets.filter((t) => t.lastStockSignal === "out_of_stock").length;
  const lowCount = targets.filter((t) => t.lastStockSignal === "critical" || t.lastStockSignal === "low").length;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical" || a.severity === "emergency");

  // Market positioning analysis
  const avgCompetitorPrice = targets.length > 0
    ? targets.reduce((sum, t) => sum + (Number(t.currentPrice) || 0), 0) / targets.length
    : 0;

  const fmt = (v: any) => `₺${(Number(v) || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;

  const threatLevel = criticalAlerts.length > 3 ? "KRİTİK" : criticalAlerts.length > 0 ? "YÜKSEK" : oosCount > 2 ? "ORTA" : "DÜŞÜK";
  const threatColor = threatLevel === "KRİTİK" ? "#ef4444" : threatLevel === "YÜKSEK" ? "#f97316" : threatLevel === "ORTA" ? "#eab308" : "#22c55e";

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>⚔️</span> Savaş Odası 2.0
            </h1>
            <p className="page-subtitle">
              Rekabet istihbaratı · Pazar konumlandırma · Stratejik analiz — Live Data
            </p>
          </div>
          <div style={{
            padding: "8px 16px", borderRadius: 10, fontWeight: 800, fontSize: 13,
            background: `${threatColor}15`, border: `1px solid ${threatColor}40`, color: threatColor,
          }}>
            TEHDİT: {threatLevel}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "İzlenen Rakip", value: targets.length, icon: "🎯", color: "#6366f1" },
          { label: "Stok Bitti (Rakip)", value: oosCount, icon: "💀", color: "#ef4444" },
          { label: "Düşük Stok", value: lowCount, icon: "⚠️", color: "#eab308" },
          { label: "Kritik Alarm", value: criticalAlerts.length, icon: "🚨", color: "#dc2626" },
          { label: "Ort. Rakip Fiyat", value: fmt(avgCompetitorPrice), icon: "💰", color: "#10b981" },
          { label: "Bizim Ürün", value: products.length, icon: "📦", color: "#3b82f6" },
          { label: "Rakip (V1)", value: rivals.length, icon: "👁️", color: "#8b5cf6" },
        ].map((c) => (
          <div key={c.label} style={{
            padding: "14px 16px", borderRadius: 12, background: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -6, right: -6, fontSize: 40, opacity: 0.06 }}>{c.icon}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>{c.label}</div>
            <div style={{ fontSize: typeof c.value === "string" ? 16 : 24, fontWeight: 900, color: c.color, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Threat Matrix */}
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title">🔴 Tehdit Matrisi — Kritik Olaylar</div>
          <div style={{ marginTop: 10, maxHeight: 350, overflowY: "auto" }}>
            {criticalAlerts.length === 0 && oosCount === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 13 }}>Aktif tehdit bulunmuyor</div>
              </div>
            ) : (
              <>
                {/* OOS threats */}
                {targets.filter((t) => t.lastStockSignal === "out_of_stock").map((t) => (
                  <div key={`oos-${t.id}`} style={{
                    padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                    background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>💀 {t.productName || "Ürün"}</div>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 800 }}>STOK BİTTİ</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {t.brand} · {fmt(t.currentPrice)} · Fırsat: Fiyat artır veya reklam bas
                    </div>
                  </div>
                ))}
                {/* Critical alerts */}
                {criticalAlerts.slice(0, 10).map((a) => (
                  <div key={a.id} style={{
                    padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                    background: a.severity === "emergency" ? "rgba(220,38,38,0.05)" : "rgba(249,115,22,0.05)",
                    border: `1px solid ${a.severity === "emergency" ? "rgba(220,38,38,0.15)" : "rgba(249,115,22,0.15)"}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: a.severity === "emergency" ? "#ef4444" : "#f97316" }}>{a.title}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{a.message?.slice(0, 100)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Strategic Recommendations */}
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title">🎯 Stratejik Öneriler — AI Engine</div>
          <div style={{ marginTop: 10 }}>
            {/* Auto-generated strategies based on data */}
            {[
              ...(oosCount > 0 ? [{
                icon: "🔥", title: "OOS Fırsat Penceresi",
                desc: `${oosCount} rakip ürün stoksuz. Bu ürünlerde fiyat artırma veya reklam bütçesi artırma fırsatı.`,
                priority: "critical", action: "God Mode → OOS Yağmacı"
              }] : []),
              ...(lowCount > 0 ? [{
                icon: "⚡", title: "Düşük Stok Gözetleme",
                desc: `${lowCount} rakip ürün düşük stokta. Yakında tükenebilir — hazır olun.`,
                priority: "warning", action: "Shadow → Stok İzleme"
              }] : []),
              ...(targets.length > 0 ? [{
                icon: "📊", title: "Fiyat Pozisyonu Analizi",
                desc: `${targets.length} rakip izleniyor. Ort. rakip fiyat: ${fmt(avgCompetitorPrice)}. Fiyatlarınızı karşılaştırın.`,
                priority: "info", action: "Rakip Takip → Karşılaştırma"
              }] : []),
              {
                icon: "🌐", title: "Tedarik Arbitrajı Taraması",
                desc: "Rakip fiyatları ile Çin üretici fiyatlarını karşılaştırarak yüksek marjlı ürünleri tespit edin.",
                priority: "info", action: "God Mode → Arbitraj"
              },
              {
                icon: "🛡️", title: "Buybox Savunma Kontrolü",
                desc: "Ürünlerinizin buybox'ında yetkisiz satıcı olup olmadığını kontrol edin.",
                priority: "info", action: "God Mode → Hijacker"
              },
            ].map((s, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 8, borderRadius: 10,
                background: s.priority === "critical" ? "rgba(239,68,68,0.05)" : s.priority === "warning" ? "rgba(234,179,8,0.05)" : "rgba(99,102,241,0.05)",
                border: `1px solid ${s.priority === "critical" ? "rgba(239,68,68,0.15)" : s.priority === "warning" ? "rgba(234,179,8,0.15)" : "rgba(99,102,241,0.15)"}`,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  {s.icon} {s.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{s.desc}</div>
                <div style={{ fontSize: 10, color: "#6366f1", marginTop: 4, fontWeight: 600 }}>📍 {s.action}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Competitor Radar */}
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title">📡 Rakip Radar — Stok Sinyalleri</div>
          <div style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
            {targets.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                Shadow modülünden rakip hedefi ekleyin
              </div>
            ) : targets.slice(0, 15).map((t) => {
              const sig = t.lastStockSignal || "unknown";
              const sigColor = sig === "out_of_stock" ? "#ef4444" : sig === "critical" ? "#f97316" : sig === "low" ? "#eab308" : sig === "high" ? "#22c55e" : "#94a3b8";
              return (
                <div key={t.id} style={{
                  padding: "8px 12px", borderBottom: "1px solid var(--border-primary)",
                  display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12,
                }}>
                  <div style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                    {t.productName || "—"}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>{fmt(t.currentPrice)}</span>
                    <span style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 800,
                      background: `${sigColor}18`, color: sigColor,
                    }}>
                      {t.lastStockCount ?? "?"} adet
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Alert Timeline */}
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title">📜 Olay Zaman Çizelgesi</div>
          <div style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
            {alerts.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                Henüz olay kaydedilmedi. Ajanları çalıştırın.
              </div>
            ) : alerts.slice(0, 15).map((a) => {
              const sev = a.severity || "info";
              const sevColor = sev === "emergency" ? "#ef4444" : sev === "critical" ? "#f97316" : sev === "warning" ? "#eab308" : "#3b82f6";
              return (
                <div key={a.id} style={{
                  padding: "10px 12px", borderBottom: "1px solid var(--border-primary)",
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: sevColor }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{a.title}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{a.message?.slice(0, 80)}</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 3 }}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleString("tr-TR") : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

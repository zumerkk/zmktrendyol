"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";

export default function GodModePage() {
  const { ready, authed } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["god-mode-dashboard"],
    queryFn: () => api.get("/god-mode/dashboard"),
    enabled: authed,
    refetchInterval: 30_000,
  });

  const snipeMut = useMutation({
    mutationFn: (id: string) => api.post(`/god-mode/oos-snipe/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["god-mode-dashboard"] }),
  });

  const arbitrageMut = useMutation({
    mutationFn: () => api.post("/god-mode/arbitrage-scan"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["god-mode-dashboard"] }),
  });

  const cartelMut = useMutation({
    mutationFn: () => api.post("/god-mode/detect-cartel"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["god-mode-dashboard"] }),
  });

  if (!ready) return null;

  const d = data || {} as any;
  const kpi = d.kpi || {};
  const oosSniper = d.oosSniper || {};
  const zeus = d.zeus || {};
  const hijacker = d.hijacker || {};
  const arb = d.arbitrage || {};
  const actions = d.recentActions || [];
  const lowStock = d.lowStockWatchlist || [];

  const fmt = (v: any) => `₺${(Number(v) || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 50, marginBottom: 16, animation: "pulse 1.5s infinite" }}>⚡</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 16 }}>God Mode yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, #FFD700, #FFA500)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, boxShadow: "0 0 20px rgba(255,215,0,0.3)",
          }}>⚡</div>
          <div>
            <h1 className="page-title" style={{ color: "#FFD700", textShadow: "0 0 10px rgba(255,215,0,0.2)" }}>
              God Mode — Mutlak Hakimiyet
            </h1>
            <p className="page-subtitle">
              OOS Yağmacı · Zeus Keskin Nişancı · Hijacker İnfaz · Çin Tedarik Arbitrajı
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "OOS Hedef", value: kpi.oosTargets || 0, icon: "💀", color: "#ef4444", desc: "Stoksuz rakip" },
          { label: "Düşük Stok", value: kpi.lowStockTargets || 0, icon: "⚠️", color: "#eab308", desc: "Kritik seviye" },
          { label: "Arbitraj Fırsat", value: kpi.arbitrageOpportunities || 0, icon: "🌐", color: "#10b981", desc: "Yüksek marj" },
          { label: "Hijacker Tehdit", value: kpi.hijackersDetected || 0, icon: "🔫", color: "#f97316", desc: "Buybox paraziti" },
          { label: "Zeus Modu", value: kpi.zeusMode || "STANDBY", icon: "⚡", color: "#FFD700", desc: "Reklam stratejisi" },
          { label: "God Aksiyonu", value: kpi.totalGodModeActions || 0, icon: "🎯", color: "#8b5cf6", desc: "Toplam işlem" },
        ].map((c) => (
          <div key={c.label} style={{
            padding: "14px 16px", borderRadius: 12,
            background: "var(--bg-secondary)", border: "1px solid var(--border-primary)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -8, right: -8, fontSize: 44, opacity: 0.06 }}>{c.icon}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>{c.label}</div>
            <div style={{ fontSize: typeof c.value === "string" ? 13 : 24, fontWeight: 900, color: c.color, marginTop: 4 }}>{c.value}</div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{c.desc}</div>
          </div>
        ))}
      </div>

      {/* 4 Main Panels Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* ═══ OOS YAĞMACI ═══ */}
        <div className="card" style={{ padding: 16, border: "1px solid rgba(239,68,68,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
                💀 OOS Yağmacı Algoritma
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Rakip stoku bitince fiyatı otomatik artır
              </div>
            </div>
            <div style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800,
              background: (oosSniper.readyToSnipe || 0) > 0 ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
              color: (oosSniper.readyToSnipe || 0) > 0 ? "#ef4444" : "#22c55e",
            }}>
              {(oosSniper.readyToSnipe || 0) > 0 ? `${oosSniper.readyToSnipe} HEDEF TETİKTE` : "TEMİZ"}
            </div>
          </div>

          {(oosSniper.targets || []).length > 0 ? (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {(oosSniper.targets || []).map((t: any) => (
                <div key={t.id} style={{
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                  background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.productName || "İsimsiz Ürün"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {t.brand || ""} · Stok: {t.lastStockCount ?? 0} · {fmt(t.currentPrice)}
                    </div>
                  </div>
                  <button
                    onClick={() => snipeMut.mutate(t.id)}
                    disabled={snipeMut.isPending}
                    style={{
                      padding: "6px 12px", borderRadius: 6, border: "none",
                      background: "linear-gradient(135deg, #dc2626, #ef4444)",
                      color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer",
                    }}
                  >🔥 Snipe</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              Şu an stoksuz rakip hedefi yok. Shadow modülünden hedef ekleyin.
            </div>
          )}

          {/* Low stock watchlist */}
          {lowStock.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.15)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#eab308", marginBottom: 6 }}>⚠️ Düşük Stok Gözetleme ({lowStock.length})</div>
              {lowStock.slice(0, 5).map((t: any) => (
                <div key={t.id} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid rgba(234,179,8,0.08)", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.productName}</span>
                  <span style={{ fontWeight: 800, color: "#eab308" }}>Stok: {t.stockCount}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ ZEUS KESKİN NİŞANCI ═══ */}
        <div className="card" style={{ padding: 16, border: "1px solid rgba(255,215,0,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#FFD700", display: "flex", alignItems: "center", gap: 8 }}>
                ⚡ Zeus Keskin Nişancı Reklam
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Prime-Time'da bütçeyi 3x çarp, gece durdur
              </div>
            </div>
            <div style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800,
              background: zeus.currentMode === "AGGRESSIVE" ? "rgba(255,215,0,0.2)" : zeus.currentMode === "PAUSED" ? "rgba(100,100,100,0.2)" : "rgba(59,130,246,0.15)",
              color: zeus.currentMode === "AGGRESSIVE" ? "#FFD700" : zeus.currentMode === "PAUSED" ? "#94a3b8" : "#3b82f6",
            }}>
              {zeus.currentMode === "AGGRESSIVE" ? "🔥 SALDIRI MODU" : zeus.currentMode === "PAUSED" ? "💤 UYKU" : "📡 BEKLEME"}
            </div>
          </div>

          {/* Zeus Mode Visualization */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Bütçe Çarpanı", value: `${zeus.budgetMultiplier || 1}x`, color: "#FFD700" },
              { label: "Prime Time", value: zeus.primeTimeWindow || "19-23", color: "#f97316" },
              { label: "Kampanya", value: (zeus.campaigns || []).length, color: "#6366f1" },
            ].map((s) => (
              <div key={s.label} style={{ padding: 10, borderRadius: 8, background: "var(--bg-secondary)", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>⏰ Saat Dilimi Stratejisi</div>
            <div style={{ display: "flex", gap: 2, height: 24 }}>
              {Array.from({ length: 24 }, (_, h) => {
                const isPrime = h >= 19 && h <= 23;
                const isDead = h >= 2 && h <= 7;
                const currentHour = new Date().getHours();
                return (
                  <div key={h} style={{
                    flex: 1, borderRadius: 3,
                    background: isPrime ? "rgba(255,215,0,0.6)" : isDead ? "rgba(100,100,100,0.2)" : "rgba(59,130,246,0.2)",
                    border: h === currentHour ? "2px solid #fff" : "none",
                    position: "relative",
                  }}>
                    {h % 6 === 0 && (
                      <div style={{ position: "absolute", bottom: -14, left: 0, fontSize: 8, color: "var(--text-muted)" }}>{h}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 18, fontSize: 9, color: "var(--text-muted)" }}>
              <span>🟡 Prime Time (3x)</span><span>🔵 Normal</span><span>⬛ Uyku (0x)</span>
            </div>
          </div>
        </div>

        {/* ═══ HİJACKER İNFAZ ═══ */}
        <div className="card" style={{ padding: 16, border: "1px solid rgba(249,115,22,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f97316", display: "flex", alignItems: "center", gap: 8 }}>
                🔫 Hijacker İnfaz Sistemi
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Buybox parazitlerini tespit et ve infaz et
              </div>
            </div>
            <div style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800,
              background: (hijacker.totalThreats || 0) > 0 ? "rgba(249,115,22,0.15)" : "rgba(34,197,94,0.15)",
              color: (hijacker.totalThreats || 0) > 0 ? "#f97316" : "#22c55e",
            }}>
              {(hijacker.totalThreats || 0) > 0 ? `${hijacker.totalThreats} TEHDİT` : "GÜVENLİ"}
            </div>
          </div>

          {(hijacker.detected || []).length > 0 ? (
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {(hijacker.detected || []).map((h: any, i: number) => (
                <div key={i} style={{
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                  background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.12)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f97316" }}>🚨 {h.seller}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{h.product}</div>
                    </div>
                    <button style={{
                      padding: "4px 10px", borderRadius: 6, border: "none",
                      background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                      color: "#fff", fontSize: 9, fontWeight: 800, cursor: "pointer",
                    }}>⚖️ İHBAR</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 30, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🛡️</div>
              <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>Buybox'ınız Güvende</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Yetkisiz satıcı tespit edilmedi</div>
            </div>
          )}

          <button
            onClick={() => cartelMut.mutate()}
            disabled={cartelMut.isPending}
            style={{
              marginTop: 10, width: "100%", padding: "10px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >{cartelMut.isPending ? "⏳ Taranıyor..." : "🔍 Kartel / Tekelci Tara"}</button>
        </div>

        {/* ═══ ÇİN TEDARİK ARBİTRAJI ═══ */}
        <div className="card" style={{ padding: 16, border: "1px solid rgba(16,185,129,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981", display: "flex", alignItems: "center", gap: 8 }}>
                🌐 Çin Tedarik Arbitrajı
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Alibaba/1688 maliyet karşılaştırması · ROI hesaplama
              </div>
            </div>
            <button
              onClick={() => arbitrageMut.mutate()}
              disabled={arbitrageMut.isPending}
              style={{
                padding: "6px 12px", borderRadius: 6, border: "none",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer",
              }}
            >{arbitrageMut.isPending ? "⏳" : "🔄 Tara"}</button>
          </div>

          {(arb.opportunities || []).length > 0 ? (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {(arb.opportunities || []).map((opp: any, i: number) => (
                <div key={i} style={{
                  padding: 12, marginBottom: 8, borderRadius: 10,
                  background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)",
                }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opp.productName}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                    <div style={{ textAlign: "center", padding: 6, borderRadius: 6, background: "var(--bg-secondary)" }}>
                      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>TR Fiyat</div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{fmt(opp.competitorPrice)}</div>
                    </div>
                    <div style={{ textAlign: "center", padding: 6, borderRadius: 6, background: "var(--bg-secondary)" }}>
                      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Bizim Fiyat</div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{fmt(opp.ourPrice)}</div>
                    </div>
                    <div style={{ textAlign: "center", padding: 6, borderRadius: 6, background: "rgba(16,185,129,0.08)" }}>
                      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Çin Tahmini</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#10b981" }}>{fmt(opp.chinaEstimate)}</div>
                    </div>
                    <div style={{ textAlign: "center", padding: 6, borderRadius: 6, background: "rgba(34,197,94,0.12)" }}>
                      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>ROI</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#22c55e" }}>%{opp.roiPercent}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
                    <span>Marj: %{opp.marginPercent}</span>
                    <span>Aylık Kâr: {fmt(opp.estimatedProfit)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 30, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Arbitraj taraması için "Tara" butonuna basın</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Ürün ve rakip verisi gereklidir</div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Actions Log */}
      {actions.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <div className="card-title" style={{ color: "#FFD700" }}>📜 Son God Mode Aksiyonları</div>
          <div style={{ marginTop: 10, maxHeight: 200, overflowY: "auto" }}>
            {actions.map((a: any) => (
              <div key={a.id} style={{
                padding: "8px 12px", borderBottom: "1px solid var(--border-primary)",
                display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12,
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: "#FFD700" }}>{a.title}</span>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{a.description?.slice(0, 100)}</div>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                  {new Date(a.createdAt).toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

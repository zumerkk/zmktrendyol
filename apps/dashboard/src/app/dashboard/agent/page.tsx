"use client";

import { useState, useEffect } from "react";

export default function AgentPage() {
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [agentLog, setAgentLog] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  // Demo data — in production, fetched from API
  useEffect(() => {
    setAgentStatus({
      enabled: true,
      isRunning: false,
      lastRunAt: new Date().toISOString(),
      stats: {
        totalDecisions: 147,
        totalActions: 89,
        uptime: "12m ago",
      },
    });

    setAgentLog([
      {
        id: "1",
        timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
        data: {
          observations: {
            competitorPriceChanges: 3,
            buyboxLost: 1,
            lowStockAlerts: 2,
            competitorOutOfStock: 1,
            todayOrders: 34,
          },
          decisionsCount: 4,
          actionsCount: 3,
        },
      },
      {
        id: "2",
        timestamp: new Date(Date.now() - 27 * 60000).toISOString(),
        data: {
          observations: {
            competitorPriceChanges: 1,
            buyboxLost: 0,
            lowStockAlerts: 0,
            competitorOutOfStock: 2,
            todayOrders: 28,
          },
          decisionsCount: 2,
          actionsCount: 2,
        },
      },
      {
        id: "3",
        timestamp: new Date(Date.now() - 42 * 60000).toISOString(),
        data: {
          observations: {
            competitorPriceChanges: 0,
            buyboxLost: 0,
            lowStockAlerts: 1,
            competitorOutOfStock: 0,
            todayOrders: 22,
          },
          decisionsCount: 1,
          actionsCount: 1,
        },
      },
    ]);

    setInsights([
      {
        id: "i1",
        type: "buybox_lost",
        priority: 1,
        title: "🤖 Ajan: Buybox Kaybedildi!",
        description: 'Kadın Bot Süet ürününde Buybox rakibe geçti. Fiyat farkı: ₺12.50',
        suggestedAction: "Fiyatı ₺399.90'a çek veya kargo hızını artır",
        createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
        isCompleted: false,
      },
      {
        id: "i2",
        type: "competitor_oos",
        priority: 2,
        title: "🤖 Ajan: Rakip Stoğu Bitti — Fırsat!",
        description: "Ana rakibin 'Erkek Spor Ayakkabı' ürünü stokta yok",
        suggestedAction: "Fiyatı %5 artır — trafik sana yönlenecek",
        createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
        isCompleted: false,
      },
      {
        id: "i3",
        type: "low_stock",
        priority: 2,
        title: "🤖 Ajan: Stok Kritik Seviyede",
        description: "Kış Montu Premium XL — Kalan stok: 3 adet, tahmini tükenme: 2 gün",
        suggestedAction: "Tedarikçiye acil sipariş ver (50 adet önerilir)",
        createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
        isCompleted: true,
      },
      {
        id: "i4",
        type: "competitor_price_change",
        priority: 3,
        title: "🤖 Ajan: Rakip Fiyat Hareketi",
        description: "3 rakip ürünün fiyatını %8-12 arasında düşürdü",
        suggestedAction: "Oyun Teorisi analizi çalıştır — fiyat savaşına girme",
        createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
        isCompleted: false,
      },
    ]);
  }, []);

  const handleManualRun = async () => {
    setIsLoading(true);
    setRunResult(null);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 2000));
    setRunResult({
      success: true,
      duration: "1,247ms",
      tenantsProcessed: 1,
      results: [
        {
          tenantId: "demo",
          observations: {
            competitorPriceChanges: 2,
            buyboxLost: 0,
            lowStockAlerts: 1,
            competitorOutOfStock: 0,
            todayOrders: 36,
          },
          decisions: 2,
          actions: 2,
        },
      ],
    });
    setIsLoading(false);
  };

  const handleToggle = () => {
    setAgentStatus((prev: any) => ({
      ...prev,
      enabled: !prev?.enabled,
    }));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const urgencyColors: Record<number, string> = {
    1: "#ef4444",
    2: "#f59e0b",
    3: "#6366f1",
    4: "#64748b",
  };

  const urgencyLabels: Record<number, string> = {
    1: "KRİTİK",
    2: "YÜKSEK",
    3: "ORTA",
    4: "DÜŞÜK",
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title">🤖 Otonom Ajan</h1>
            <p className="page-subtitle">
              7/24 çalışan rakip takip ajanı — Gözlemle → Düşün → Karar Al →
              Uygula → Öğren
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Toggle Button */}
            <button
              onClick={handleToggle}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 20px",
                borderRadius: 24,
                border: "none",
                background: agentStatus?.enabled
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
                color: agentStatus?.enabled ? "#10b981" : "#ef4444",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: agentStatus?.enabled ? "#10b981" : "#ef4444",
                  animation: agentStatus?.enabled
                    ? "pulse-glow 2s infinite"
                    : "none",
                }}
              />
              {agentStatus?.enabled ? "AJAN AKTİF" : "AJAN KAPALI"}
            </button>

            {/* Manual Run */}
            <button
              onClick={handleManualRun}
              disabled={isLoading}
              className="btn btn-primary"
              style={{ opacity: isLoading ? 0.6 : 1 }}
            >
              {isLoading ? "⏳ Çalışıyor..." : "⚡ Manuel Çalıştır"}
            </button>
          </div>
        </div>
      </div>

      <div className="page-content animate-fade-in">
        {/* Agent Stats KPI Grid */}
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
            <div className="kpi-label">Durum</div>
            <div
              className="kpi-value"
              style={{
                fontSize: 22,
                color: agentStatus?.enabled ? "#10b981" : "#ef4444",
              }}
            >
              {agentStatus?.isRunning
                ? "⚙️ Çalışıyor..."
                : agentStatus?.enabled
                  ? "✅ Aktif"
                  : "⛔ Kapalı"}
            </div>
            <div className="kpi-source">
              Son çalışma: {agentStatus?.stats?.uptime}
            </div>
          </div>

          <div className="kpi-card" style={{ borderTop: "3px solid #6366f1" }}>
            <div className="kpi-label">Toplam Karar</div>
            <div className="kpi-value">
              {agentStatus?.stats?.totalDecisions || 0}
            </div>
            <div className="kpi-source">Ajan tarafından alınan kararlar</div>
          </div>

          <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
            <div className="kpi-label">Toplam Aksiyon</div>
            <div className="kpi-value">
              {agentStatus?.stats?.totalActions || 0}
            </div>
            <div className="kpi-source">Uygulanan aksiyonlar</div>
          </div>

          <div className="kpi-card" style={{ borderTop: "3px solid #22d3ee" }}>
            <div className="kpi-label">Döngü Aralığı</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>
              15 dk
            </div>
            <div className="kpi-source">Her 15 dakikada bir çalışır</div>
          </div>
        </div>

        {/* Manual Run Result */}
        {runResult && (
          <div
            className="card"
            style={{
              marginBottom: 24,
              border: "1px solid rgba(16, 185, 129, 0.3)",
              background:
                "linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.02))",
            }}
          >
            <div className="card-header">
              <div className="card-title" style={{ color: "#10b981" }}>
                ✅ Ajan Çalışması Tamamlandı
              </div>
              <span
                className="source-badge"
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                }}
              >
                {runResult.duration}
              </span>
            </div>
            {runResult.results?.map((r: any, idx: number) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 12,
                  padding: "12px 0",
                }}
              >
                {Object.entries(r.observations || {}).map(
                  ([key, val]: [string, any]) => (
                    <div
                      key={key}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        padding: 12,
                        borderRadius: 8,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: "var(--text-primary)",
                        }}
                      >
                        {val as any}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 4,
                        }}
                      >
                        {key.replace(/([A-Z])/g, " $1")}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        )}

        {/* Agent Insights + Activity Log */}
        <div className="grid-2">
          {/* Active Insights */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">🎯 Ajan Tespitleri</div>
                <div className="card-subtitle">
                  Otonom ajan tarafından oluşturulan aksiyonlar
                </div>
              </div>
              <span
                className="source-badge"
                style={{
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "#818cf8",
                }}
              >
                AGENT AI
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: insight.isCompleted
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${insight.isCompleted ? "var(--border-default)" : urgencyColors[insight.priority] + "33"}`,
                    opacity: insight.isCompleted ? 0.6 : 1,
                    position: "relative" as const,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {insight.title}
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 9,
                        fontWeight: 700,
                        background:
                          urgencyColors[insight.priority] + "20",
                        color: urgencyColors[insight.priority],
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {urgencyLabels[insight.priority]}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      marginBottom: 8,
                    }}
                  >
                    {insight.description}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#10b981",
                        fontWeight: 500,
                      }}
                    >
                      💡 {insight.suggestedAction}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                      }}
                    >
                      {formatTime(insight.createdAt)}
                    </div>
                  </div>
                  {insight.isCompleted && (
                    <div
                      style={{
                        position: "absolute" as const,
                        top: 12,
                        left: 12,
                        fontSize: 10,
                        color: "#10b981",
                        fontWeight: 600,
                      }}
                    >
                      ✓ Tamamlandı
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">📋 Ajan Aktivite Logu</div>
                <div className="card-subtitle">Son çalışma sonuçları</div>
              </div>
              <span
                className="source-badge"
                style={{
                  background: "rgba(34, 211, 238, 0.15)",
                  color: "#22d3ee",
                }}
              >
                LIVE
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {agentLog.map((log, idx) => (
                <div
                  key={log.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border-default)",
                    position: "relative" as const,
                  }}
                >
                  {/* Timeline dot */}
                  <div
                    style={{
                      position: "absolute" as const,
                      left: -8,
                      top: 20,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: idx === 0 ? "#10b981" : "#64748b",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      🤖 Ajan Döngüsü #{agentLog.length - idx}
                    </span>
                    <span
                      style={{ fontSize: 11, color: "var(--text-muted)" }}
                    >
                      {formatTime(log.timestamp)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                    }}
                  >
                    <div style={{ textAlign: "center" as const }}>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: "#f59e0b",
                        }}
                      >
                        {log.data?.observations?.competitorPriceChanges || 0}
                      </div>
                      <div
                        style={{ fontSize: 9, color: "var(--text-muted)" }}
                      >
                        Fiyat Değişimi
                      </div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: "#ef4444",
                        }}
                      >
                        {log.data?.observations?.buyboxLost || 0}
                      </div>
                      <div
                        style={{ fontSize: 9, color: "var(--text-muted)" }}
                      >
                        Buybox Kayıp
                      </div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: "#10b981",
                        }}
                      >
                        {log.data?.observations?.competitorOutOfStock || 0}
                      </div>
                      <div
                        style={{ fontSize: 9, color: "var(--text-muted)" }}
                      >
                        OOS Fırsat
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 12,
                      paddingTop: 8,
                      borderTop: "1px solid var(--border-default)",
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>
                      📊 {log.data?.decisionsCount || 0} karar
                    </span>
                    <span>
                      ⚡ {log.data?.actionsCount || 0} aksiyon
                    </span>
                    <span>
                      📦 {log.data?.observations?.todayOrders || 0}{" "}
                      sipariş
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Architecture Visual */}
        <div
          className="card"
          style={{
            marginTop: 24,
            background:
              "linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.03))",
            border: "1px solid rgba(99, 102, 241, 0.2)",
          }}
        >
          <div className="card-header">
            <div className="card-title">🧠 Ajan Mimarisi</div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              padding: "20px 0",
              flexWrap: "wrap" as const,
              gap: 12,
            }}
          >
            {[
              { emoji: "👁️", label: "GÖZLEMLE", desc: "Rakip fiyat, stok, buybox", color: "#22d3ee" },
              { emoji: "🧠", label: "DÜŞÜN", desc: "Groq AI ile analiz", color: "#6366f1" },
              { emoji: "⚖️", label: "KARAR AL", desc: "Aciliyet sıralama", color: "#f59e0b" },
              { emoji: "⚡", label: "UYGULA", desc: "Bildirim & insight", color: "#10b981" },
              { emoji: "📚", label: "ÖĞREN", desc: "Sonuçları kaydet", color: "#a78bfa" },
            ].map((phase, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    textAlign: "center" as const,
                    padding: "16px 20px",
                    borderRadius: 12,
                    background: `${phase.color}10`,
                    border: `1px solid ${phase.color}33`,
                    minWidth: 120,
                  }}
                >
                  <div style={{ fontSize: 28 }}>{phase.emoji}</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: phase.color,
                      marginTop: 4,
                    }}
                  >
                    {phase.label}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {phase.desc}
                  </div>
                </div>
                {idx < 4 && (
                  <div
                    style={{
                      fontSize: 18,
                      color: "var(--text-muted)",
                      fontWeight: 300,
                    }}
                  >
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

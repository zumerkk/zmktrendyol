"use client";

export default function SettingsPage() {
  const connections = [
    {
      name: "Trendyol API",
      status: "not_connected",
      desc: "Ürün, sipariş ve stok verileri",
      action: "Bağla",
    },
    {
      name: "OpenAI (GPT-4o)",
      status: "not_connected",
      desc: "AI asistan, yorum analizi, listing optimize",
      action: "API Key Gir",
    },
    {
      name: "Telegram Bot",
      status: "not_connected",
      desc: "Mobil bildirimler",
      action: "Bot Token Gir",
    },
    {
      name: "Google Gemini",
      status: "optional",
      desc: "Alternatif AI provider",
      action: "Opsiyonel",
    },
    {
      name: "Proxy Pool",
      status: "optional",
      desc: "Scraper IP rotasyonu",
      action: "Opsiyonel",
    },
  ];

  const statusMap: Record<string, { class: string; label: string }> = {
    connected: { class: "active", label: "✅ Bağlı" },
    not_connected: { class: "error", label: "❌ Bağlanmadı" },
    optional: { class: "inactive", label: "➖ Opsiyonel" },
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">⚙️ Ayarlar</h1>
        <p className="page-subtitle">
          API bağlantıları, bildirim ayarları ve sistem konfigürasyonu
        </p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="grid-2">
          {/* API Connections */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🔗 API Bağlantıları</div>
            </div>
            {connections.map((c, i) => {
              const st = statusMap[c.status] || {
                class: "inactive",
                label: c.status,
              };
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 0",
                    borderBottom:
                      i < connections.length - 1
                        ? "1px solid var(--border-default)"
                        : "none",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "var(--text-primary)",
                        marginBottom: 4,
                      }}
                    >
                      {c.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {c.desc}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <span className={`status-badge ${st.class}`}>
                      {st.label}
                    </span>
                    {c.status === "not_connected" && (
                      <button className="btn btn-primary btn-sm">
                        {c.action}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* System Info */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title">📊 Sistem Durumu</div>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {[
                  { label: "API Versiyonu", value: "v0.2.0" },
                  { label: "TypeScript Derleme", value: "✅ 0 hata" },
                  { label: "Toplam Servis", value: "34" },
                  { label: "API Endpoint", value: "45+" },
                  { label: "Veritabanı Model", value: "49" },
                  { label: "NestJS Modül", value: "15" },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      {item.label}
                    </span>
                    <span
                      style={{ fontWeight: 600, color: "var(--text-primary)" }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title">🔔 Bildirim Ayarları</div>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {[
                  { label: "WebSocket (Anlık)", enabled: true },
                  { label: "Telegram Bildirimleri", enabled: false },
                  { label: "Stok Kırılma Uyarısı", enabled: true },
                  { label: "Buybox Kaybı Uyarısı", enabled: true },
                  { label: "Günlük Özet Rapor", enabled: false },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      {item.label}
                    </span>
                    <div
                      style={{
                        width: 40,
                        height: 22,
                        borderRadius: 11,
                        cursor: "pointer",
                        background: item.enabled
                          ? "var(--accent-success)"
                          : "var(--bg-tertiary)",
                        position: "relative",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "white",
                          position: "absolute",
                          top: 3,
                          left: item.enabled ? 21 : 3,
                          transition: "left 0.2s",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">💳 Abonelik</div>
              </div>
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  Mevcut Plan
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--accent-primary-light)",
                  }}
                >
                  Pilot
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  30 gün ücretsiz deneme
                </div>
                <button className="btn btn-primary" style={{ marginTop: 16 }}>
                  Planlara Bak →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

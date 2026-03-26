"use client";

export default function AuditPage() {
  const logs = [
    {
      id: "1",
      time: "06.03.2026 08:12",
      user: "admin@zmk.com",
      action: "price_update",
      entity: "Kış Montu Premium XL",
      detail: "₺949 → ₺899",
      ip: "85.105.xxx.xxx",
    },
    {
      id: "2",
      time: "06.03.2026 07:58",
      user: "admin@zmk.com",
      action: "stock_update",
      entity: "Spor Ayakkabı Unisex",
      detail: "200 → 78",
      ip: "85.105.xxx.xxx",
    },
    {
      id: "3",
      time: "05.03.2026 22:30",
      user: "system",
      action: "buybox_alert",
      entity: "Kış Montu Premium XL",
      detail: "Buybox kaybı — rakip fiyat: ₺819",
      ip: "server",
    },
    {
      id: "4",
      time: "05.03.2026 19:15",
      user: "admin@zmk.com",
      action: "competitor_add",
      entity: "SporŞık Mağaza",
      detail: "15 ürün takipe alındı",
      ip: "85.105.xxx.xxx",
    },
    {
      id: "5",
      time: "05.03.2026 16:00",
      user: "system",
      action: "sync_complete",
      entity: "Sipariş Sync",
      detail: "147 yeni sipariş çekildi",
      ip: "server",
    },
    {
      id: "6",
      time: "05.03.2026 14:30",
      user: "admin@zmk.com",
      action: "login",
      entity: "Auth",
      detail: "Başarılı giriş",
      ip: "85.105.xxx.xxx",
    },
    {
      id: "7",
      time: "04.03.2026 23:00",
      user: "system",
      action: "stock_alert",
      entity: "Kadın Trençkot Bej",
      detail: "Stok kritik: 12 adet",
      ip: "server",
    },
    {
      id: "8",
      time: "04.03.2026 21:45",
      user: "system",
      action: "scrape_complete",
      entity: "Scraper",
      detail: "38 ürün tarandı",
      ip: "server",
    },
  ];

  const actionIcons: Record<string, string> = {
    price_update: "💰",
    stock_update: "📦",
    buybox_alert: "🚨",
    competitor_add: "⚔️",
    sync_complete: "🔄",
    login: "🔐",
    stock_alert: "⚠️",
    scrape_complete: "🕷️",
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">📋 Denetim İzleri</h1>
        <p className="page-subtitle">
          Tüm sistem aktiviteleri, kullanıcı işlemleri ve otomasyon kayıtları
        </p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Bugün İşlem</div>
            <div className="kpi-value">
              {logs.filter((l) => l.time.startsWith("06")).length}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Sistem Uyarısı</div>
            <div
              className="kpi-value"
              style={{ color: "var(--accent-warning)" }}
            >
              {logs.filter((l) => l.user === "system").length}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Kullanıcı İşlemi</div>
            <div className="kpi-value">
              {logs.filter((l) => l.user !== "system").length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">İşlem Geçmişi</div>
            <span className="source-badge api">API</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>İşlem</th>
                <th>Kullanıcı</th>
                <th>Hedef</th>
                <th>Detay</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {l.time}
                  </td>
                  <td>
                    <span style={{ fontSize: 14 }}>
                      {actionIcons[l.action] || "📝"}
                    </span>{" "}
                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                      {l.action}
                    </span>
                  </td>
                  <td
                    style={{
                      fontSize: 12,
                      color:
                        l.user === "system"
                          ? "var(--accent-secondary)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {l.user}
                  </td>
                  <td style={{ fontWeight: 500 }}>{l.entity}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {l.detail}
                  </td>
                  <td
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    {l.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

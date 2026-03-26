"use client";

export default function OrdersPage() {
  const orders = [
    {
      id: "TY-892341",
      date: "06.03.2026 08:12",
      customer: "A*** K***",
      items: 3,
      total: "₺1,549",
      status: "Created",
      city: "İstanbul",
    },
    {
      id: "TY-892340",
      date: "06.03.2026 07:58",
      customer: "M*** D***",
      items: 1,
      total: "₺1,247",
      status: "Picking",
      city: "Ankara",
    },
    {
      id: "TY-892339",
      date: "06.03.2026 07:45",
      customer: "E*** Y***",
      items: 2,
      total: "₺389",
      status: "Shipped",
      city: "İzmir",
    },
    {
      id: "TY-892338",
      date: "05.03.2026 22:32",
      customer: "S*** T***",
      items: 1,
      total: "₺2,150",
      status: "Delivered",
      city: "Bursa",
    },
    {
      id: "TY-892337",
      date: "05.03.2026 21:14",
      customer: "K*** M***",
      items: 4,
      total: "₺675",
      status: "Created",
      city: "Kırıkkale",
    },
    {
      id: "TY-892336",
      date: "05.03.2026 19:05",
      customer: "F*** S***",
      items: 2,
      total: "₺1,890",
      status: "Shipped",
      city: "Antalya",
    },
    {
      id: "TY-892335",
      date: "05.03.2026 16:28",
      customer: "H*** A***",
      items: 1,
      total: "₺449",
      status: "Delivered",
      city: "Konya",
    },
    {
      id: "TY-892334",
      date: "05.03.2026 14:55",
      customer: "Z*** E***",
      items: 3,
      total: "₺3,200",
      status: "Cancelled",
      city: "Trabzon",
    },
  ];

  const statusMap: Record<string, { class: string; emoji: string }> = {
    Created: { class: "pending", emoji: "🟡" },
    Picking: { class: "pending", emoji: "📦" },
    Shipped: { class: "active", emoji: "🚚" },
    Delivered: { class: "active", emoji: "✅" },
    Cancelled: { class: "error", emoji: "❌" },
  };

  const totalRevenue = 11549;
  const todayOrders = 3;
  const shippedRate = 62;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🛒 Sipariş Yönetimi</h1>
        <p className="page-subtitle">
          Tüm siparişlerinizi takip edin — durum, kargo ve teslimat bilgileri
        </p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Bugün Sipariş</div>
            <div className="kpi-value">{todayOrders}</div>
            <span className="kpi-change positive">↑ +2</span>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Haftalık Ciro</div>
            <div className="kpi-value">
              ₺{totalRevenue.toLocaleString("tr-TR")}
            </div>
            <span className="kpi-change positive">↑ +18.3%</span>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Kargolanma Oranı</div>
            <div className="kpi-value">%{shippedRate}</div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Bekleyen Sipariş</div>
            <div
              className="kpi-value"
              style={{ color: "var(--accent-warning)" }}
            >
              {
                orders.filter(
                  (o) => o.status === "Created" || o.status === "Picking",
                ).length
              }
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Sipariş Listesi</div>
            <span className="source-badge api">API</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Tarih</th>
                <th>Müşteri</th>
                <th>Şehir</th>
                <th>Ürün</th>
                <th>Tutar</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const st = statusMap[o.status] || {
                  class: "inactive",
                  emoji: "⚪",
                };
                return (
                  <tr key={o.id}>
                    <td
                      style={{
                        fontWeight: 700,
                        color: "var(--accent-primary-light)",
                        fontFamily: "monospace",
                      }}
                    >
                      {o.id}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {o.date}
                    </td>
                    <td>{o.customer}</td>
                    <td>{o.city}</td>
                    <td style={{ textAlign: "center" }}>{o.items}</td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: "var(--accent-success)",
                      }}
                    >
                      {o.total}
                    </td>
                    <td>
                      <span className={`status-badge ${st.class}`}>
                        {st.emoji} {o.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

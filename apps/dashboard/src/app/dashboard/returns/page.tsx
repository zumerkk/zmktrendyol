"use client";

export default function ReturnsPage() {
  const returns = [
    {
      id: "RT-4521",
      orderId: "TY-891200",
      product: "Kış Montu Premium XL",
      reason: "Beden uymadı",
      amount: "₺899",
      date: "05.03.2026",
      status: "Pending",
    },
    {
      id: "RT-4520",
      orderId: "TY-890980",
      product: "Spor Ayakkabı Unisex",
      reason: "Renk farklı",
      amount: "₺549",
      date: "04.03.2026",
      status: "Approved",
    },
    {
      id: "RT-4519",
      orderId: "TY-890501",
      product: "Kadın Çanta Deri",
      reason: "Hasarlı geldi",
      amount: "₺1,850",
      date: "04.03.2026",
      status: "Refunded",
    },
    {
      id: "RT-4518",
      orderId: "TY-889750",
      product: "Erkek Gömlek Slim Fit",
      reason: "Beden uymadı",
      amount: "₺349",
      date: "03.03.2026",
      status: "Rejected",
    },
    {
      id: "RT-4517",
      orderId: "TY-889340",
      product: "Çocuk Eşofman Takımı",
      reason: "Vazgeçtim",
      amount: "₺279",
      date: "02.03.2026",
      status: "Refunded",
    },
  ];

  const statusMap: Record<string, { class: string; label: string }> = {
    Pending: { class: "pending", label: "⏳ Bekliyor" },
    Approved: { class: "active", label: "✅ Onaylandı" },
    Refunded: { class: "active", label: "💰 İade Edildi" },
    Rejected: { class: "error", label: "❌ Reddedildi" },
  };

  const reasonStats = [
    { reason: "Beden uymadı", count: 42, pct: 38 },
    { reason: "Renk farklı", count: 22, pct: 20 },
    { reason: "Hasarlı geldi", count: 18, pct: 16 },
    { reason: "Vazgeçtim", count: 15, pct: 14 },
    { reason: "Diğer", count: 13, pct: 12 },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🔄 İade Yönetimi</h1>
        <p className="page-subtitle">
          İade takibi, sebep analizi ve süreç yönetimi
        </p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Aylık İade Oranı</div>
            <div className="kpi-value">%3.2</div>
            <span className="kpi-change positive">↓ -0.5%</span>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Bekleyen İade</div>
            <div
              className="kpi-value"
              style={{ color: "var(--accent-warning)" }}
            >
              1
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Bu Ay İade Tutarı</div>
            <div
              className="kpi-value"
              style={{ color: "var(--accent-danger)" }}
            >
              ₺3,926
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Returns Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Son İadeler</div>
              <span className="source-badge api">API</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>İade No</th>
                  <th>Ürün</th>
                  <th>Sebep</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => {
                  const st = statusMap[r.status] || {
                    class: "inactive",
                    label: r.status,
                  };
                  return (
                    <tr key={r.id}>
                      <td
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {r.id}
                      </td>
                      <td style={{ fontWeight: 500 }}>{r.product}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {r.reason}
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: "var(--accent-danger)",
                        }}
                      >
                        {r.amount}
                      </td>
                      <td>
                        <span className={`status-badge ${st.class}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Reason Analysis */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">İade Sebep Analizi</div>
              <span className="source-badge estimate">ESTIMATE</span>
            </div>
            {reasonStats.map((r) => (
              <div key={r.reason} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {r.reason}
                  </span>
                  <span
                    style={{ fontWeight: 700, color: "var(--text-primary)" }}
                  >
                    %{r.pct}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "var(--bg-tertiary)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${r.pct}%`,
                      height: "100%",
                      borderRadius: 3,
                      background:
                        r.pct > 30
                          ? "var(--accent-danger)"
                          : r.pct > 15
                            ? "var(--accent-warning)"
                            : "var(--accent-primary)",
                    }}
                  />
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: 20,
                padding: 12,
                borderRadius: 8,
                background: "rgba(99, 102, 241, 0.08)",
                border: "1px solid var(--border-accent)",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              💡{" "}
              <strong style={{ color: "var(--accent-primary-light)" }}>
                AI Önerisi:
              </strong>{" "}
              Beden tablosunu ürün açıklamalarına eklemek iade oranını %15
              düşürebilir.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

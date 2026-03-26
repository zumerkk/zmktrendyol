"use client";

export default function CompetitorsPage() {
  const competitors = [
    {
      name: "ModaHane Store",
      products: 12,
      avgPrice: "₺649",
      buyboxWin: 67,
      priceGap: "-₺25",
      status: "tracking",
      lastCheck: "2dk önce",
    },
    {
      name: "TürkGiyim Official",
      products: 8,
      avgPrice: "₺720",
      buyboxWin: 45,
      priceGap: "+₺50",
      status: "tracking",
      lastCheck: "5dk önce",
    },
    {
      name: "SporŞık Mağaza",
      products: 15,
      avgPrice: "₺399",
      buyboxWin: 82,
      priceGap: "-₺80",
      status: "alert",
      lastCheck: "1dk önce",
    },
    {
      name: "ElegantWear TR",
      products: 6,
      avgPrice: "₺1,150",
      buyboxWin: 33,
      priceGap: "+₺120",
      status: "tracking",
      lastCheck: "8dk önce",
    },
    {
      name: "FashionPeak",
      products: 20,
      avgPrice: "₺510",
      buyboxWin: 71,
      priceGap: "-₺15",
      status: "alert",
      lastCheck: "3dk önce",
    },
  ];

  const buyboxAlerts = [
    {
      product: "Kış Montu Premium XL",
      competitor: "SporŞık Mağaza",
      theirPrice: "₺819",
      yourPrice: "₺899",
      diff: "-₺80",
      time: "3dk önce",
    },
    {
      product: "Spor Ayakkabı Unisex",
      competitor: "FashionPeak",
      theirPrice: "₺534",
      yourPrice: "₺549",
      diff: "-₺15",
      time: "5dk önce",
    },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">⚔️ Rakip İzleme</h1>
        <p className="page-subtitle">
          Rakip fiyatları, buybox durumu ve dinamik fiyatlama aksiyonları
        </p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Takip Edilen Rakip</div>
            <div className="kpi-value">{competitors.length}</div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge public">PUBLIC</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">İzlenen Ürün</div>
            <div className="kpi-value">
              {competitors.reduce((s, c) => s + c.products, 0)}
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge public">PUBLIC</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Buybox Uyarısı</div>
            <div
              className="kpi-value"
              style={{ color: "var(--accent-danger)" }}
            >
              {buyboxAlerts.length}
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge estimate">ESTIMATE</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ort. Buybox Kazanma</div>
            <div className="kpi-value">
              %
              {Math.round(
                competitors.reduce((s, c) => s + c.buyboxWin, 0) /
                  competitors.length,
              )}
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge estimate">ESTIMATE</span>
            </div>
          </div>
        </div>

        {/* Buybox Alerts */}
        {buyboxAlerts.length > 0 && (
          <div
            className="card"
            style={{ marginBottom: 24, borderColor: "rgba(239, 68, 68, 0.3)" }}
          >
            <div className="card-header">
              <div className="card-title">🚨 Buybox Uyarıları</div>
              <span className="status-badge error">ACİL</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Rakip</th>
                  <th>Onların Fiyatı</th>
                  <th>Sizin Fiyatınız</th>
                  <th>Fark</th>
                  <th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {buyboxAlerts.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{a.product}</td>
                    <td style={{ color: "var(--accent-danger)" }}>
                      {a.competitor}
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: "var(--accent-success)",
                      }}
                    >
                      {a.theirPrice}
                    </td>
                    <td style={{ fontWeight: 700 }}>{a.yourPrice}</td>
                    <td
                      style={{ fontWeight: 700, color: "var(--accent-danger)" }}
                    >
                      {a.diff}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {a.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Competitor Table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Rakip Listesi</div>
            <span className="source-badge public">PUBLIC</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Mağaza</th>
                <th>İzlenen Ürün</th>
                <th>Ort. Fiyat</th>
                <th>Buybox Kazanma</th>
                <th>Fiyat Farkı</th>
                <th>Son Kontrol</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    {c.name}
                  </td>
                  <td>{c.products}</td>
                  <td style={{ fontWeight: 600 }}>{c.avgPrice}</td>
                  <td>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          background: "var(--bg-tertiary)",
                          maxWidth: 60,
                        }}
                      >
                        <div
                          style={{
                            width: `${c.buyboxWin}%`,
                            height: "100%",
                            borderRadius: 2,
                            background:
                              c.buyboxWin > 60
                                ? "var(--accent-danger)"
                                : "var(--accent-success)",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        %{c.buyboxWin}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: c.priceGap.startsWith("-")
                        ? "var(--accent-danger)"
                        : "var(--accent-success)",
                    }}
                  >
                    {c.priceGap}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {c.lastCheck}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${c.status === "alert" ? "error" : "active"}`}
                    >
                      {c.status === "alert" ? "⚠️ Uyarı" : "✅ Takip"}
                    </span>
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

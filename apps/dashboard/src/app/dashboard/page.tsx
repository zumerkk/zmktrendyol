"use client";

export default function DashboardPage() {
  // Demo data — in production, fetched from API
  const kpis = [
    {
      label: "Aylık Ciro",
      value: "₺284,750",
      change: "+12.4%",
      positive: true,
      source: "api",
    },
    {
      label: "Gerçek Net Kâr",
      value: "₺42,150",
      change: "+5.2%",
      positive: true,
      source: "zmk-engine",
    },
    {
      label: "Sipariş Sayısı",
      value: "1,247",
      change: "+8.2%",
      positive: true,
      source: "api",
    },
    {
      label: "Net Kâr Marjı",
      value: "%14.8",
      change: "-1.1%",
      positive: false,
      source: "zmk-engine",
    },
    {
      label: "İade Oranı",
      value: "%3.2",
      change: "-0.5%",
      positive: true,
      source: "api",
    },
    {
      label: "Zarar Eden SKU",
      value: "8 Ürün",
      change: "Müdahale Gerekli",
      positive: false,
      source: "zmk-engine",
      urgent: true,
    },
    {
      label: "Rakip İzleme",
      value: "38 ürün",
      change: "",
      positive: true,
      source: "public",
    },
  ];

  const topProducts = [
    {
      rank: 1,
      name: "Kış Montu Premium XL",
      sku: "KM-001",
      units: 342,
      revenue: "₺68,400",
      netProfit: "₺12,500",
      margin: "%18",
      health: "Mükemmel",
    },
    {
      rank: 2,
      name: "Spor Ayakkabı Unisex",
      sku: "SA-045",
      units: 287,
      revenue: "₺43,050",
      netProfit: "₺6,880",
      margin: "%16",
      health: "İyi",
    },
    {
      rank: 3,
      name: "Kadın Trençkot Bej",
      sku: "KT-012",
      units: 198,
      revenue: "₺39,600",
      netProfit: "₺8,316",
      margin: "%21",
      health: "Mükemmel",
    },
    {
      rank: 4,
      name: "Erkek Gömlek Slim Fit",
      sku: "EG-089",
      units: 176,
      revenue: "₺21,120",
      netProfit: "₺2,112",
      margin: "%10",
      health: "Orta",
    },
    {
      rank: 5,
      name: "Çocuk Eşofman Takımı",
      sku: "CE-023",
      units: 154,
      revenue: "₺15,400",
      netProfit: "₺1,848",
      margin: "%12",
      health: "İyi",
    },
  ];

  const karsizKahramanlar = [
    {
      sku: "KB-034",
      name: "Kadın Bot Süet",
      units: 203,
      revenue: "₺162,197",
      netProfit: "-₺3,240",
      margin: "-%2",
      reason: "Yüksek İade + Reklam Maliyeti",
      action: "Reklamı Kapat / Fiyat Artır",
    },
    {
      sku: "CE-112",
      name: "Çocuk Panduf",
      units: 145,
      revenue: "₺21,750",
      netProfit: "-₺850",
      margin: "-%4",
      reason: "Kargo Maliyeti Kurtarmıyor",
      action: "Bundle Yap / Fiyat Artır",
    },
  ];

  const recentOrders = [
    {
      id: "TY-892341",
      date: "03.03.2026 08:12",
      customer: "A***",
      status: "Created",
      amount: "₺549",
    },
    {
      id: "TY-892340",
      date: "03.03.2026 07:58",
      customer: "M***",
      status: "Picking",
      amount: "₺1,247",
    },
    {
      id: "TY-892339",
      date: "03.03.2026 07:45",
      customer: "E***",
      status: "Shipped",
      amount: "₺389",
    },
    {
      id: "TY-892338",
      date: "03.03.2026 07:32",
      customer: "S***",
      status: "Delivered",
      amount: "₺2,150",
    },
    {
      id: "TY-892337",
      date: "03.03.2026 07:14",
      customer: "K***",
      status: "Created",
      amount: "₺675",
    },
  ];

  const statusColors: Record<string, string> = {
    Created: "pending",
    Picking: "active",
    Shipped: "active",
    Delivered: "active",
    Cancelled: "error",
  };

  // Mini chart data (sparkline simulation)
  const chartPoints = [42, 55, 48, 72, 65, 80, 75, 92, 85, 110, 98, 125];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">📊 KPI Merkezi</h1>
        <p className="page-subtitle">
          Mağazanızın temel performans metrikleri — Son 30 gün
        </p>
      </div>

      <div className="page-content animate-fade-in">
        {/* KPI Grid */}
        <div className="kpi-grid">
          {kpis.map((kpi, i) => (
            <div key={i} className="kpi-card">
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value">{kpi.value}</div>
              {kpi.change && (
                <span
                  className={`kpi-change ${kpi.urgent ? "urgent" : kpi.positive ? "positive" : "negative"}`}
                  style={
                    kpi.urgent ? { color: "#ef4444", fontWeight: "bold" } : {}
                  }
                >
                  {kpi.urgent ? "🚨" : kpi.positive ? "↑" : "↓"} {kpi.change}
                </span>
              )}
              <div className="kpi-source">
                Kaynak:{" "}
                <span className={`source-badge ${kpi.source}`}>
                  {kpi.source}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="chart-container">
            <div className="card-header">
              <div>
                <div className="card-title">📈 Aylık Satış Trendi</div>
                <div className="card-subtitle">Son 12 ay — Kaynak: API</div>
              </div>
              <span className="source-badge api">API</span>
            </div>
            {/* SVG Chart */}
            <svg viewBox="0 0 400 120" style={{ width: "100%", height: 120 }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Area */}
              <path
                d={`M0,${110 - chartPoints[0]} ${chartPoints.map((p, i) => `L${(i / (chartPoints.length - 1)) * 400},${110 - p}`).join(" ")} L400,110 L0,110 Z`}
                fill="url(#chartGrad)"
              />
              {/* Line */}
              <polyline
                points={chartPoints
                  .map(
                    (p, i) =>
                      `${(i / (chartPoints.length - 1)) * 400},${110 - p}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dots */}
              {chartPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={(i / (chartPoints.length - 1)) * 400}
                  cy={110 - p}
                  r="3"
                  fill="#6366f1"
                  stroke="#0a0e1a"
                  strokeWidth="2"
                />
              ))}
            </svg>
          </div>

          <div className="chart-container">
            <div className="card-header">
              <div>
                <div className="card-title">⏰ Sipariş Isı Haritası</div>
                <div className="card-subtitle">
                  Gün × Saat bazlı sipariş yoğunluğu
                </div>
              </div>
              <span className="source-badge api">API</span>
            </div>
            {/* Heatmap Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto repeat(24, 1fr)",
                gap: 2,
                fontSize: 9,
              }}
            >
              <div></div>
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  style={{ textAlign: "center", color: "var(--text-muted)" }}
                >
                  {h}
                </div>
              ))}
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => (
                <>
                  <div
                    key={day}
                    style={{
                      paddingRight: 6,
                      color: "var(--text-muted)",
                      fontWeight: 500,
                    }}
                  >
                    {day}
                  </div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const val = Math.random();
                    const opacity =
                      val < 0.3 ? 0.1 : val < 0.6 ? 0.3 : val < 0.8 ? 0.5 : 0.8;
                    return (
                      <div
                        key={`${day}-${h}`}
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          borderRadius: 2,
                          background: `rgba(99, 102, 241, ${opacity})`,
                        }}
                      />
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>

        {/* Top Products + Recent Orders */}
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">🏆 En Çok Satan Ürünler</div>
              <span className="source-badge api">API</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ürün</th>
                  <th>Ciro</th>
                  <th>Net Kâr</th>
                  <th>Marj</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.rank}>
                    <td
                      style={{
                        color: "var(--accent-primary-light)",
                        fontWeight: 700,
                      }}
                    >
                      {p.rank}
                    </td>
                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {p.sku} | {p.units} Adet
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.revenue}</td>
                    <td
                      style={{
                        color: "var(--accent-success)",
                        fontWeight: "bold",
                      }}
                    >
                      {p.netProfit}
                    </td>
                    <td>
                      <span className="status-badge active">{p.margin}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="card"
            style={{ border: "1px solid var(--accent-danger)" }}
          >
            <div className="card-header">
              <div>
                <div className="card-title" style={{ color: "#ef4444" }}>
                  🚨 Kârsız Kahramanlar
                </div>
                <div className="card-subtitle">
                  Çok satan ama para kaybettiren ürünler
                </div>
              </div>
              <span
                className="source-badge zmk-engine"
                style={{
                  background: "rgba(239, 68, 68, 0.2)",
                  color: "#ef4444",
                }}
              >
                ZMK ENGINE
              </span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Ciro</th>
                  <th>Net Zarar</th>
                  <th>Kök Neden & Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {karsizKahramanlar.map((o) => (
                  <tr key={o.sku}>
                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {o.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {o.sku} | {o.units} satıldı
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{o.revenue}</td>
                    <td style={{ color: "#ef4444", fontWeight: "bold" }}>
                      {o.netProfit}{" "}
                      <span style={{ fontSize: 10, color: "#ef4444" }}>
                        ({o.margin})
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginBottom: 4,
                        }}
                      >
                        📌 {o.reason}
                      </div>
                      <button
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          color: "#ef4444",
                          border: "1px solid rgba(239,68,68,0.3)",
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        ⚡ {o.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

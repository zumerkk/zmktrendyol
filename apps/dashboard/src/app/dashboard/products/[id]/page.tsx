"use client";

export default function ProductDetailPage() {
  // Demo product data — in production, fetched from API by product ID
  const product = {
    id: "KM-001",
    title: "Kış Montu Premium XL — Su Geçirmez Erkek Mont",
    brand: "ZMK Collection",
    barcode: "8690123456789",
    category: "Erkek > Dış Giyim > Mont",
    listPrice: 1299,
    salePrice: 899,
    stock: 47,
    status: "active",
    approved: true,
    imageUrl: "https://via.placeholder.com/400x400/1a2236/6366f1?text=KM-001",
  };

  // 6-month price history
  const priceHistory = [
    { date: "Eyl 2025", listPrice: 1299, salePrice: 999 },
    { date: "Eki 2025", listPrice: 1299, salePrice: 949 },
    { date: "Kas 2025", listPrice: 1499, salePrice: 1199 },
    { date: "Ara 2025", listPrice: 1499, salePrice: 899 },
    { date: "Oca 2026", listPrice: 1299, salePrice: 799 },
    { date: "Şub 2026", listPrice: 1299, salePrice: 849 },
    { date: "Mar 2026", listPrice: 1299, salePrice: 899 },
  ];

  // KPIs
  const productKPIs = {
    last30: { units: 142, revenue: 127658, returnRate: 3.2, avgSalePrice: 899 },
    stockDays: 9.8,
    priceExtremes: { highest: 1199, lowest: 799, changeCount: 7 },
  };

  // Competitor signals
  const competitors = [
    {
      name: "Rakip A — Benzer Mont",
      price: 949,
      rating: 4.1,
      reviews: 847,
      inStock: true,
      source: "public" as const,
    },
    {
      name: "Rakip B — Premium Mont",
      price: 1149,
      rating: 4.5,
      reviews: 1243,
      inStock: true,
      source: "public" as const,
    },
    {
      name: "Rakip C — Ekonomik Mont",
      price: 649,
      rating: 3.8,
      reviews: 2156,
      inStock: false,
      source: "public" as const,
    },
  ];

  const maxPrice = Math.max(...priceHistory.map((p) => p.listPrice));
  const chartHeight = 160;
  const chartWidth = 400;

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="/dashboard/products"
            style={{ color: "var(--text-muted)", fontSize: 13 }}
          >
            ← Ürünler
          </a>
          <h1 className="page-title">🧠 Ürün Detay Zeka Paneli</h1>
        </div>
        <p className="page-subtitle">{product.title}</p>
      </div>

      <div className="page-content animate-fade-in">
        {/* Product Header */}
        <div
          className="card"
          style={{ marginBottom: 24, display: "flex", gap: 24 }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "var(--radius-md)",
              background: "var(--gradient-card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              flexShrink: 0,
            }}
          >
            📦
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {product.title}
            </h2>
            <div
              style={{
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              <span>🏷️ {product.brand}</span>
              <span>📂 {product.category}</span>
              <span>🔖 SKU: {product.id}</span>
              <span>📊 Barkod: {product.barcode}</span>
              <span className="status-badge active">✅ Onaylı & Satışta</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Liste Fiyat
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    textDecoration: "line-through",
                    color: "var(--text-muted)",
                  }}
                >
                  ₺{product.listPrice}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Satış Fiyat
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--accent-success)",
                  }}
                >
                  ₺{product.salePrice}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Stok
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color:
                      product.stock < 20
                        ? "var(--accent-warning)"
                        : "var(--text-primary)",
                  }}
                >
                  {product.stock} ad.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intel Panel: Main + Sidebar */}
        <div className="intel-panel">
          <div className="intel-main">
            {/* 6-Month Price Graph */}
            <div className="chart-container">
              <div className="card-header">
                <div>
                  <div className="card-title">📈 6 Aylık Fiyat Grafiği</div>
                  <div className="card-subtitle">
                    En Yüksek:{" "}
                    <span
                      style={{ color: "var(--accent-danger)", fontWeight: 700 }}
                    >
                      ₺{productKPIs.priceExtremes.highest}
                    </span>
                    {" · "}
                    En Düşük:{" "}
                    <span
                      style={{
                        color: "var(--accent-success)",
                        fontWeight: 700,
                      }}
                    >
                      ₺{productKPIs.priceExtremes.lowest}
                    </span>
                    {" · "}
                    Değişim:{" "}
                    <span style={{ fontWeight: 700 }}>
                      {productKPIs.priceExtremes.changeCount}×
                    </span>
                  </div>
                </div>
                <span className="source-badge api">API</span>
              </div>
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                style={{ width: "100%", height: chartHeight }}
              >
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="listGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                  <line
                    key={ratio}
                    x1="0"
                    y1={ratio * chartHeight}
                    x2={chartWidth}
                    y2={ratio * chartHeight}
                    stroke="rgba(255,255,255,0.04)"
                    strokeDasharray="4"
                  />
                ))}
                {/* List Price line */}
                <polyline
                  points={priceHistory
                    .map(
                      (p, i) =>
                        `${(i / (priceHistory.length - 1)) * chartWidth},${chartHeight - (p.listPrice / maxPrice) * (chartHeight - 20)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeDasharray="6"
                  opacity="0.5"
                />
                {/* Sale Price area */}
                <path
                  d={`M0,${chartHeight - (priceHistory[0].salePrice / maxPrice) * (chartHeight - 20)} ${priceHistory
                    .map(
                      (p, i) =>
                        `L${(i / (priceHistory.length - 1)) * chartWidth},${chartHeight - (p.salePrice / maxPrice) * (chartHeight - 20)}`,
                    )
                    .join(
                      " ",
                    )} L${chartWidth},${chartHeight} L0,${chartHeight} Z`}
                  fill="url(#priceGrad)"
                />
                {/* Sale Price line */}
                <polyline
                  points={priceHistory
                    .map(
                      (p, i) =>
                        `${(i / (priceHistory.length - 1)) * chartWidth},${chartHeight - (p.salePrice / maxPrice) * (chartHeight - 20)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {priceHistory.map((p, i) => (
                  <g key={i}>
                    <circle
                      cx={(i / (priceHistory.length - 1)) * chartWidth}
                      cy={
                        chartHeight -
                        (p.salePrice / maxPrice) * (chartHeight - 20)
                      }
                      r="4"
                      fill="#22d3ee"
                      stroke="#0a0e1a"
                      strokeWidth="2"
                    />
                    <text
                      x={(i / (priceHistory.length - 1)) * chartWidth}
                      y={
                        chartHeight -
                        (p.salePrice / maxPrice) * (chartHeight - 20) -
                        10
                      }
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--text-muted)"
                    >
                      ₺{p.salePrice}
                    </text>
                  </g>
                ))}
                {/* X labels */}
                {priceHistory.map((p, i) => (
                  <text
                    key={`lbl-${i}`}
                    x={(i / (priceHistory.length - 1)) * chartWidth}
                    y={chartHeight - 2}
                    textAnchor="middle"
                    fontSize="9"
                    fill="var(--text-muted)"
                  >
                    {p.date}
                  </text>
                ))}
              </svg>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 12,
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      width: 16,
                      height: 2,
                      background: "#22d3ee",
                      borderRadius: 1,
                    }}
                  ></span>
                  Satış Fiyatı
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      width: 16,
                      height: 2,
                      background: "#6366f1",
                      borderRadius: 1,
                      opacity: 0.5,
                    }}
                  ></span>
                  Liste Fiyatı
                </span>
              </div>
            </div>

            {/* Sales Performance */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">📊 Son 30 Gün Performansı</div>
                <span className="source-badge api">API</span>
              </div>
              <div className="kpi-grid" style={{ marginBottom: 0 }}>
                <div className="kpi-card">
                  <div className="kpi-label">Satış Adedi</div>
                  <div className="kpi-value">{productKPIs.last30.units}</div>
                  <div className="kpi-source">
                    Kaynak: <span className="source-badge api">api</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Ciro</div>
                  <div className="kpi-value">
                    ₺{productKPIs.last30.revenue.toLocaleString()}
                  </div>
                  <div className="kpi-source">
                    Kaynak: <span className="source-badge api">api</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">İade Oranı</div>
                  <div className="kpi-value">
                    %{productKPIs.last30.returnRate}
                  </div>
                  <div className="kpi-source">
                    Kaynak: <span className="source-badge api">api</span>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Stok Kırılma</div>
                  <div
                    className="kpi-value"
                    style={{
                      color:
                        productKPIs.stockDays < 14
                          ? "var(--accent-warning)"
                          : "var(--text-primary)",
                    }}
                  >
                    {productKPIs.stockDays} gün
                  </div>
                  <div className="kpi-source">
                    Kaynak: <span className="source-badge api">api</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Competitor Signals */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">🔍 Rakip Sinyalleri</div>
                  <div className="card-subtitle">
                    ⚠️ Bu veriler kamuya açık sinyallerdir. Kesin satış verisi
                    değildir.
                  </div>
                </div>
                <span className="source-badge public">PUBLIC</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rakip</th>
                    <th>Fiyat</th>
                    <th>Puan</th>
                    <th>Yorum</th>
                    <th>Stok</th>
                    <th>Kaynak</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((c, i) => (
                    <tr key={i}>
                      <td
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {c.name}
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color:
                            c.price < product.salePrice
                              ? "var(--accent-danger)"
                              : "var(--accent-success)",
                        }}
                      >
                        ₺{c.price}
                      </td>
                      <td>⭐ {c.rating}</td>
                      <td>{c.reviews.toLocaleString()}</td>
                      <td>
                        <span
                          className={`status-badge ${c.inStock ? "active" : "error"}`}
                        >
                          {c.inStock ? "✅ Var" : "❌ Yok"}
                        </span>
                      </td>
                      <td>
                        <span className={`source-badge ${c.source}`}>
                          {c.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar — Actions & Quick Info */}
          <div className="intel-sidebar">
            {/* AI Actions */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>
                🤖 AI Aksiyonlar
              </div>
              <div className="intel-action-grid">
                <button className="intel-action-btn">
                  <span className="icon">💰</span>
                  Fiyat Öner
                </button>
                <button className="intel-action-btn">
                  <span className="icon">📦</span>
                  Stok Güncelle
                </button>
                <button className="intel-action-btn">
                  <span className="icon">✍️</span>
                  AI Açıklama
                </button>
                <button className="intel-action-btn">
                  <span className="icon">📢</span>
                  Kampanya
                </button>
                <button className="intel-action-btn">
                  <span className="icon">🔤</span>
                  Başlık Öner
                </button>
                <button className="intel-action-btn">
                  <span className="icon">💬</span>
                  Mesaj Yanıtla
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>
                📋 Hızlı Bilgiler
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {[
                  { label: "Kategori Sırası", value: "#12", icon: "📊" },
                  {
                    label: "Son Fiyat Değişikliği",
                    value: "2 gün önce",
                    icon: "🕐",
                  },
                  { label: "Değiştiren", value: "admin@zmk.com", icon: "👤" },
                  { label: "İlk Yayın", value: "15.08.2025", icon: "📅" },
                  { label: "Toplam Satış", value: "2,847 adet", icon: "🛒" },
                  { label: "Ortalama Puan", value: "4.6 ⭐", icon: "⭐" },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-glass)",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      {item.icon} {item.label}
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

            {/* Stok Kırılma Alert */}
            <div
              className="card"
              style={{
                borderColor: "rgba(245, 158, 11, 0.3)",
                background: "rgba(245, 158, 11, 0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div
                  className="card-title"
                  style={{ color: "var(--accent-warning)" }}
                >
                  Stok Uyarısı
                </div>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                Mevcut satış hızına göre stok{" "}
                <strong style={{ color: "var(--accent-warning)" }}>
                  ~10 gün
                </strong>{" "}
                içinde tükenecek. Stok yenileme önerilir.
              </p>
              <button
                className="btn btn-sm"
                style={{
                  marginTop: 12,
                  background: "rgba(245,158,11,0.15)",
                  color: "var(--accent-warning)",
                  border: "1px solid rgba(245,158,11,0.3)",
                }}
              >
                Stok Güncelle
              </button>
            </div>

            {/* Audit Trail Snippet */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>
                📝 Son Değişiklikler
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 11,
                }}
              >
                {[
                  {
                    action: "Fiyat güncellendi",
                    user: "admin",
                    time: "2s önce",
                    detail: "₺849 → ₺899",
                  },
                  {
                    action: "Stok güncellendi",
                    user: "admin",
                    time: "1g önce",
                    detail: "65 → 47",
                  },
                  {
                    action: "Açıklama değiştirildi",
                    user: "editor",
                    time: "3g önce",
                    detail: "AI optimizasyonu",
                  },
                ].map((log, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: "3px solid var(--accent-primary)",
                      background: "var(--bg-glass)",
                    }}
                  >
                    <div
                      style={{ fontWeight: 600, color: "var(--text-primary)" }}
                    >
                      {log.action}
                    </div>
                    <div
                      style={{
                        color: "var(--text-muted)",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>👤 {log.user}</span>
                      <span>{log.time}</span>
                    </div>
                    <div
                      style={{ color: "var(--accent-secondary)", marginTop: 2 }}
                    >
                      {log.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

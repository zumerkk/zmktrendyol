"use client";

export default function ProductsPage() {
  const products = [
    {
      id: "p1",
      sku: "KM-001",
      title: "Kış Montu Premium XL",
      price: "₺899",
      stock: 245,
      status: "active",
      sales30d: 342,
      category: "Giyim",
      rating: 4.6,
    },
    {
      id: "p2",
      sku: "SA-045",
      title: "Spor Ayakkabı Unisex",
      price: "₺549",
      stock: 78,
      status: "active",
      sales30d: 287,
      category: "Ayakkabı",
      rating: 4.3,
    },
    {
      id: "p3",
      sku: "KT-012",
      title: "Kadın Trençkot Bej",
      price: "₺1,249",
      stock: 12,
      status: "active",
      sales30d: 198,
      category: "Giyim",
      rating: 4.8,
    },
    {
      id: "p4",
      sku: "EG-089",
      title: "Erkek Gömlek Slim Fit",
      price: "₺349",
      stock: 432,
      status: "active",
      sales30d: 176,
      category: "Giyim",
      rating: 4.1,
    },
    {
      id: "p5",
      sku: "CE-023",
      title: "Çocuk Eşofman Takımı",
      price: "₺279",
      stock: 0,
      status: "inactive",
      sales30d: 154,
      category: "Çocuk",
      rating: 3.9,
    },
    {
      id: "p6",
      sku: "KÇ-077",
      title: "Kadın Çanta Deri",
      price: "₺1,850",
      stock: 34,
      status: "active",
      sales30d: 89,
      category: "Aksesuar",
      rating: 4.7,
    },
    {
      id: "p7",
      sku: "EK-112",
      title: "Erkek Kaban Uzun",
      price: "₺1,599",
      stock: 5,
      status: "active",
      sales30d: 67,
      category: "Giyim",
      rating: 4.5,
    },
    {
      id: "p8",
      sku: "KB-034",
      title: "Kadın Bot Süet",
      price: "₺799",
      stock: 156,
      status: "active",
      sales30d: 203,
      category: "Ayakkabı",
      rating: 4.4,
    },
  ];

  const stockStatus = (stock: number) => {
    if (stock === 0) return { label: "Tükendi", class: "error" };
    if (stock < 20) return { label: "Kritik", class: "error" };
    if (stock < 50) return { label: "Düşük", class: "pending" };
    return { label: "Yeterli", class: "active" };
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">📦 Ürün Yönetimi</h1>
        <p className="page-subtitle">
          Tüm ürünlerinizi takip edin, stok ve fiyat bilgilerini görüntüleyin
        </p>
      </div>

      <div className="page-content animate-fade-in">
        {/* Summary KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Toplam Ürün</div>
            <div className="kpi-value">{products.length}</div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Aktif Ürün</div>
            <div className="kpi-value">
              {products.filter((p) => p.status === "active").length}
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Stok Kırılma Riski</div>
            <div
              className="kpi-value"
              style={{ color: "var(--accent-danger)" }}
            >
              {products.filter((p) => p.stock < 20).length}
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge estimate">ESTIMATE</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">30 Gün Toplam Satış</div>
            <div className="kpi-value">
              {products
                .reduce((s, p) => s + p.sales30d, 0)
                .toLocaleString("tr-TR")}
            </div>
            <div className="kpi-source">
              Kaynak: <span className="source-badge api">API</span>
            </div>
          </div>
        </div>

        {/* Product Table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Ürün Listesi</div>
            <span className="source-badge api">API</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Ürün</th>
                <th>Kategori</th>
                <th>Fiyat</th>
                <th>Stok</th>
                <th>30g Satış</th>
                <th>Puan</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const ss = stockStatus(p.stock);
                return (
                  <tr key={p.id}>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        fontFamily: "monospace",
                        fontSize: 12,
                      }}
                    >
                      {p.sku}
                    </td>
                    <td>
                      <a
                        href={`/dashboard/products/${p.id}`}
                        style={{
                          fontWeight: 600,
                          color: "var(--accent-primary-light)",
                        }}
                      >
                        {p.title}
                      </a>
                    </td>
                    <td>{p.category}</td>
                    <td
                      style={{ fontWeight: 700, color: "var(--text-primary)" }}
                    >
                      {p.price}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            p.stock < 20
                              ? "var(--accent-danger)"
                              : "var(--text-primary)",
                        }}
                      >
                        {p.stock}
                      </span>{" "}
                      <span
                        className={`status-badge ${ss.class}`}
                        style={{ fontSize: 9, padding: "2px 6px" }}
                      >
                        {ss.label}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.sales30d}</td>
                    <td>⭐ {p.rating}</td>
                    <td>
                      <span
                        className={`status-badge ${p.status === "active" ? "active" : "inactive"}`}
                      >
                        {p.status === "active" ? "Aktif" : "Pasif"}
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

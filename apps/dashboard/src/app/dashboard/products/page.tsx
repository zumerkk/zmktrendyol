"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProductsPage() {
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/trendyol/products?page=0&pageSize=50"),
    enabled: isAuthenticated(),
  });

  const products: any[] = Array.isArray(data) ? data : data?.data || data?.products || data?.items || [];

  const stockStatus = (qty: number) => {
    if (qty === 0) return { label: "Tükendi", class: "error" };
    if (qty < 20) return { label: "Kritik", class: "error" };
    if (qty < 50) return { label: "Düşük", class: "pending" };
    return { label: "Yeterli", class: "active" };
  };

  if (isLoading) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ color: "var(--text-secondary)" }}>Ürünler yükleniyor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">📦 Ürün Yönetimi</h1>
        <p className="page-subtitle">
          Trendyol mağazanızdaki tüm ürünler — Gerçek Veriler
        </p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Toplam Ürün</div>
            <div className="kpi-value">{products.length}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Aktif Ürün</div>
            <div className="kpi-value">
              {products.filter((p) => p.status === "active" || p.onSale).length}
            </div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Stok Kırılma</div>
            <div className="kpi-value" style={{ color: "var(--accent-danger)" }}>
              {products.filter((p) => (p.quantity ?? p.stock ?? 0) < 20).length}
            </div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Ürün Listesi</div>
            <span className="source-badge api">TRENDYOL API</span>
          </div>
          {products.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Henüz ürün yok — Önce{" "}
              <strong>Trendyol &gt; Ürün Senkronize Et</strong> yapın
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Barkod</th>
                  <th>Ürün</th>
                  <th>Fiyat</th>
                  <th>Stok</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p: any) => {
                  const qty = p.quantity ?? p.stock ?? 0;
                  const ss = stockStatus(qty);
                  const price = Number(p.salePrice || p.listPrice || p.price || 0);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
                        {p.barcode || p.stockCode || "—"}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--accent-primary-light)" }}>
                          {(p.title || "").substring(0, 60)}{(p.title || "").length > 60 ? "..." : ""}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {p.brand || ""} | {p.categoryName || ""}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                        {price > 0 ? `₺${price.toLocaleString("tr-TR")}` : "—"}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: qty < 20 ? "var(--accent-danger)" : "var(--text-primary)" }}>
                          {qty}
                        </span>{" "}
                        <span className={`status-badge ${ss.class}`} style={{ fontSize: 9, padding: "2px 6px" }}>
                          {ss.label}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${p.onSale || p.status === "active" ? "active" : "inactive"}`}>
                          {p.onSale || p.status === "active" ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

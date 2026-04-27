"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import { useState } from "react";

export default function ProductsPage() {
  const { ready, authed } = useAuth();
  const queryClient = useQueryClient();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/trendyol/products?page=0&pageSize=50"),
    enabled: authed,
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/trendyol/products/sync"),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSyncMsg(`✅ ${res.synced ?? res.total ?? "?"} ürün senkronize edildi!`);
      setTimeout(() => setSyncMsg(null), 5000);
    },
    onError: (err: any) => {
      setSyncMsg(`❌ Senkronizasyon hatası: ${err.message}`);
      setTimeout(() => setSyncMsg(null), 8000);
    },
  });

  if (!ready) return null;

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
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">📦 Ürün Yönetimi</h1>
          <p className="page-subtitle">
            Trendyol mağazanızdaki tüm ürünler — Gerçek Veriler
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: syncMutation.isPending ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #818cf8)",
            color: "#fff", fontWeight: 700, cursor: syncMutation.isPending ? "wait" : "pointer",
            fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(99,102,241,0.3)", transition: "all 0.2s ease"
          }}
        >
          {syncMutation.isPending ? "⏳ Senkronize ediliyor..." : "🔄 Trendyol'dan Senkronize Et"}
        </button>
      </div>

      {syncMsg && (
        <div style={{
          margin: "0 0 16px", padding: "12px 16px", borderRadius: 10,
          background: syncMsg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${syncMsg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: syncMsg.startsWith("✅") ? "#22c55e" : "#ef4444",
          fontWeight: 600, fontSize: 13, animation: "fadeIn 0.3s ease"
        }}>
          {syncMsg}
        </div>
      )}

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
                  const v0 = p.variants?.[0] || {};
                  const qty = p.quantity ?? v0.quantity ?? p.stock ?? v0.stock ?? 0;
                  const ss = stockStatus(qty);
                  const price = Number(p.salePrice || v0.salePrice || p.listPrice || v0.listPrice || p.price || 0);
                  return (
                    <tr key={p.id} onClick={() => window.location.href = `/dashboard/products/${p.id}`} style={{ cursor: "pointer" }} className="hover-row">
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
    </div>
  );
}

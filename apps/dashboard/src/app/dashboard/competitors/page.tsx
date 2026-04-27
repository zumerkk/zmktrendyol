"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import { useState } from "react";

export default function CompetitorsPage() {
  const { ready, authed } = useAuth();
  const queryClient = useQueryClient();

  const { data: competitors, isLoading } = useQuery({
    queryKey: ["competitors"],
    queryFn: () => api.get("/competitors"),
    enabled: authed,
  });

  const { data: buybox } = useQuery({
    queryKey: ["buybox"],
    queryFn: () => api.get("/competitors/buybox/status"),
    enabled: authed,
  });

  const { data: probes } = useQuery({
    queryKey: ["probes"],
    queryFn: () => api.get("/competitors/probes/active"),
    enabled: authed,
  });

  // Add competitor form
  const [compUrl, setCompUrl] = useState("");
  const [compTitle, setCompTitle] = useState("");
  const [compBrand, setCompBrand] = useState("");
  const [showForm, setShowForm] = useState(false);

  const addMutation = useMutation({
    mutationFn: () => api.post("/competitors", { url: compUrl, title: compTitle, brand: compBrand }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      setCompUrl(""); setCompTitle(""); setCompBrand(""); setShowForm(false);
    },
  });

  const probeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/competitors/${id}/probe-now`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["probes"] }),
  });

  const buyboxMutation = useMutation({
    mutationFn: (id: string) => api.post(`/competitors/${id}/buybox/enable`),
  });

  if (!ready) return null;

  const compList: any[] = Array.isArray(competitors) ? competitors : [];
  const buyboxData: any = buybox || {};
  const probeList: any[] = Array.isArray(probes) ? probes : [];

  if (isLoading) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ color: "var(--text-secondary)" }}>Rakip verileri yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">⚔️ Rakip İzleme</h1>
        <p className="page-subtitle">Rakip fiyatları ve buybox durumu — Gerçek Veriler</p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Takip Edilen Rakip</div>
            <div className="kpi-value">{compList.length}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Aktif Probe</div>
            <div className="kpi-value">{probeList.length}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Buybox Uyarısı</div>
            <div className="kpi-value" style={{ color: "var(--accent-danger)" }}>
              {buyboxData.alerts?.length || 0}
            </div>
            <div className="kpi-source">Kaynak: <span className="source-badge estimate">ESTIMATE</span></div>
          </div>
        </div>

        {/* Add Competitor Button + Form */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff",
              fontWeight: 600, cursor: "pointer", fontSize: 14,
            }}
          >
            {showForm ? "✕ İptal" : "+ Rakip Ekle"}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: 20, padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Trendyol URL *</div>
                <input value={compUrl} onChange={(e) => setCompUrl(e.target.value)}
                  placeholder="https://www.trendyol.com/..." style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Ürün Adı</div>
                <input value={compTitle} onChange={(e) => setCompTitle(e.target.value)}
                  placeholder="Rakip ürün adı" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Marka</div>
                <input value={compBrand} onChange={(e) => setCompBrand(e.target.value)}
                  placeholder="Marka" style={inputStyle} />
              </div>
              <button
                onClick={() => addMutation.mutate()}
                disabled={!compUrl || addMutation.isPending}
                style={{
                  padding: "10px 20px", borderRadius: 8, border: "none",
                  background: !compUrl ? "#374151" : "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: "#fff", fontWeight: 600, cursor: compUrl ? "pointer" : "not-allowed", height: 42,
                }}
              >
                {addMutation.isPending ? "⏳" : "Ekle"}
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="card-title">Rakip Listesi</div>
            <span className="source-badge api">API</span>
          </div>
          {compList.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              Henüz rakip eklenmedi — Yukarıdaki &quot;Rakip Ekle&quot; butonunu kullanın
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Ürün</th><th>Marka</th><th>Fiyat</th><th>Takip</th><th>Aksiyonlar</th></tr>
              </thead>
              <tbody>
                {compList.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {(c.title || "").substring(0, 50)}
                      </div>
                      {c.trendyolUrl && (
                        <a href={c.trendyolUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, color: "var(--accent-primary-light)" }}>Trendyol&#39;da Gör</a>
                      )}
                    </td>
                    <td>{c.brand || "—"}</td>
                    <td style={{ fontWeight: 700 }}>
                      {c.snapshots?.[0]?.price ? `₺${Number(c.snapshots[0].price).toLocaleString("tr-TR")}` : "—"}
                    </td>
                    <td>
                      <span className="status-badge active">
                        {c.trackedSince ? new Date(c.trackedSince).toLocaleDateString("tr-TR") : "Aktif"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => probeMutation.mutate(c.id)}
                          style={actionBtnStyle} title="Stok Probe">
                          🔍
                        </button>
                        <button onClick={() => buyboxMutation.mutate(c.id)}
                          style={actionBtnStyle} title="Buybox İzle">
                          🏆
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1px solid var(--border-primary)", background: "var(--bg-secondary)",
  color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box",
};

const actionBtnStyle: React.CSSProperties = {
  padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-primary)",
  background: "var(--bg-secondary)", cursor: "pointer", fontSize: 14,
};

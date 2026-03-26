"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isAuthenticated, clearToken } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get("/auth/me"),
    enabled: isAuthenticated(),
  });

  const { data: connections } = useQuery({
    queryKey: ["connections"],
    queryFn: () => api.get("/auth/connections"),
    enabled: isAuthenticated(),
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.get("/intelligence/subscription"),
    enabled: isAuthenticated(),
  });

  const { data: systemStatus } = useQuery({
    queryKey: ["system-status"],
    queryFn: () => api.get("/system/status"),
    enabled: isAuthenticated(),
  });

  const [sellerId, setSellerId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  const connectMutation = useMutation({
    mutationFn: () => api.post("/auth/connect-store", { sellerId, apiKey, apiSecret }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      alert("Mağaza bağlandı!");
    },
  });

  const user: any = profile || {};
  const connList: any[] = Array.isArray(connections) ? connections : [];
  const sub: any = subscription || {};
  const sys: any = systemStatus || {};

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">⚙️ Ayarlar</h1>
        <p className="page-subtitle">Hesap, mağaza bağlantıları ve sistem durumu</p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">👤 Hesap Bilgileri</div>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Ad:</span>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{user.name || "—"}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>E-posta:</span>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{user.email || "—"}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Rol:</span>
                <div><span className="status-badge active">{user.role || "—"}</span></div>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Plan:</span>
                <div><span className="status-badge active">{sub.plan || sub.currentPlan || "Free"}</span></div>
              </div>
              <button
                onClick={() => { clearToken(); router.push("/login"); }}
                style={{
                  marginTop: 20, padding: "8px 20px", borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)",
                  color: "#ef4444", cursor: "pointer", fontWeight: 600
                }}
              >
                Çıkış Yap
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">🔗 Mağaza Bağlantısı</div>
            </div>
            <div style={{ padding: 16 }}>
              {connList.length > 0 && (
                <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <span className="status-badge active">✅ Bağlı</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>
                    Satıcı ID: {connList[0]?.sellerId || "—"}
                  </span>
                </div>
              )}
              <input
                value={sellerId} onChange={(e) => setSellerId(e.target.value)}
                placeholder="Seller ID" style={inputStyle}
              />
              <input
                value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key" style={inputStyle}
              />
              <input
                value={apiSecret} onChange={(e) => setApiSecret(e.target.value)}
                placeholder="API Secret" type="password" style={inputStyle}
              />
              <button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                style={{
                  marginTop: 8, padding: "10px 24px", borderRadius: 8, border: "none",
                  background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff",
                  fontWeight: 600, cursor: "pointer"
                }}
              >
                {connectMutation.isPending ? "⏳ Bağlanıyor..." : "Mağazayı Bağla"}
              </button>
            </div>
          </div>
        </div>

        {sys && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <div className="card-title">🖥️ Sistem Durumu</div>
              <span className="source-badge api">API</span>
            </div>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Uptime</div>
                <div className="kpi-value" style={{ fontSize: 14 }}>{sys.uptime || "—"}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Memory</div>
                <div className="kpi-value" style={{ fontSize: 14 }}>{sys.memory?.heapUsed ? `${Math.round(sys.memory.heapUsed / 1024 / 1024)}MB` : "—"}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">PostgreSQL</div>
                <div className="kpi-value" style={{ color: "#22c55e", fontSize: 14 }}>
                  {sys.database === "connected" ? "✅ Bağlı" : sys.database || "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8, marginBottom: 8,
  border: "1px solid var(--border-primary)", background: "var(--bg-secondary)",
  color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box"
};

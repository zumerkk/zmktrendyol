"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, clearToken } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const { ready, authed } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => api.get("/auth/me"), enabled: authed });
  const { data: connections } = useQuery({ queryKey: ["connections"], queryFn: () => api.get("/auth/connections"), enabled: authed });
  const { data: systemStatus } = useQuery({ queryKey: ["system-status"], queryFn: () => api.get("/system/status"), enabled: authed });

  // Trendyol
  const [sellerId, setSellerId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [connectResult, setConnectResult] = useState<any>(null);

  // Google Ads
  const [gadsCustomerId, setGadsCustomerId] = useState("");
  const [gadsDevToken, setGadsDevToken] = useState("");
  const [gadsRefreshToken, setGadsRefreshToken] = useState("");

  // Meta
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");

  // Telegram
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  const [activeSection, setActiveSection] = useState<"account" | "trendyol" | "google" | "meta" | "telegram" | "system">("account");

  const connectMut = useMutation({
    mutationFn: () => api.post("/auth/connect-store", { sellerId, apiKey, apiSecret }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      setConnectResult(data);
      setSellerId(""); setApiKey(""); setApiSecret("");
    },
    onError: (err: any) => {
      setConnectResult({ healthCheck: { connected: false, message: err.message || "Bağlantı hatası" } });
    },
  });

  if (!ready) return null;

  const user: any = profile || {};
  const connList: any[] = Array.isArray(connections) ? connections : [];
  const sys: any = systemStatus || {};

  const sections = [
    { key: "account", label: "👤 Hesap", icon: "👤" },
    { key: "trendyol", label: "🛒 Trendyol", icon: "🛒" },
    { key: "google", label: "📊 Google Ads", icon: "📊" },
    { key: "meta", label: "📘 Meta Ads", icon: "📘" },
    { key: "telegram", label: "📱 Telegram", icon: "📱" },
    { key: "system", label: "🖥️ Sistem", icon: "🖥️" },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>⚙️</span> Ayarlar & Entegrasyonlar
        </h1>
        <p className="page-subtitle">
          Hesap · Mağaza Bağlantıları · Reklam Platformları · Bildirimler · Sistem
        </p>
      </div>

      {/* Section Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto" }}>
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key as any)}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer",
              background: activeSection === s.key ? "linear-gradient(135deg, #6366f1, #818cf8)" : "var(--bg-secondary)",
              color: activeSection === s.key ? "#fff" : "var(--text-secondary)",
              fontWeight: activeSection === s.key ? 700 : 500, fontSize: 13, whiteSpace: "nowrap",
              boxShadow: activeSection === s.key ? "0 4px 12px rgba(99,102,241,0.2)" : "none",
            }}
          >{s.label}</button>
        ))}
      </div>

      {/* ═══ ACCOUNT ═══ */}
      {activeSection === "account" && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title">👤 Hesap Bilgileri</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
            <div>
              {[
                { label: "Ad", value: user.name },
                { label: "E-posta", value: user.email },
                { label: "Rol", value: user.role },
                { label: "Tenant", value: user.tenantId },
              ].map((f) => (
                <div key={f.label} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{f.value || "—"}</div>
                </div>
              ))}
              <button
                onClick={() => { clearToken(); router.push("/login"); }}
                style={{
                  marginTop: 12, padding: "10px 24px", borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)",
                  color: "#ef4444", cursor: "pointer", fontWeight: 700, fontSize: 13,
                }}
              >🚪 Çıkış Yap</button>
            </div>
            <div style={{ padding: 20, borderRadius: 14, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6366f1", marginBottom: 12 }}>📊 Hesap Özeti</div>
              {[
                { label: "Ürün Sayısı", value: sys.counts?.products ?? "—" },
                { label: "Sipariş Sayısı", value: sys.counts?.orders ?? "—" },
                { label: "Rakip Hedef", value: sys.counts?.rivalTargets ?? "—" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(99,102,241,0.08)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
                  <span style={{ fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TRENDYOL ═══ */}
      {activeSection === "trendyol" && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title">🛒 Trendyol Mağaza Bağlantısı</div>
          {connList.length > 0 && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#22c55e" }}>Mağaza Bağlı</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Satıcı ID: {connList[0]?.sellerId || "—"}</div>
              </div>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <Input label="Seller ID" value={sellerId} onChange={setSellerId} placeholder="571676" />
            <Input label="API Key" value={apiKey} onChange={setApiKey} placeholder="xBX5OAF..." />
            <Input label="API Secret" value={apiSecret} onChange={setApiSecret} placeholder="OaWlNeY..." type="password" />
            <button onClick={() => connectMut.mutate()} disabled={connectMut.isPending} style={btnStyle}>
              {connectMut.isPending ? "⏳ Bağlanıyor..." : "🔗 Mağazayı Bağla"}
            </button>
            {connectResult && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: connectResult.healthCheck?.connected ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${connectResult.healthCheck?.connected ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: connectResult.healthCheck?.connected ? "#22c55e" : "#ef4444" }}>
                  {connectResult.healthCheck?.connected ? "✅ Bağlantı Doğrulandı" : "❌ Bağlantı Başarısız"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ GOOGLE ADS ═══ */}
      {activeSection === "google" && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "#fff", fontWeight: 900,
            }}>G</div>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Google Ads Entegrasyonu</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Reklam kampanyalarını yönetin ve Zeus algoritmasına bağlayın</div>
            </div>
          </div>
          <Input label="Customer ID (MCC)" value={gadsCustomerId} onChange={setGadsCustomerId} placeholder="123-456-7890" />
          <Input label="Developer Token" value={gadsDevToken} onChange={setGadsDevToken} placeholder="ABCDEF..." />
          <Input label="Refresh Token (OAuth2)" value={gadsRefreshToken} onChange={setGadsRefreshToken} placeholder="1//0xxx..." type="password" />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button style={btnStyle}>🔗 Google Ads Bağla</button>
            <a href="https://ads.google.com" target="_blank" style={{ ...btnStyle, background: "var(--bg-secondary)", color: "var(--text-secondary)", textDecoration: "none", textAlign: "center" }}>
              📖 Google Ads Panel
            </a>
          </div>
          <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "rgba(66,133,244,0.05)", border: "1px solid rgba(66,133,244,0.15)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4285F4", marginBottom: 8 }}>⚡ Zeus Entegrasyonu</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Google Ads bağlantısı kurulduktan sonra, <strong>God Mode → Zeus Keskin Nişancı</strong> algoritması otomatik olarak kampanya bütçelerini prime-time saatlerinde 3x artırır ve gece saatlerinde durdurur.
            </div>
          </div>
        </div>
      )}

      {/* ═══ META ADS ═══ */}
      {activeSection === "meta" && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "linear-gradient(135deg, #1877F2, #00C6FF)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, color: "#fff", fontWeight: 900,
            }}>f</div>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Meta Business Entegrasyonu</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Facebook & Instagram reklamları ve Pixel tracking</div>
            </div>
          </div>
          <Input label="Pixel ID" value={metaPixelId} onChange={setMetaPixelId} placeholder="1234567890" />
          <Input label="Ad Account ID" value={metaAdAccountId} onChange={setMetaAdAccountId} placeholder="act_1234567890" />
          <Input label="Access Token" value={metaAccessToken} onChange={setMetaAccessToken} placeholder="EAABxx..." type="password" />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button style={btnStyle}>🔗 Meta Bağla</button>
            <a href="https://business.facebook.com" target="_blank" style={{ ...btnStyle, background: "var(--bg-secondary)", color: "var(--text-secondary)", textDecoration: "none", textAlign: "center" }}>
              📖 Meta Business Suite
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
            {[
              { label: "Conversion Tracking", desc: "Satış dönüşümlerini otomatik takip", icon: "📊", color: "#1877F2" },
              { label: "Lookalike Audience", desc: "Benzer kitlelerle reklam", icon: "👥", color: "#E1306C" },
              { label: "Dynamic Catalog", desc: "Ürün kataloğu senkronizasyonu", icon: "🛍️", color: "#833AB4" },
              { label: "Retargeting", desc: "Sepet terk eden müşteriler", icon: "🎯", color: "#F77737" },
            ].map((f) => (
              <div key={f.label} style={{
                padding: 12, borderRadius: 10, background: `${f.color}08`, border: `1px solid ${f.color}15`,
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TELEGRAM ═══ */}
      {activeSection === "telegram" && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "linear-gradient(135deg, #0088cc, #00bfff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, color: "#fff",
            }}>✈️</div>
            <div>
              <div className="card-title" style={{ margin: 0 }}>Telegram Bot Entegrasyonu</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Anlık alarm ve rapor bildirimleri</div>
            </div>
          </div>
          <Input label="Bot Token" value={telegramToken} onChange={setTelegramToken} placeholder="123456:ABC-DEF..." type="password" />
          <Input label="Chat ID" value={telegramChatId} onChange={setTelegramChatId} placeholder="-1001234567890" />
          <button style={btnStyle}>🔗 Telegram Bağla</button>
          <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "rgba(0,136,204,0.05)", border: "1px solid rgba(0,136,204,0.15)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0088cc", marginBottom: 8 }}>📨 Bildirim Kanalları</div>
            {[
              { label: "Stok Alarmları", desc: "Rakip stok değişimleri" },
              { label: "Fiyat Değişimleri", desc: "Ani fiyat düşüşleri" },
              { label: "OOS Fırsatları", desc: "Rakip stok bittiğinde" },
              { label: "Günlük Rapor", desc: "Her gün saat 09:00" },
            ].map((n) => (
              <div key={n.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(0,136,204,0.08)", fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{n.label}</span>
                  <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 10 }}>{n.desc}</span>
                </div>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: "rgba(34,197,94,0.3)", position: "relative" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#22c55e", position: "absolute", top: 2, right: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SYSTEM ═══ */}
      {activeSection === "system" && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title">🖥️ Sistem Durumu</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
            {[
              { label: "API Durumu", value: "✅ Çalışıyor", color: "#22c55e" },
              { label: "PostgreSQL", value: sys.counts ? "✅ Bağlı" : "⚠️ Kontrol et", color: sys.counts ? "#22c55e" : "#eab308" },
              { label: "Redis", value: "✅ Aktif", color: "#22c55e" },
              { label: "Uptime", value: sys.server?.uptime ? `${Math.floor(parseInt(sys.server.uptime) / 60)}dk` : "—", color: "#3b82f6" },
              { label: "Memory", value: sys.server?.memory?.heapUsed || "—", color: "#8b5cf6" },
              { label: "Ürünler", value: sys.counts?.products ?? "—", color: "#6366f1" },
              { label: "Siparişler", value: sys.counts?.orders ?? "—", color: "#10b981" },
              { label: "Environment", value: sys.server?.env || "development", color: "#f97316" },
            ].map((s) => (
              <div key={s.label} style={{
                padding: "14px 16px", borderRadius: 12, background: "var(--bg-secondary)",
                border: "1px solid var(--border-primary)",
              }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ──────────────────────────

function Input({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{label}</label>
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} type={type || "text"} autoComplete="off"
        style={{
          width: "100%", padding: "10px 14px", borderRadius: 8, boxSizing: "border-box",
          border: "1px solid var(--border-primary)", background: "var(--bg-secondary)",
          color: "var(--text-primary)", fontSize: 13, outline: "none",
        }}
      />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 10, border: "none",
  background: "linear-gradient(135deg, #6366f1, #818cf8)",
  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
  display: "inline-block",
};

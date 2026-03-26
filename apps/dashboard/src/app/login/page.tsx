"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [tenantName, setTenantName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister
        ? { email, password, name, tenantName }
        : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      const data = json.data || json;

      if (!res.ok) {
        setError(data.message || "Giriş başarısız");
        return;
      }

      setToken(data.accessToken);
      router.push("/dashboard");
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a0e1a 0%, #1a1f36 50%, #0a0e1a 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 40,
          borderRadius: 16,
          background: "rgba(15, 20, 40, 0.8)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 900,
              color: "#fff",
              margin: "0 auto 16px",
            }}
          >
            Z
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
            ZMK Platform
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            Mağaza Zekâ Paneli
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <label style={labelStyle}>Ad Soyad</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adınız Soyadınız"
                style={inputStyle}
                required
              />
              <label style={labelStyle}>Mağaza Adı</label>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Mağaza Adınız"
                style={inputStyle}
                required
              />
            </>
          )}
          <label style={labelStyle}>E-posta</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mail@adresiniz.com"
            style={inputStyle}
            required
          />
          <label style={labelStyle}>Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={inputStyle}
            required
          />
          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "⏳ Yükleniyor..." : isRegister ? "Kayıt Ol" : "Giriş Yap"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          {isRegister ? "Hesabınız var mı?" : "Hesabınız yok mu?"}{" "}
          <button
            onClick={() => setIsRegister(!isRegister)}
            style={{
              background: "none",
              border: "none",
              color: "#818cf8",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {isRegister ? "Giriş Yap" : "Kayıt Ol"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: 6,
  marginTop: 16,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid rgba(99,102,241,0.2)",
  background: "rgba(15,20,40,0.6)",
  color: "#e2e8f0",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 4,
};

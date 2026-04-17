import type { Metadata } from "next";
import "../styles/globals.css";
import Providers from "../components/providers";

export const metadata: Metadata = {
  title: "ZMK Trendyol Platform — Mağaza Zekâ Paneli",
  description:
    "Trendyol satıcılarının satış, fiyat, stok, kampanya ve rekabet kararlarını tek ekrandan yönetmesini sağlayan AI destekli platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <div className="app-layout">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-brand">
              <div className="sidebar-brand-icon">Z</div>
              <div>
                <div className="sidebar-brand-text">ZMK Platform</div>
                <div className="sidebar-brand-sub">Mağaza Zekâ Paneli</div>
              </div>
            </div>
            <nav className="sidebar-nav">
              <div className="sidebar-section-title">Ana Menü</div>
              <a href="/dashboard" className="sidebar-link active">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                KPI Merkezi
              </a>
              <a
                href="/dashboard/insights"
                className="sidebar-link"
                style={{ color: "var(--accent-warning)" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Bugün Ne Yapmalıyım?
              </a>
              <a href="/dashboard/products" className="sidebar-link">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m7.5 4.27 9 5.15M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                Ürünler
              </a>
              <a href="/dashboard/orders" className="sidebar-link">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" x2="21" y1="6" y2="6" />
                </svg>
                Siparişler
              </a>
              <a href="/dashboard/returns" className="sidebar-link">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                İadeler
              </a>

              <div className="sidebar-section-title">Zekâ</div>
              <a href="/dashboard/rivals" className="sidebar-link">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                  <path d="M11 8v6M8 11h6" />
                </svg>
                Rakip İstihbarat
              </a>
              <a href="/dashboard/competitors" className="sidebar-link">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Rakip İzleme
              </a>
              <a href="/dashboard/war-room" className="sidebar-link" style={{ color: "var(--accent-primary)" }}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M16 13H8" />
                  <path d="M16 17H8" />
                  <path d="M10 9H8" />
                </svg>
                Savaş Odası 2.0
              </a>
              <a href="/dashboard/ai" className="sidebar-link">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M2 14h2" />
                  <path d="M20 14h2" />
                  <path d="M15 13v2" />
                  <path d="M9 13v2" />
                </svg>
                AI Asistan
              </a>
              <a
                href="/dashboard/agent"
                className="sidebar-link"
                style={{
                  color: "#22d3ee",
                  fontWeight: 600,
                  borderRadius: "8px",
                  background: "rgba(34, 211, 238, 0.05)",
                  border: "1px solid rgba(34, 211, 238, 0.2)"
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                  <path d="M8 12h8" />
                </svg>
                🤖 Otonom Ajan
              </a>
              <a
                href="/dashboard/god-mode"
                className="sidebar-link"
                style={{
                  color: "#FFD700", // Gold color for premium feel
                  fontWeight: 600,
                  marginTop: "8px",
                  borderRadius: "8px",
                  background: "rgba(255, 215, 0, 0.05)",
                  border: "1px solid rgba(255, 215, 0, 0.2)"
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                God Mode ⚡
              </a>

              <div className="sidebar-section-title">Yönetim</div>
              <a href="/dashboard/audit" className="sidebar-link">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" x2="8" y1="13" y2="13" />
                  <line x1="16" x2="8" y1="17" y2="17" />
                </svg>
                Denetim İzleri
              </a>
              <a href="/dashboard/settings" className="sidebar-link">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                Ayarlar
              </a>
            </nav>
          </aside>

          {/* Main */}
          <main className="main-content">
            <Providers>{children}</Providers>
          </main>
        </div>
      </body>
    </html>
  );
}

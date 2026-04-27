import type { Metadata } from "next";
import "../styles/globals.css";
import Providers from "../components/providers";
import { SidebarNav } from "../components/sidebar-nav";

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
            <SidebarNav />
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

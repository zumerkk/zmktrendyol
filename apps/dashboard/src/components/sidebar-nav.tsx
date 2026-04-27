"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const navItems = [
  { section: "Ana Menü", items: [
    { href: "/dashboard", label: "KPI Merkezi", icon: "M3,3h7v7H3V3 M14,3h7v7h-7V3 M3,14h7v7H3v-7 M14,14h7v7h-7v-7" },
    { href: "/dashboard/insights", label: "Bugün Ne Yapmalıyım?", icon: "M10.29,3.86L1.82,18a2,2,0,0,0,1.71,3h16.94a2,2,0,0,0,1.71-3L13.71,3.86a2,2,0,0,0-3.42,0z" },
    { href: "/dashboard/products", label: "Ürünler", icon: "M21,16V8a2,2,0,0,0-1-1.73l-7-4a2,2,0,0,0-2,0l-7,4A2,2,0,0,0,3,8v8a2,2,0,0,0,1,1.73l7,4a2,2,0,0,0,2,0l7-4A2,2,0,0,0,21,16z" },
    { href: "/dashboard/orders", label: "Siparişler", icon: "M6,2L3,6v14a2,2,0,0,0,2,2h14a2,2,0,0,0,2-2V6l-3-4z" },
    { href: "/dashboard/returns", label: "İadeler", icon: "M3.51,15a9,9,0,1,0,2.13-9.36L1,10" },
  ]},
  { section: "Zekâ", items: [
    { href: "/dashboard/shadow", label: "🕵️ Gölge İstihbarat V2", icon: "M12,2a10,10,0,1,0,10,10A10,10,0,0,0,12,2z", special: "emerald" },
    { href: "/dashboard/rivals", label: "Rakip Takip (V1)", icon: "M12,2a10,10,0,1,0,10,10A10,10,0,0,0,12,2z" },
    { href: "/dashboard/war-room", label: "Savaş Odası 2.0", icon: "M14.5,2H6a2,2,0,0,0-2,2v16a2,2,0,0,0,2,2h12a2,2,0,0,0,2-2V7.5L14.5,2z" },
    { href: "/dashboard/ai", label: "AI Asistan", icon: "M12,8V4H8 M4,8h16v12H4z" },
    { href: "/dashboard/agent", label: "🤖 Otonom Ajan", icon: "M12,2a10,10,0,1,0,10,10A10,10,0,0,0,12,2z", special: "cyan" },
    { href: "/dashboard/god-mode", label: "God Mode ⚡", icon: "M13,2L3,14h9l-1,8,10-12H12l1-8z", special: "gold" },
  ]},
  { section: "Yönetim", items: [
    { href: "/dashboard/audit", label: "Denetim İzleri", icon: "M14,2H6a2,2,0,0,0-2,2v16a2,2,0,0,0,2,2h12a2,2,0,0,0,2-2V8z" },
    { href: "/dashboard/settings", label: "Ayarlar", icon: "M12,12m-3,0a3,3,0,1,0,6,0a3,3,0,1,0-6,0" },
  ]},
];

export function SidebarNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <nav className="sidebar-nav">
      {navItems.map((section) => (
        <div key={section.section}>
          <div className="sidebar-section-title">{section.section}</div>
          {section.items.map((item) => {
            const active = isActive(item.href);
            const specialStyle = item.special === "emerald"
              ? { color: "#10b981", fontWeight: 700, borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }
              : item.special === "cyan"
              ? { color: "#22d3ee", fontWeight: 600, borderRadius: "8px", background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.2)" }
              : item.special === "gold"
              ? { color: "#FFD700", fontWeight: 600, borderRadius: "8px", background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.2)", marginTop: "8px" }
              : {};

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${active ? "active" : ""}`}
                style={!active ? specialStyle : undefined}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

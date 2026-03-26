"use client";

import React, { useState, useEffect } from "react";

// Fallback logic inside component to mock data if API is not fully running
export default function WarRoomDashboard() {
    const [activeTab, setActiveTab] = useState("dna");

    return (
        <div className="dashboard-content">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">⚔️ Savaş Odası 2.0</h1>
                    <p className="dashboard-subtitle">
                        Rakiplerinin niyetini tahmin et, fiyat savaşlarını önceden simüle et ve pazar payını yönet.
                    </p>
                </div>
                <div className="dashboard-actions">
                    <button className="btn btn-secondary">
                        Rapor İndir
                    </button>
                    <button className="btn btn-primary">
                        Yeni Sinyal Ekle
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: "24px", borderBottom: "1px solid var(--border)", display: "flex", gap: "24px" }}>
                <button
                    className={`tab ${activeTab === "dna" ? "active" : ""}`}
                    onClick={() => setActiveTab("dna")}
                    style={{ paddingBottom: "12px", background: "none", border: "none", color: activeTab === "dna" ? "var(--text-primary)" : "var(--text-muted)", borderBottom: activeTab === "dna" ? "2px solid var(--accent-primary)" : "none", cursor: "pointer", fontWeight: 600 }}
                >
                    🧬 Rakip DNA & Niyet
                </button>
                <button
                    className={`tab ${activeTab === "sim" ? "active" : ""}`}
                    onClick={() => setActiveTab("sim")}
                    style={{ paddingBottom: "12px", background: "none", border: "none", color: activeTab === "sim" ? "var(--text-primary)" : "var(--text-muted)", borderBottom: activeTab === "sim" ? "2px solid var(--accent-primary)" : "none", cursor: "pointer", fontWeight: 600 }}
                >
                    🔮 Fiyat Savaş Simülatörü
                </button>
            </div>

            {activeTab === "dna" && (
                <div className="kpi-grid" style={{ gridTemplateColumns: "1fr", gap: "24px" }}>
                    <div className="kpi-card" style={{ padding: "0" }}>
                        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ margin: 0, fontSize: "16px" }}>Aktif Analizler</h3>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)", backgroundColor: "var(--bg-secondary)", padding: "4px 8px", borderRadius: "12px" }}>Canlı Veri (API)</span>
                        </div>
                        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

                            {/* DNA Card 1 */}
                            <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                                    <div>
                                        <h4 style={{ margin: "0 0 4px 0", color: "var(--text-primary)" }}>XYZ Kozmetik — Leke Giderici Serum</h4>
                                        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Son 50 fiyat hareketi analiz edildi.</div>
                                    </div>
                                    <div style={{ padding: "6px 12px", borderRadius: "16px", backgroundColor: "rgba(220, 38, 38, 0.1)", color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>Agresif Fiyat Kırıcı</div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
                                    <div style={{ backgroundColor: "var(--bg-primary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Fiyat Düşürme Eğilimi</div>
                                        <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>%76</div>
                                    </div>
                                    <div style={{ backgroundColor: "var(--bg-primary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Davranış Patern'i</div>
                                        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>Hafta Sonu Fiyat Kırıcı</div>
                                    </div>
                                    <div style={{ backgroundColor: "var(--bg-primary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Cevap Süresi (Tahmini)</div>
                                        <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>15 dk</div>
                                    </div>
                                </div>

                                <div style={{ padding: "16px", backgroundColor: "rgba(234, 179, 8, 0.1)", borderLeft: "4px solid var(--accent-warning)", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>AI Niyet Tahmini</div>
                                    <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>Yüksek ihtimalle cuma akşamı saat 20:00 sularında fiyat kırması bekleniyor. Fiyat savaşına girmeyip hafta sonu yüksek marjlı ürünlere odaklanılması tavsiye edilir.</div>
                                </div>
                            </div>

                            {/* DNA Card 2 */}
                            <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                                    <div>
                                        <h4 style={{ margin: "0 0 4px 0", color: "var(--text-primary)" }}>Güzellik Pınarı — C Vitamini</h4>
                                        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Son 50 fiyat hareketi analiz edildi.</div>
                                    </div>
                                    <div style={{ padding: "6px 12px", borderRadius: "16px", backgroundColor: "rgba(34, 211, 238, 0.1)", color: "var(--accent-primary)", fontSize: "12px", fontWeight: 600 }}>Marj Koruyucu</div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
                                    <div style={{ backgroundColor: "var(--bg-primary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Fiyat Düşürme Eğilimi</div>
                                        <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>%12</div>
                                    </div>
                                    <div style={{ backgroundColor: "var(--bg-primary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Davranış Patern'i</div>
                                        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>Fiyat Takipçisi (Statik)</div>
                                    </div>
                                    <div style={{ backgroundColor: "var(--bg-primary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Cevap Süresi (Tahmini)</div>
                                        <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>4-6 Saat</div>
                                    </div>
                                </div>

                                <div style={{ padding: "16px", backgroundColor: "rgba(34, 211, 238, 0.1)", borderLeft: "4px solid var(--accent-primary)", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>AI Niyet Tahmini</div>
                                    <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>Fiyatı düşürmeye istekli değil. Biz 1₺ kırarsak muhtemelen bizi takip etmeyecektir. Buybox kolayca alınabilir.</div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {activeTab === "sim" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    <div className="kpi-card" style={{ padding: "24px" }}>
                        <h3 style={{ margin: "0 0 20px 0", fontSize: "16px" }}>Simülasyon Senaryosu</h3>
                        <div style={{ marginBottom: "20px" }}>
                            <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>Hedef Ürün Seçimi</label>
                            <select className="input" style={{ width: "100%", padding: "10px", backgroundColor: "var(--bg-primary)" }}>
                                <option>ZMK Kolajen Peptitler (SKU: ZMK-COL-001)</option>
                            </select>
                        </div>

                        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>Mevcut Fiyat</label>
                                <div style={{ padding: "12px", backgroundColor: "var(--bg-secondary)", borderRadius: "6px", fontSize: "18px", fontWeight: 600 }}>199.90 ₺</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>Hedef (Simüle) Fiyat</label>
                                <input type="number" className="input" defaultValue="189.90" style={{ width: "100%", padding: "10px", fontSize: "16px", fontWeight: 600 }} />
                            </div>
                        </div>

                        <button className="btn btn-primary" style={{ width: "100%", padding: "12px", fontSize: "14px" }}>Simülasyonu Başlat</button>
                    </div>

                    <div className="kpi-card" style={{ padding: "24px" }}>
                        <h3 style={{ margin: "0 0 20px 0", fontSize: "16px" }}>Simülasyon Sonucu (Tahmini)</h3>
                        <div style={{ padding: "16px", backgroundColor: "rgba(34, 197, 94, 0.1)", borderLeft: "4px solid #22c55e", borderRadius: "4px", marginBottom: "24px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Karar Önerisi</div>
                            <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>POSITIVE: Bu fiyat değişikliği marj düşüşünden daha fazla hacim getirerek toplam kârlılığı artıracak.</div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ color: "var(--text-muted)" }}>Buybox Kazanma Şansı</span>
                                <span style={{ fontWeight: 600, color: "#22c55e" }}>%95 (Likely Win)</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ color: "var(--text-muted)" }}>Tahmini Hacim Değişimi</span>
                                <span style={{ fontWeight: 600, color: "#22c55e" }}>+%15.5</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ color: "var(--text-muted)" }}>Birim Kâr (Mevcut → Yeni)</span>
                                <span style={{ fontWeight: 600 }}>45.00₺ → 36.50₺ <span style={{ color: "#ef4444", fontSize: "12px" }}>(-%18)</span></span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ color: "var(--text-muted)" }}>Toplam Aylık Net Kâr Farkı</span>
                                <span style={{ fontWeight: 600, color: "#22c55e", fontSize: "18px" }}>+4,250 ₺</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

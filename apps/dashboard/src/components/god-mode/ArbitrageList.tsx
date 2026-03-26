"use client";

import React, { useState } from "react";
import styles from "./GodMode.module.css";
// We will create the CSS module next. For now assume standard className structure

export default function ArbitrageList() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleScan = async () => {
        setLoading(true);
        // Simulate API call to the GodMode Arbitrage service
        setTimeout(() => {
            setResult({
                name: "Titanyum Şarj Göstergeli Tıraş Makinesi",
                trPrice: 599.90,
                cnPrice: 85.50,
                estimatedRoi: "%400",
                factoryLink: "https://1688.com/factory/example",
            });
            setLoading(false);
        }, 1500);
    };

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <div className={styles.titleWrapper}>
                    <span className={styles.icon}>🌐</span>
                    <h3>Çin Tedarik Arbitrajı</h3>
                </div>
                <span className={styles.badgeLabel}>Aktif Tarama</span>
            </div>
            <p className={styles.description}>
                Trendyol'da şu an inanılmaz volümle satan, ancak 1688 (Çin) üzerinde %400'den fazla kâr marjıyla üretilebilen altın fırsatları bulur.
            </p>

            {result ? (
                <div className={styles.resultBox}>
                    <div className={styles.resultItem}>
                        <strong>Tespit Edilen Fırsat:</strong> {result.name}
                    </div>
                    <div className={styles.priceRow}>
                        <span>🇹🇷 TR Satış Fiyatı: <strong>{result.trPrice} TL</strong></span>
                        <span>🇨🇳 Üretim Maliyeti: <strong style={{ color: 'var(--success-dark)' }}>{result.cnPrice} TL ($2.5)</strong></span>
                    </div>
                    <div className={styles.roiRow}>
                        <span>Tahmini ROI: <strong>{result.estimatedRoi}</strong></span>
                    </div>
                    <button className={styles.actionBtnOutline} onClick={() => window.open(result.factoryLink)}>
                        Fabrikayı (1688) Görüntüle
                    </button>
                </div>
            ) : (
                <button
                    className={styles.actionBtn}
                    onClick={handleScan}
                    disabled={loading}
                >
                    {loading ? "Ters Görsel Arama Yapılıyor..." : "Piyasayı Tara (Reverse Image Search)"}
                </button>
            )}
        </div>
    );
}

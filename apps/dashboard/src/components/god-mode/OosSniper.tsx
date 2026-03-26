"use client";

import React, { useState } from "react";
import styles from "./GodMode.module.css";

export default function OosSniper() {
    const [sniperActive, setSniperActive] = useState(false);

    const toggleSniper = () => {
        setSniperActive(!sniperActive);
    };

    return (
        <div className={`${styles.card} ${sniperActive ? styles.cardActiveGlow : ''}`}>
            <div className={styles.cardHeader}>
                <div className={styles.titleWrapper}>
                    <span className={styles.icon}>🎯</span>
                    <h3>OOS Yağmacı Algoritma</h3>
                </div>
                <label className={styles.toggleSwitch}>
                    <input type="checkbox" checked={sniperActive} onChange={toggleSniper} />
                    <span className={styles.slider}></span>
                </label>
            </div>
            <p className={styles.description}>
                Sizinle aynı ürünü satan pazar lideri rakiplerin STOKLARI BİTTİĞİNDE (Out-Of-Stock) bunu anında fark edip, piyasada TEKEL olduğunuz saniyelerde fiyatınızı %25 yukarı uçurur.
            </p>

            {sniperActive ? (
                <div className={styles.resultBox}>
                    <div className={styles.priceRow}>
                        <span>Hedeflenen Rakip Sayısı: <strong>8</strong></span>
                        <span className={styles.badgeDanger}>Atışa Hazır</span>
                    </div>
                    <div className={styles.roiRow}>
                        <span>OOS Snipes ile Kazanılan Ekstra Kâr: <strong>+12,450 TL</strong> (Son 30 Gün)</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
                        * Rakip stoğu bitince kendi fiyatınızı "Otomatik" artırır, rakip tekrar stoğa girince eski fiyata geri döner.
                    </p>
                </div>
            ) : (
                <div className={styles.resultBox} style={{ opacity: 0.6 }}>
                    <span>OOS Sniper devre dışı. Rakiplerin stoksuz kaldığı kritik anlardaki fırsat kârlarını kaçırıyorsunuz.</span>
                </div>
            )}
        </div>
    );
}

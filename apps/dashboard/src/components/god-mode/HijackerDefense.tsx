"use client";

import React, { useState } from "react";
import styles from "./GodMode.module.css";

export default function HijackerDefense() {
    const [defenseActive, setDefenseActive] = useState(true);

    const toggleDefense = () => {
        setDefenseActive(!defenseActive);
    };

    return (
        <div className={`${styles.card} ${defenseActive ? styles.cardActiveGlow : ''}`}>
            <div className={styles.cardHeader}>
                <div className={styles.titleWrapper}>
                    <span className={styles.icon}>🔫</span>
                    <h3>Hijacker İnfaz Sistemi</h3>
                </div>
                <label className={styles.toggleSwitch}>
                    <input type="checkbox" checked={defenseActive} onChange={toggleDefense} />
                    <span className={styles.slider}></span>
                </label>
            </div>
            <p className={styles.description}>
                Private Label marka tescilli ilanınızın "Buybox"ına giren çakma ve parazit satıcıları (Hijackers) 7/24 denetler ve otomatik Marka Telif İhtarnamesi oluşturur.
            </p>

            {defenseActive ? (
                <div className={styles.resultBox}>
                    <div className={styles.resultItem}>
                        <span>Son Tarama: <strong>12 dakika önce</strong></span>
                        <span style={{ float: 'right' }} className={styles.badgeLabel}>Güvenli</span>
                    </div>
                    <div className={styles.resultItem} style={{ borderTop: '1px solid var(--border-light)', paddingTop: '8px' }}>
                        <span>Korunan İlan Sayısı: <strong>14 Adet</strong></span>
                    </div>
                    <button className={styles.actionBtnOutline} style={{ marginTop: '10px' }}>
                        Geçmiş İnfaz Raporlarını Gör
                    </button>
                </div>
            ) : (
                <div className={styles.resultBox} style={{ opacity: 0.6 }}>
                    <span>Kalkan Devre Dışı. Parazit satıcı riski altında olabilirsiniz.</span>
                </div>
            )}
        </div>
    );
}

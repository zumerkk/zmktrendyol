"use client";

import React, { useState } from "react";
import styles from "./GodMode.module.css";

export default function ZeusRadar() {
    const [zeusActive, setZeusActive] = useState(false);

    const toggleZeus = () => {
        setZeusActive(!zeusActive);
    };

    return (
        <div className={`${styles.card} ${zeusActive ? styles.cardActiveGlow : ''}`}>
            <div className={styles.cardHeader}>
                <div className={styles.titleWrapper}>
                    <span className={styles.icon}>⚡</span>
                    <h3>Zeus Keskin Nişancı Reklamı</h3>
                </div>
                <label className={styles.toggleSwitch}>
                    <input type="checkbox" checked={zeusActive} onChange={toggleZeus} />
                    <span className={styles.slider}></span>
                </label>
            </div>
            <p className={styles.description}>
                Gece 04:00'te boşa giden reklam bütçenizi uyutur; maaş günleri ve öğlen prime-time saatlerinde TBM'yi 5 katına çıkararak rakipleri ekrandan siler.
            </p>

            <div className={styles.radarVisual}>
                <div className={styles.radarTimeRange}>
                    <div className={styles.timeBlock} style={{ opacity: zeusActive ? 0.2 : 0.8 }}>00:00 - 08:00 (Uyku)</div>
                    <div className={styles.timeBlock} style={{ opacity: zeusActive ? 0.6 : 0.8 }}>08:00 - 18:00 (Normal)</div>
                    <div className={styles.timeBlock} style={{
                        background: zeusActive ? 'var(--danger-main)' : '',
                        color: zeusActive ? '#fff' : '',
                        fontWeight: zeusActive ? 'bold' : 'normal',
                        boxShadow: zeusActive ? '0 0 10px rgba(239,68,68,0.5)' : 'none'
                    }}>
                        18:00 - 23:59 (Zeus Saldırısı)
                    </div>
                </div>
            </div>
            <div className={styles.metricsBox}>
                <span>Tasarruf Edilen TBM: <strong>450 TL/Gün</strong></span>
                <span>Zeus ROI: <strong>+350%</strong> (Akşam Kuşağı)</span>
            </div>
        </div>
    );
}

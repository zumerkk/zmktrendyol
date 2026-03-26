"use client";

import React from "react";
import OosSniper from "../../../components/god-mode/OosSniper";
import HijackerDefense from "../../../components/god-mode/HijackerDefense";
import ZeusRadar from "../../../components/god-mode/ZeusRadar";
import ArbitrageList from "../../../components/god-mode/ArbitrageList";

export default function GodModePage() {
    return (
        <div className="p-8">
            <header className="mb-8" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '20px' }}>
                <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    God Mode ⚡
                </h1>
                <p className="text-gray-500 mt-2">
                    Piyasanın kontrolü tamamen sizde. Bu sekmedeki efsanevi algoritmalar adil rekabet yasalarını esneterek sizi pazarın mutlak hakimi yapar.
                    <br />
                    <span style={{ fontSize: '0.85rem', color: 'var(--danger-main)', fontWeight: 'bold' }}>
                        DİKKAT: Bu özellikler sadece Enterprise SaaS planlarına açıktır. Rakiplerde yıkıcı etkiler yaratabilir.
                    </span>
                </p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                {/* Market Dominance Row */}
                <OosSniper />
                <ZeusRadar />

                {/* Defense & Supply Row */}
                <HijackerDefense />
                <ArbitrageList />
            </div>
        </div>
    );
}

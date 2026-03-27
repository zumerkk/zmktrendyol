"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InsightsPage() {
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data: insights, isLoading } = useQuery({
    queryKey: ["command-center"],
    queryFn: () => api.get("/command-center/insights"),
    enabled: isAuthenticated(),
  });

  const { data: health } = useQuery({
    queryKey: ["quick-health"],
    queryFn: () => api.get("/intelligence/health"),
    enabled: isAuthenticated(),
  });

  const { data: gamification } = useQuery({
    queryKey: ["gamification"],
    queryFn: () => api.get("/intelligence/gamification"),
    enabled: isAuthenticated(),
  });

  const insightList: any[] = Array.isArray(insights) ? insights : insights?.insights || [];
  const healthData: any = health || {};
  const gameData: any = gamification || {};

  if (isLoading) {
    return (
      <div className="page-content" style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>💡</div>
        <div style={{ color: "var(--text-secondary)" }}>İçgörüler yükleniyor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title" style={{ color: "var(--accent-warning)" }}>💡 Bugün Ne Yapmalıyım?</h1>
        <p className="page-subtitle">AI destekli aksiyon önerileri ve mağaza sağlık skoru</p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Mağaza Sağlık Skoru</div>
            <div className="kpi-value" style={{
              color: (healthData.score || 0) > 70 ? "#22c55e" : (healthData.score || 0) > 40 ? "#f59e0b" : "#ef4444"
            }}>
              {healthData.score || 0}/100
            </div>
            <div className="kpi-source">Kaynak: <span className="source-badge zmk-engine">ZMK</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Bekleyen Aksiyon</div>
            <div className="kpi-value">{insightList.length}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Seviye</div>
            <div className="kpi-value">
              {typeof gameData.level === "object" && gameData.level
                ? `${gameData.level.icon || ""} ${gameData.level.name || "Bronze"}`
                : gameData.level || 1}
            </div>
            <div className="kpi-source">Kaynak: <span className="source-badge zmk-engine">ZMK</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">XP</div>
            <div className="kpi-value">{gameData.xp || 0}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge zmk-engine">ZMK</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🎯 Bugünkü Aksiyonlar</div>
            <span className="source-badge zmk-engine">AI</span>
          </div>
          {insightList.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              ✅ Şu an yapılacak acil aksiyon yok — Tebrikler!
            </div>
          ) : (
            insightList.slice(0, 10).map((ins: any, i: number) => (
              <div key={i} style={{
                padding: "16px", margin: "8px 0", borderRadius: 8,
                background: "rgba(99,102,241,0.05)", borderLeft: `4px solid ${
                  ins.priority === "critical" ? "#ef4444" : ins.priority === "high" ? "#f59e0b" : "#6366f1"
                }`
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                  {ins.title || ins.type || "Aksiyon"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {ins.description || ins.message || ""}
                </div>
                {ins.category && (
                  <span className="source-badge api" style={{ marginTop: 8, display: "inline-block" }}>
                    {ins.category}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

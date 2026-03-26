"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuditPage() {
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const { data: usage } = useQuery({
    queryKey: ["usage-stats"],
    queryFn: () => api.get("/intelligence/usage"),
    enabled: isAuthenticated(),
  });

  const { data: routes } = useQuery({
    queryKey: ["system-routes"],
    queryFn: () => api.get("/system/routes"),
    enabled: isAuthenticated(),
  });

  const usageData: any = usage || {};
  const routeList: any[] = Array.isArray(routes) ? routes : routes?.routes || [];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">📋 Denetim İzleri</h1>
        <p className="page-subtitle">Kullanım istatistikleri ve API rotaları</p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">API Çağrısı</div>
            <div className="kpi-value">{usageData.apiCalls || usageData.totalRequests || 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">AI Kullanımı</div>
            <div className="kpi-value">{usageData.aiGenerations || 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Toplam Rota</div>
            <div className="kpi-value">{routeList.length}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🛣️ API Rotaları ({routeList.length})</div>
            <span className="source-badge api">SYSTEM</span>
          </div>
          {routeList.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr><th>Method</th><th>Path</th></tr>
              </thead>
              <tbody>
                {routeList.slice(0, 30).map((r: any, i: number) => (
                  <tr key={i}>
                    <td>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: "monospace",
                        background: r.method === "GET" ? "rgba(34,197,94,0.15)" : r.method === "POST" ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.15)",
                        color: r.method === "GET" ? "#22c55e" : r.method === "POST" ? "#3b82f6" : "#ef4444"
                      }}>
                        {r.method}
                      </span>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                      {r.path}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              Rota bilgisi yükleniyor...
            </div>
          )}
        </div>
      </div>
    </>
  );
}

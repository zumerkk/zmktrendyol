"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isAuthenticated } from "../../../lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AIPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => { if (!isAuthenticated()) router.push("/login"); }, [router]);

  const [prompt, setPrompt] = useState("");

  const { data: usage } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => api.get("/ai/usage"),
    enabled: isAuthenticated(),
  });

  const { data: sessions } = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: () => api.get("/intelligence/chat/sessions"),
    enabled: isAuthenticated(),
  });

  const generateMutation = useMutation({
    mutationFn: (input: any) => api.post("/ai/generate", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-usage"] }),
  });

  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    const res = await generateMutation.mutateAsync({
      scenario: "title_optimize",
      input: { title: prompt, category: "Genel" },
    });
    setResult(res);
  };

  const usageData: any = usage || {};
  const sessionList: any[] = Array.isArray(sessions) ? sessions : [];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🤖 AI Asistan</h1>
        <p className="page-subtitle">ClawBot AI — 4 Sağlayıcı (OpenAI, Anthropic, Gemini, Groq)</p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">AI Kullanım</div>
            <div className="kpi-value">{usageData.totalRequests || usageData.requestsToday || 0}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Kalan Hak</div>
            <div className="kpi-value">{usageData.remaining ?? "∞"}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Sohbet Oturumu</div>
            <div className="kpi-value">{sessionList.length}</div>
            <div className="kpi-source">Kaynak: <span className="source-badge api">API</span></div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">⚡ Başlık Optimizasyonu</div>
              <span className="source-badge zmk-engine">AI</span>
            </div>
            <div style={{ padding: 16 }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ürün başlığını yazın — AI optimize etsin..."
                style={{
                  width: "100%", minHeight: 80, padding: 12, borderRadius: 8,
                  border: "1px solid var(--border-primary)", background: "var(--bg-secondary)",
                  color: "var(--text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box"
                }}
              />
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                style={{
                  marginTop: 12, padding: "10px 24px", borderRadius: 8, border: "none",
                  background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  opacity: generateMutation.isPending ? 0.7 : 1
                }}
              >
                {generateMutation.isPending ? "⏳ Üretiliyor..." : "🚀 AI ile Optimize Et"}
              </button>

              {result && (
                <div style={{
                  marginTop: 16, padding: 16, borderRadius: 8,
                  background: "rgba(99,102,241,0.08)", border: "1px solid var(--border-accent)"
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--accent-primary-light)" }}>
                    AI Önerileri:
                  </div>
                  {(result.variations || [result.output || result]).map((v: any, i: number) => (
                    <div key={i} style={{ padding: "6px 0", fontSize: 13, color: "var(--text-primary)" }}>
                      {i + 1}. {typeof v === "string" ? v : JSON.stringify(v)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">💬 Son Sohbetler</div>
              <span className="source-badge api">API</span>
            </div>
            {sessionList.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Henüz sohbet başlatılmadı
              </div>
            ) : (
              sessionList.slice(0, 5).map((s: any) => (
                <div key={s.id} style={{
                  padding: "12px 16px", borderBottom: "1px solid var(--border-primary)"
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                    {s.title || "Yeni Sohbet"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {s.updatedAt ? new Date(s.updatedAt).toLocaleString("tr-TR") : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

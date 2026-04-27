"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant" | "system"; content: string; timestamp?: string };

export default function AIPage() {
  const { ready, authed } = useAuth();
  const qc = useQueryClient();
  const chatRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"chat" | "title" | "seo" | "price">("chat");
  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: "Ben ClawBot AI — e-ticaret stratejisti. Ürün optimizasyonu, fiyatlandırma, SEO ve rakip analizi konusunda size yardımcı olabilirim. Nasıl yardımcı olabilirim?" }
  ]);
  const [input, setInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [titleResult, setTitleResult] = useState<any>(null);

  const { data: usage } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => api.get("/ai/usage"),
    enabled: authed,
  });

  const chatMut = useMutation({
    mutationFn: (msg: string) => api.post("/intelligence/chat", { message: msg }),
  });

  const titleMut = useMutation({
    mutationFn: (input: any) => api.post("/ai/generate", input),
  });

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
      const res = await chatMut.mutateAsync(input);
      const reply = res?.response || res?.message || res?.content || (typeof res === "string" ? res : "Yanıt alınamadı.");
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ AI servisi şu anda yanıt veremiyor. API anahtarlarınızı kontrol edin (OPENAI_API_KEY veya GOOGLE_AI_API_KEY).",
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const handleTitleOptimize = async () => {
    if (!titleInput.trim()) return;
    try {
      const res = await titleMut.mutateAsync({ scenario: "title_optimize", input: { title: titleInput, category: "Genel" } });
      setTitleResult(res);
    } catch {
      setTitleResult({ error: "AI servisi yanıt vermedi." });
    }
  };

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!ready) return null;

  const usageData: any = usage || {};

  const tabs = [
    { key: "chat", label: "💬 AI Sohbet", icon: "💬" },
    { key: "title", label: "📝 Başlık Optimizasyonu", icon: "📝" },
    { key: "seo", label: "🔍 SEO Analizi", icon: "🔍" },
    { key: "price", label: "💰 Fiyat Stratejisi", icon: "💰" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
              }}>🤖</div>
              ClawBot AI Asistan
            </h1>
            <p className="page-subtitle">
              GPT-4o · Claude · Gemini · Groq — Multi-AI E-Ticaret Zekâsı
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
            <div style={{ padding: "6px 12px", borderRadius: 8, background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
              Kullanım: <strong style={{ color: "#6366f1" }}>{usageData.totalRequests || usageData.requestsToday || 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: "8px 16px", borderRadius: 10,
              border: activeTab === tab.key ? "1px solid rgba(99,102,241,0.5)" : "1px solid var(--border-primary)",
              background: activeTab === tab.key ? "rgba(99,102,241,0.1)" : "var(--bg-secondary)",
              color: activeTab === tab.key ? "#6366f1" : "var(--text-secondary)",
              fontWeight: activeTab === tab.key ? 700 : 500, fontSize: 13, cursor: "pointer",
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100vh - 320px)", minHeight: 400 }}>
          {/* Messages */}
          <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 12,
              }}>
                <div style={{
                  maxWidth: "75%", padding: "12px 16px", borderRadius: 14,
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, #6366f1, #818cf8)"
                    : msg.role === "system"
                      ? "rgba(234,179,8,0.08)"
                      : "var(--bg-secondary)",
                  color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                  border: msg.role === "system" ? "1px solid rgba(234,179,8,0.2)" : msg.role === "assistant" ? "1px solid var(--border-primary)" : "none",
                }}>
                  {msg.role !== "user" && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: msg.role === "system" ? "#eab308" : "#6366f1", marginBottom: 4 }}>
                      {msg.role === "system" ? "🤖 ClawBot" : "🤖 AI"}
                    </div>
                  )}
                  <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{msg.content}</div>
                  {msg.timestamp && (
                    <div style={{ fontSize: 9, color: msg.role === "user" ? "rgba(255,255,255,0.6)" : "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
                      {new Date(msg.timestamp).toLocaleTimeString("tr-TR")}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatMut.isPending && (
              <div style={{ display: "flex", gap: 4, paddingLeft: 20 }}>
                {[0, 1, 2].map((d) => (
                  <div key={d} style={{
                    width: 8, height: 8, borderRadius: "50%", background: "#6366f1",
                    animation: `bounce 1.2s ${d * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-primary)", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Bir soru sorun... (Ürün analizi, fiyat önerisi, SEO tavsiyesi)"
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 12,
                border: "1px solid var(--border-primary)", background: "var(--bg-secondary)",
                color: "var(--text-primary)", fontSize: 14, outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={chatMut.isPending || !input.trim()}
              style={{
                padding: "12px 20px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #6366f1, #818cf8)",
                color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                opacity: !input.trim() ? 0.5 : 1,
              }}
            >Gönder</button>
          </div>
        </div>
      )}

      {/* Title Tab */}
      {activeTab === "title" && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title">📝 AI Başlık Optimizasyonu</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Ürün başlığınızı yapıştırın — AI, Trendyol SEO kurallarına uygun optimize edilmiş versiyonlar üretsin.
          </p>
          <textarea
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Örn: Adidas VL Court 3.0 Unisex Spor Ayakkabı ID9184 Beyaz Günlük Sneaker"
            style={{
              width: "100%", minHeight: 80, padding: 14, borderRadius: 10, marginTop: 12,
              border: "1px solid var(--border-primary)", background: "var(--bg-secondary)",
              color: "var(--text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleTitleOptimize}
            disabled={titleMut.isPending || !titleInput.trim()}
            style={{
              marginTop: 12, padding: "12px 28px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >{titleMut.isPending ? "⏳ Üretiliyor..." : "🚀 AI ile Optimize Et"}</button>

          {titleResult && !titleResult.error && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#6366f1" }}>✨ AI Önerileri:</div>
              {(titleResult.variations || [titleResult.output || titleResult]).map((v: any, i: number) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: i < 4 ? "1px solid rgba(99,102,241,0.1)" : "none", fontSize: 13 }}>
                  <span style={{ fontWeight: 800, color: "#6366f1", marginRight: 8 }}>{i + 1}.</span>
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </div>
              ))}
            </div>
          )}
          {titleResult?.error && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 13 }}>
              ⚠️ {titleResult.error}
            </div>
          )}
        </div>
      )}

      {/* SEO Tab */}
      {activeTab === "seo" && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title">🔍 SEO Analiz Merkezi</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            {[
              { title: "Başlık Optimizasyonu", desc: "Ürün başlıklarınızı Trendyol arama algoritmasına uygun optimize edin", icon: "📝", color: "#6366f1" },
              { title: "Anahtar Kelime Analizi", desc: "Kategori bazlı en çok aranan kelimeleri bulun", icon: "🔑", color: "#10b981" },
              { title: "Açıklama Üretici", desc: "AI ile SEO uyumlu ürün açıklamaları oluşturun", icon: "📄", color: "#f97316" },
              { title: "Görsel Optimizasyonu", desc: "Ürün görsellerinizin kalitesini ve SEO etiketlerini analiz edin", icon: "🖼️", color: "#8b5cf6" },
            ].map((tool) => (
              <div key={tool.title} style={{
                padding: 20, borderRadius: 14,
                background: `${tool.color}08`, border: `1px solid ${tool.color}20`,
                cursor: "pointer", transition: "transform 0.2s",
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{tool.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: tool.color }}>{tool.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{tool.desc}</div>
                <div style={{ fontSize: 11, color: tool.color, marginTop: 8, fontWeight: 600 }}>Yakında →</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Tab */}
      {activeTab === "price" && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title">💰 Dinamik Fiyat Stratejisi</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            {[
              { title: "Fiyat Savaşı Simülasyonu", desc: "Rakip fiyat düşürdüğünde optimal karşılığı hesapla", icon: "⚔️", color: "#ef4444" },
              { title: "Game Theory Fiyatlama", desc: "Nash dengesi ile optimal fiyat noktasını belirle", icon: "🎮", color: "#6366f1" },
              { title: "Elastikiyet Analizi", desc: "Fiyat değişiminin satış hacmine etkisini tahmin et", icon: "📈", color: "#10b981" },
              { title: "A/B Test Önerisi", desc: "Farklı fiyat noktalarını test etmek için plan oluştur", icon: "🧪", color: "#f97316" },
            ].map((tool) => (
              <div key={tool.title} style={{
                padding: 20, borderRadius: 14,
                background: `${tool.color}08`, border: `1px solid ${tool.color}20`,
                cursor: "pointer",
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{tool.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: tool.color }}>{tool.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{tool.desc}</div>
                <div style={{ fontSize: 11, color: tool.color, marginTop: 8, fontWeight: 600 }}>Yakında →</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

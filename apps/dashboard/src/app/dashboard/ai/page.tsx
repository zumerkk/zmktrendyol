"use client";

import { useState } from "react";

export default function AiPage() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([
    {
      role: "assistant",
      text: 'Merhaba! 👋 Ben ZMK AI Asistan. Mağazanız hakkında her şeyi sorun.\n\nÖrnek sorular:\n• "Geçen hafta en çok ne sattım?"\n• "Hangi ürümlerin iade oranı yüksek?"\n• "Rakipler ne fiyat veriyor?"',
    },
  ]);

  const quickActions = [
    {
      icon: "📝",
      label: "Listing Optimize Et",
      desc: "Ürün başlık ve açıklamalarını AI ile iyileştir",
    },
    {
      icon: "⭐",
      label: "Yorum Analizi",
      desc: "Rakip yorumlarını analiz et, fırsat bul",
    },
    {
      icon: "🧪",
      label: "A/B Test Başlat",
      desc: "AI varyasyonlarla hangi başlık daha iyi test et",
    },
    {
      icon: "🎯",
      label: "Optimal Fiyat",
      desc: "Game Theory ile en iyi fiyatı hesapla",
    },
    {
      icon: "📊",
      label: "Satış Tahmini",
      desc: "ML ile gelecek hafta satış tahmini al",
    },
    {
      icon: "👥",
      label: "Müşteri Segmentleri",
      desc: "VIP/Sadık/Risk segmentlerini gör",
    },
  ];

  const handleSend = () => {
    if (!message.trim()) return;
    setChat((prev) => [
      ...prev,
      { role: "user" as const, text: message },
      {
        role: "assistant" as const,
        text: '🔄 AI yanıt üretmek için OpenAI API key gerekli. ".env" dosyasına OPENAI_API_KEY ekleyip sistemi yeniden başlatın.',
      },
    ]);
    setMessage("");
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">🤖 AI Asistan & Zekâ Merkezi</h1>
        <p className="page-subtitle">
          Yapay zekâ destekli öneriler, analiz ve optimizasyon
        </p>
      </div>

      <div className="page-content animate-fade-in">
        <div className="grid-2">
          {/* Chat Panel */}
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", minHeight: 500 }}
          >
            <div className="card-header">
              <div className="card-title">💬 Chat Asistan</div>
              <span className="source-badge estimate">AI</span>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                marginBottom: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {chat.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "12px 16px",
                    borderRadius: 12,
                    background:
                      msg.role === "user"
                        ? "rgba(99, 102, 241, 0.2)"
                        : "var(--bg-tertiary)",
                    border: `1px solid ${msg.role === "user" ? "var(--border-accent)" : "var(--border-default)"}`,
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    color: "var(--text-secondary)",
                  }}
                >
                  {msg.text}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Mağazanız hakkında bir şey sorun..."
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 8,
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button onClick={handleSend} className="btn btn-primary">
                Gönder
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title">⚡ Hızlı AI Aksiyonlar</div>
              </div>
              <div className="intel-action-grid">
                {quickActions.map((a, i) => (
                  <div key={i} className="intel-action-btn">
                    <span className="icon">{a.icon}</span>
                    <strong style={{ fontSize: 13 }}>{a.label}</strong>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        textAlign: "center",
                      }}
                    >
                      {a.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">🔑 AI Durum</div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    OpenAI (GPT-4o)
                  </span>
                  <span className="status-badge pending">⚠️ Key Gerekli</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Google Gemini
                  </span>
                  <span className="status-badge pending">⚠️ Key Gerekli</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Anthropic Claude
                  </span>
                  <span className="status-badge inactive">Opsiyonel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

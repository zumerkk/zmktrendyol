"use client";

export default function InsightsPage() {
  // Demo Data - Will be fetched from /api/command-center/insights
  const insights = [
    {
      id: "1",
      type: "loss_making",
      priority: 1,
      title: "Kritik Zarar: Kadın Bot Süet",
      description:
        "Son 30 günde 203 adet sattınız ama ₺3,240 zarar ettiniz. (Marj: -%2)",
      suggestedAction: "Reklam bütçesini %50 düşür veya fiyatı ₺850 yap.",
      isDismissed: false,
    },
    {
      id: "2",
      type: "out_of_stock",
      priority: 2,
      title: "Stok Tükeniyor: Kış Montu Premium XL",
      description: "Mevcut stok 12 adet. İvmenize göre 2 gün içinde bitebilir.",
      suggestedAction:
        "Acil stok girin veya liste fiyatını geçici olarak %15 artırın.",
      isDismissed: false,
    },
    {
      id: "3",
      type: "buybox_lost",
      priority: 2,
      title: "Buybox Kaybedildi: Spor Ayakkabı Unisex",
      description:
        "Rakip X stoklara girdi ve fiyatı ₺10 aşağı çekerek Buyboxı aldı.",
      suggestedAction:
        "Fiyatı ₺535 yaparsanız Buyboxı tahmini %90 ihtimalle geri alırsınız.",
      isDismissed: false,
    },
    {
      id: "4",
      type: "review_risk",
      priority: 3,
      title: "Artan İade Riski: Çocuk Eşofman",
      description:
        'Son 5 yorumdan 3 ünde "beden küçük" şikayeti var. İade oranı %5 ten %8 e çıktı.',
      suggestedAction: 'Ürün açıklamasına "1 beden büyük alın" notunu ekleyin.',
      isDismissed: false,
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "loss_making":
        return "💸";
      case "out_of_stock":
        return "📦";
      case "buybox_lost":
        return "⚔️";
      case "review_risk":
        return "⭐";
      default:
        return "💡";
    }
  };

  const getColor = (priority: number) => {
    switch (priority) {
      case 1:
        return "var(--accent-danger)"; // Critical
      case 2:
        return "var(--accent-warning)"; // High
      case 3:
        return "var(--accent-primary-light)"; // Medium
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1
            className="page-title"
            style={{
              color: "var(--accent-warning)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            ⚡ Bugün Ne Yapmalıyım?
            <span
              className="source-badge zmk-engine"
              style={{ fontSize: 10, padding: "4px 8px" }}
            >
              ZMK ENGINE
            </span>
          </h1>
          <p className="page-subtitle">
            Yapay zekâ ve algoritma destekli öncelikli eylem planınız
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{
            background: "var(--accent-warning)",
            color: "#0a0e1a",
            fontWeight: "bold",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ marginRight: 6 }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-5.44-5.44" />
          </svg>
          Analizi Güncelle
        </button>
      </div>

      <div className="page-content animate-fade-in">
        <div className="grid-1" style={{ maxWidth: 1000 }}>
          {insights.map((i) => (
            <div
              key={i.id}
              className="card insight-card"
              style={{
                borderLeft: `4px solid ${getColor(i.priority)}`,
                marginBottom: 16,
              }}
            >
              <div
                style={{ display: "flex", gap: 20, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    fontSize: 32,
                    background: "var(--bg-card-hover)",
                    padding: 16,
                    borderRadius: 12,
                  }}
                >
                  {getIcon(i.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: 8,
                      }}
                    >
                      {i.title}
                    </h3>
                    <span
                      className="status-badge error"
                      style={{
                        background: getColor(i.priority) + "20",
                        color: getColor(i.priority),
                        border: "none",
                      }}
                    >
                      {i.priority === 1
                        ? "Kritik Öncelik"
                        : i.priority === 2
                          ? "Yüksek Öncelik"
                          : "Öncelikli"}
                    </span>
                  </div>
                  <p
                    style={{
                      color: "var(--text-muted)",
                      fontSize: 14,
                      marginBottom: 16,
                      lineHeight: 1.5,
                    }}
                  >
                    {i.description}
                  </p>
                  <div
                    style={{
                      background: "rgba(99, 102, 241, 0.1)",
                      border: "1px solid rgba(99, 102, 241, 0.2)",
                      padding: "12px 16px",
                      borderRadius: 8,
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ color: "var(--accent-primary-light)" }}>
                      💡
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--accent-primary-light)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          marginBottom: 2,
                        }}
                      >
                        Önerilen Aksiyon
                      </div>
                      <div
                        style={{
                          color: "var(--text-primary)",
                          fontWeight: 500,
                          fontSize: 14,
                        }}
                      >
                        {i.suggestedAction}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minWidth: 140,
                  }}
                >
                  <button className="btn btn-primary" style={{ width: "100%" }}>
                    Uygula
                  </button>
                  <button
                    className="btn"
                    style={{
                      width: "100%",
                      background: "var(--bg-main)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    Yoksay
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

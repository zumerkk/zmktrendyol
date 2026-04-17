"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../lib/useAuth";
import { api } from "../../../lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Target = {
  id: string;
  url: string;
  title?: string | null;
  targetMinPrice?: string | null;
  ourProductId?: string | null;
  lastScanAt?: string | null;
  isActive: boolean;
};

export default function RivalsPage() {
  const { ready, authed } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const targetsQ = useQuery({
    queryKey: ["rivals-targets"],
    queryFn: () => api.get<Target[]>("/rivals/targets"),
    enabled: authed,
  });

  const targets = (targetsQ.data || []) as Target[];
  useEffect(() => {
    if (!selectedId && targets.length) setSelectedId(targets[0].id);
  }, [selectedId, targets]);

  const summaryQ = useQuery({
    queryKey: ["rivals-summary", selectedId],
    queryFn: () => api.get(`/rivals/targets/${selectedId}/summary`),
    enabled: authed && !!selectedId,
    refetchInterval: 30_000,
  });

  const profitQ = useQuery({
    queryKey: ["rivals-profit", selectedId],
    queryFn: () => api.get(`/rivals/targets/${selectedId}/profit`),
    enabled: authed && !!selectedId,
    refetchInterval: 60_000,
  });

  const scanNow = useMutation({
    mutationFn: () => api.post(`/rivals/targets/${selectedId}/scan-now`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["rivals-summary", selectedId] });
      await qc.invalidateQueries({ queryKey: ["rivals-targets"] });
    },
  });

  const addTarget = useMutation({
    mutationFn: (body: { url: string; targetMinPrice?: number }) => api.post("/rivals/targets", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rivals-targets"] }),
  });

  const updateTarget = useMutation({
    mutationFn: (body: { id: string; targetMinPrice?: number; ourProductId?: string }) =>
      api.put(`/rivals/targets/${body.id}`, { targetMinPrice: body.targetMinPrice, ourProductId: body.ourProductId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rivals-targets"] });
      qc.invalidateQueries({ queryKey: ["rivals-profit", selectedId] });
    },
  });

  const [newUrl, setNewUrl] = useState("");
  const [newMin, setNewMin] = useState<string>("");

  const summary: any = summaryQ.data || {};
  const latestScan = summary.latestScan || null;
  const variants: any[] = latestScan?.variants || [];
  const alerts: any[] = summary.alerts || [];
  const decision: any = summary.decision || null;

  const fmtMoney = (n: any) => {
    const v = typeof n === "string" ? Number(n) : typeof n === "number" ? n : 0;
    return `₺${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
  };

  if (!ready) return null;
  if (targetsQ.isLoading) return <div className="page-content" style={{ padding: 40 }}>Yükleniyor…</div>;

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Rakip İstihbarat (Trendyol)</h1>
          <p className="page-subtitle">Link bazlı izleme · varyant bazında fiyat/stok · alarmlar · kural bazlı karar</p>
        </div>
        <button
          onClick={() => scanNow.mutate()}
          disabled={!selectedId || scanNow.isPending}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff", fontWeight: 700 }}
        >
          {scanNow.isPending ? "⏳ Taranıyor…" : "Şimdi Tara"}
        </button>
      </div>

      <div className="page-content" style={{ display: "grid", gridTemplateColumns: "320px 1fr 360px", gap: 16 }}>
        {/* Sol: Targets */}
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title">İzleme Listesi</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Trendyol ürün linki"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
            />
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <input
              value={newMin}
              onChange={(e) => setNewMin(e.target.value)}
              placeholder="Hedef alt sınır (₺)"
              style={{ width: 160, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
            />
            <button
              onClick={() => addTarget.mutate({ url: newUrl, targetMinPrice: newMin ? Number(newMin) : undefined })}
              disabled={!newUrl || addTarget.isPending}
              style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontWeight: 700 }}
            >
              {addTarget.isPending ? "⏳" : "+ Ekle"}
            </button>
          </div>

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {targets.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                style={{
                  textAlign: "left",
                  padding: "10px 10px",
                  borderRadius: 10,
                  border: selectedId === t.id ? "1px solid rgba(99,102,241,0.6)" : "1px solid var(--border-primary)",
                  background: selectedId === t.id ? "rgba(99,102,241,0.08)" : "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title || "Başlık henüz yok"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  {t.lastScanAt ? `Son tarama: ${new Date(t.lastScanAt).toLocaleString("tr-TR")}` : "Henüz taranmadı"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Orta: Analysis */}
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title">Ürün Analizi</div>
          {!latestScan ? (
            <div style={{ marginTop: 14, color: "var(--text-muted)" }}>Henüz tarama yok. "Şimdi Tara" ile başlat.</div>
          ) : (
            <>
              <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="kpi-card" style={{ minWidth: 220 }}>
                  <div className="kpi-label">En düşük fiyat</div>
                  <div className="kpi-value">{fmtMoney(latestScan.lowestPrice)}</div>
                </div>
                <div className="kpi-card" style={{ minWidth: 220 }}>
                  <div className="kpi-label">En yüksek fiyat</div>
                  <div className="kpi-value">{fmtMoney(latestScan.highestPrice)}</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="label">Varyantlar (numara bazlı)</div>
                <table className="data-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Numara</th>
                      <th>Fiyat</th>
                      <th>Stok sinyali</th>
                      <th>Güven</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>Varyant bulunamadı</td>
                      </tr>
                    ) : (
                      variants.map((v: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{v.variantKey}</td>
                          <td>{fmtMoney(v.salePrice)}</td>
                          <td>{String(v.stockSignal || "unknown")}</td>
                          <td>{Math.round((Number(v.stockConfidence || 0) * 100))}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Sağ: Alerts + Decision + Profit */}
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title">Aksiyon Merkezi</div>

          <div style={{ marginTop: 12 }}>
            <div className="label">Karar</div>
            <div style={{ marginTop: 8, padding: 12, borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)" }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{decision?.decision || "—"}</div>
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>
                {decision?.reasons && Array.isArray(decision.reasons) ? decision.reasons.join(" · ") : "Henüz gerekçe yok"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="label">Aktif alarmlar</div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Alarm yok</div>
              ) : (
                alerts.slice(0, 8).map((a: any) => (
                  <div key={a.id} style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)" }}>
                    <div style={{ fontWeight: 800, fontSize: 12 }}>{a.type}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{a.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="label">Bizim kâr (eşleştirilmiş ürün)</div>
            <div style={{ marginTop: 8, padding: 12, borderRadius: 10, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)" }}>
              {profitQ.isLoading ? (
                <div style={{ color: "var(--text-muted)" }}>Yükleniyor…</div>
              ) : (profitQ.data as any)?.mapped ? (
                <>
                  <div style={{ fontWeight: 800 }}>{(profitQ.data as any).product?.title}</div>
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    Bugün: <b>{fmtMoney((profitQ.data as any).day?.profit || 0)}</b> ·
                    7g: <b>{fmtMoney((profitQ.data as any).week?.profit || 0)}</b> ·
                    30g: <b>{fmtMoney((profitQ.data as any).month?.profit || 0)}</b>
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Bu rakip hedefi henüz bizim bir ürünle eşleştirilmemiş.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

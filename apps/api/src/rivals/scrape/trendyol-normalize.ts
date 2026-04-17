export function normalizeVariantKey(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(',', '.');
}

export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  // e.g. "1.299,99 TL" / "₺1.299,99"
  const cleaned = text
    .replace(/[^\d,.\s]/g, '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function stockSignalFromText(text: string | null | undefined): {
  signal: 'out_of_stock' | 'low' | 'medium' | 'high' | 'unknown';
  confidence: number;
} {
  const t = (text || '').toLowerCase();
  if (!t) return { signal: 'unknown', confidence: 0.2 };
  if (t.includes('tükendi') || t.includes('stokta yok')) return { signal: 'out_of_stock', confidence: 0.9 };
  const m = t.match(/son\s+(\d+)/);
  if (m) {
    const left = Number(m[1]);
    if (left <= 3) return { signal: 'low', confidence: 0.85 };
    if (left <= 10) return { signal: 'medium', confidence: 0.65 };
    return { signal: 'high', confidence: 0.55 };
  }
  if (t.includes('hızlı teslimat') || t.includes('bugün kargoda')) return { signal: 'high', confidence: 0.5 };
  return { signal: 'unknown', confidence: 0.3 };
}

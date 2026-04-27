# ZMK — Rakip Fiyat/Stok İstihbarat Paneli (Trendyol / Link-bazlı) — V1 Tasarım Dokümanı
Tarih: 2026-04-15  
Sürüm: v1 (MVP)  
Kapsam: **Sadece Trendyol, sadece kamusal erişim, link-bazlı izleme**  

## 1) Amaç
Bu doküman; Trendyol ürün linklerini düzenli tarayarak **fiyat / varyant (beden-numara) bazlı fiyat farkı / stok sinyali** çıkaran, değişimleri zaman damgasıyla kaydeden, alarm üreten ve satın alma ekibine **AL / İZLE / BEKLE / ALMA** kararı sunan “Rakip İstihbarat” panelinin V1 tasarımını tanımlar.

V1’in hedefi: “mükemmel tahmin” değil; **güvenilir veri toplama + değişim takibi + aksiyonlaştırma**.

## 2) Kapsam (V1)
### 2.1 Dahil
- Veri kaynağı: **Trendyol ürün sayfaları (kamusal)**
- İzleme: Kullanıcı panelden **ürün URL** ekler (otomatik ürün eşleştirme yok).
- Varyant bazlı veri: Numara/beden kırılımı + fiyat + stok sinyali
- Zaman serisi kayıt: tarama snapshot’ları + diffe dayalı change-event’ler
- Alarm motoru (kural bazlı)
- Karar motoru (kural bazlı) + gerekçe (en kritik 3 neden)
- Dashboard’da “Komuta Merkezi” tek ekran (A layout)

### 2.2 Hariç (V1 değil)
- Login gerektiren alanlar (kupon, üyeye özel sepet fiyatı, kişisel kampanya)
- CAPTCHA/blocked bypass (yasak)
- Otomatik ürün eşleştirme (farklı ilanları tek ürün altında normalize etme) — V2+
- Hepsiburada/N11/AmazonTR — V1 kapsam dışı
- “Kesin satış adedi” (V1’de sadece sinyal + güven skoru ile tahmin)

## 3) Uyum / Çalışma Kuralları
- Sadece **kamusal & yetkili erişim**: login gerektiren içerikler okunmaz.
- CAPTCHA, robots, rate-limit kısıtlarını aşmaya çalışma yok.
- Veri yoksa: **“tespit edilemedi”** olarak işaretlenir.
- Tahmin ile kesin bilgi ayrılır.

## 4) UX: Panel (A — Komuta Merkezi)
Route önerisi:
- `GET /dashboard/rivals` (yeni sayfa)

Ekran düzeni:
### 4.1 Sol panel — İzleme Listesi
- WatchTarget listesi
  - Ürün başlığı (kısa)
  - MerchantId / boutiqueId (varsa)
  - Son tarama zamanı + son durum (OK / Warning / Critical)
  - Hedef alt sınır fiyat (ürün bazlı)
- Aksiyonlar:
  - `+ Ürün Linki Ekle`
  - “Şimdi Tara”
  - Aktif/Pasif

### 4.2 Orta panel — Seçili ürün analizi
- Son tarama özeti: en düşük/en yüksek fiyat, stok sinyali özeti
- Timeline: fiyat değişimi (son 24s/7g)
- **Varyant tablosu (kritik)**:
  - Numara/Beden
  - Liste fiyat / indirimli fiyat (varsa)
  - Stok sinyali (tükendi/düşük/orta/yüksek + güven skoru)
  - Son değişim (↑↓, kapandı/açıldı)

### 4.3 Sağ panel — Alarm + Karar
- Aktif alarmlar
- Karar: `AL / İZLE / BEKLE / ALMA`
- Gerekçe (top 3)

## 5) Backend: Yeni Modül (V1)
Yeni bir NestJS modülü eklenir:
- `apps/api/src/rivals/`
  - `rivals.module.ts`
  - `rivals.controller.ts`
  - `rivals.service.ts`
  - `scrape/trendyol.parser.ts` (kamusal sayfa parse)
  - `scheduler/rivals.scheduler.ts` (15dk cron + jitter)
  - `decision/decision.engine.ts` (kural motoru)
  - `alerts/alerts.engine.ts` (kural motoru)

## 6) Veri Modeli (Prisma) — V1
> Not: İsimler öneridir. Mevcut `Competitor*` tablolarıyla çakışmayı önlemek için `Rival*` prefix’i kullanılır.

### 6.1 Ana tablolar
**RivalWatchTarget**
- `id` (uuid)
- `tenantId`
- `url` (unique per tenant)
- `brand` (örn. adidas) *(sayfadan veya kullanıcıdan)*
- `title` *(sayfadan)*
- `merchantId` *(URL param veya sayfa sinyali)*
- `boutiqueId` *(URL param veya sayfa sinyali)*
- `targetMinPrice` (Decimal, ürün bazlı eşik)
- `isActive` (bool)
- `scanIntervalMinutes` (int, default 15)
- `createdAt`, `updatedAt`

**RivalScan**
- `id`
- `tenantId`
- `targetId`
- `status` (success | blocked | failed)
- `httpStatus` (int, optional)
- `fetchedAt`
- `pageTitle`
- `currency` (TRY)
- `lowestPrice`, `highestPrice` (Decimal, snapshot içinden)
- `rawSignals` (Json) *(kampanya etiketi var mı, “sepette” ibaresi var mı vb.)*

**RivalVariantScan**
- `id`
- `scanId`
- `variantKey` (örn. “42” veya “42/Black”) — normalize string
- `listPrice` (Decimal?, optional)
- `salePrice` (Decimal?, optional)
- `stockSignal` (enum: out_of_stock | low | medium | high | unknown)
- `stockConfidence` (0..1)
- `availabilityText` (string?, örn. “Son 3 ürün”)

**RivalChangeEvent**
- `id`
- `tenantId`
- `targetId`
- `type` (price_down | price_up | variant_closed | variant_opened | seller_changed | campaign_started | campaign_ended | basket_signal_changed)
- `payload` (Json)
- `createdAt`

**RivalAlert**
- `id`
- `tenantId`
- `targetId`
- `severity` (info | warning | critical)
- `type` (price_below_target | abnormal_variant_spread | low_stock_started | variant_opened | mass_variant_closed | campaign_signal)
- `message`
- `payload` (Json)
- `isActive` (bool) *(aktif alarm mı, çözüldü mü)*
- `createdAt`, `updatedAt`

**RivalDecision**
- `id`
- `tenantId`
- `targetId`
- `decision` (AL | IZLE | BEKLE | ALMA)
- `reasons` (Json array, top 3)
- `score` (0..100) *(opsiyonel ama debug için faydalı)*
- `createdAt`

## 7) API Tasarımı (V1)
Base prefix: `/api` (zaten globalPrefix)

### 7.1 WatchTarget yönetimi
- `GET /api/rivals/targets` → tenant’ın hedefleri
- `POST /api/rivals/targets` → `{ url, targetMinPrice?, scanIntervalMinutes? }`
- `PUT /api/rivals/targets/:id` → minPrice/interval/active update
- `DELETE /api/rivals/targets/:id`

### 7.2 Tarama & sonuçlar
- `POST /api/rivals/targets/:id/scan-now`
- `GET /api/rivals/targets/:id/summary` → son scan + aktif alarm + son karar
- `GET /api/rivals/targets/:id/scans?limit=...`
- `GET /api/rivals/targets/:id/events?days=...`
- `GET /api/rivals/targets/:id/alerts?status=active|all`

## 8) Tarama (Scrape) stratejisi (V1)
### 8.1 Scheduler
- Her target için 15 dk (tenant başına ayrı jitter önerilir).
- İlk V1: Cron + sırayla (concurrency düşük) → rate-limit riskini azaltır.
- “blocked/429” durumunda exponential backoff ve target status güncelleme.

### 8.2 Trendyol parser
Kamusal sayfadan alınabilecekler:
- Ürün adı / marka
- Fiyat sinyali (görünen fiyat)
- Varyantlar (beden/numara) ve “stokta/kapalı” sinyalleri (UI text)
- “sepette” ibaresi gibi kampanya sinyalleri (fiyat yoksa `basketPrice = null`)

> Teknik not: Trendyol sayfa yapısı değişken olabileceği için parser “best-effort” olmalı ve çıktı her alan için `source`/`confidence` verebilmelidir.

## 9) Alarm Kuralları (V1)
Kural seti (minimum):
1) **price_below_target**  
   - Koşul: `lowestPrice < targetMinPrice`
   - Severity: critical
2) **abnormal_variant_spread**  
   - Koşul: varyant fiyatlarının median’ına göre sapma (örn. %10+) veya max-min farkı eşiği
   - Severity: warning/critical (sapmaya göre)
3) **low_stock_started / variant_closed / variant_opened**  
   - Koşul: önceki taramaya göre stok sinyali kötüleşti veya beden kapandı/açıldı
4) **campaign_signal**  
   - Koşul: sayfada kampanya/sepette sinyali başladı/bitti (fiyat net değilse sadece sinyal)

## 10) Karar Motoru (V1 — Kural Bazlı)
Karar, şeffaf bir skorlamayla üretilir:
- Skor girdileri (örnek):
  - Fiyat hedef alt sınırın altına düştü → güçlü AL sinyali
  - Varyant spread anormal → fırsat (bazı numaralar ucuz) → AL/İZLE
  - Stok hızla kapanıyor (kapanan varyant sayısı ↑) → BEKLE yerine AL’a itebilir
  - Çok sık fiyat oynuyor + kampanya baskısı → İZLE/BEKLE

Çıktı:
- `decision`: AL/İZLE/BEKLE/ALMA
- `reasons`: top 3, kısa ve aksiyon odaklı

## 11) Başlangıç Seed (kullanıcı sağladı)
Tenant içine V1 demo hedefleri olarak eklenir:
1) https://www.trendyol.com/adidas/tensaur-sport-2-0-beyaz-siyah-unisex-sneaker-gw6422-p-343284968?boutiqueId=690236&merchantId=968
2) https://www.trendyol.com/adidas/duramo-rc-u-p-760956451?boutiqueId=61&merchantId=106971
3) https://www.trendyol.com/adidas/cloudfoam-comfy-spor-ayakkabi-siyah-beyaz-erkek-ih2973-p-828498297?boutiqueId=61&merchantId=416518
4) https://www.trendyol.com/adidas/vl-court-3-0-unisex-spor-ayakkabi-id9184-p-887265545?boutiqueId=61&merchantId=416518

## 12) Test Stratejisi (V1)
Minimum test paketi:
- Parser unit test: fixture HTML → normalize edilmiş output
- Alerts engine unit test: “önce/sonra” snapshot ile doğru alarm üretimi
- Decision engine unit test: skor→karar doğrulama
- E2E: (Supertest)
  - Target create/list
  - scan-now → scan + variants kaydı
  - summary endpoint → wraps + tenant isolation

## 13) Güvenlik / İzolasyon
- Tüm `Rival*` tabloları `tenantId` ile filtrelenir.
- ID bazlı endpoint’lerde: `where: { id, tenantId }` zorunludur.
- Admin-only endpoint yoksa bile “scan-now” abuse’a açıktır → throttling / per-tenant rate-limit önerilir.

## 14) Açık Sorular (V1 sonrası)
- “Satış hacmi tahmini” sinyalleri: Trendyol’da yorum/puan artışını kamusal sayfadan güvenilir okuyabiliyor muyuz? (Okunamazsa V1’de “tespit edilemedi” kalır.)
- Variant extraction tutarlılığı: numara listesi her sayfada aynı DOM pattern mi?


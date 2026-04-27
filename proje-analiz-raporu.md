# ZMK Trendyol Platform — Proje Analiz Raporu
Tarih: 2026-04-15

## 1) Yönetici Özeti
Bu repo, Trendyol odaklı (ve ek olarak Hepsiburada / N11 / Amazon TR entegrasyonları içeren) **AI destekli e-ticaret mağaza yönetim platformu**dur. Temel hedef; satıcıların **ürün/sipariş/stok/fiyat** operasyonlarını otomatikleştirmek, **KPI & kârlılık analitiği** üretmek, **rakip ve buybox istihbaratı** sağlamak, **otomasyon ve “God Mode”** gibi ileri seviye aksiyon motorlarıyla karar alma süreçlerini hızlandırmaktır.

Monorepo yapısı TurboRepo ile yönetilir:
- **Backend API**: NestJS 10 + Prisma 5.22 + PostgreSQL (+ Redis/BullMQ)
- **Dashboard**: Next.js 14 (App Router) + React 18 + React Query + Zustand
- **Shared package**: `@zmk/shared` (ortak tipler/yardımcılar için alan)

---

## 2) Projenin Amacı, Çözdüğü Problemler
E-ticaret satıcıları için yaygın problemler:
- Ürün/sipariş verisinin farklı ekranlara dağılması, gecikmeli raporlama
- Kârlılık hesabının (komisyon, kargo, iade, reklam harcaması) doğru yapılamaması
- Rakiplerin fiyat/stock hareketleri ve buybox durumunun manuel takibi
- Kampanya/reklam performansının optimize edilememesi
- Operasyonel kararların (fiyat artır/azalt, stok yenile, reklamı durdur/başlat) kural bazlı otomasyona dökülememesi

Bu proje; **veri toplama + depolama + analitik + otomasyon + bildirim** zincirini tek bir platformda birleştirir.

---

## 3) Teknoloji Stack’i ve Bağımlılıklar
### 3.1 Backend (apps/api)
- **NestJS 10** (modüler yapı: controller/service/module)
- **Prisma 5.22** + `@prisma/adapter-pg` (pg pool üzerinden adapter)
- **PostgreSQL** (şema Prisma’da; yorum satırında TimescaleDB hedefi de belirtilmiş)
- **Redis 7** + **BullMQ** (queue/worker) + **Bull Board** (`/admin/queues`)
- **Auth**: JWT (`passport-jwt`, `@nestjs/jwt`, `@nestjs/passport`) + `bcrypt`
- **Security**: `helmet`, AES-256-GCM (env `ENCRYPTION_KEY`)
- **Swagger/OpenAPI**: `@nestjs/swagger` (prod’da kapalı)
- **WebSocket**: `@nestjs/websockets`, Socket.IO (`/notifications` namespace)
- **Dış servisler**: Trendyol API (axios), AI sağlayıcıları (OpenAI/Anthropic/Gemini), Telegram bot (telegraf), scraping için Playwright
- **Zamanlayıcılar**: `@nestjs/schedule` (cron ile sync/aggregate işleri)

### 3.2 Frontend (apps/dashboard)
- **Next.js 14** (App Router)
- **React 18**
- **@tanstack/react-query** (client-side data fetching/cache)
- **Zustand** (UI state)
- **Recharts** (grafikler)

### 3.3 Monorepo/Build
- **TurboRepo** (`turbo.json`)
- **TypeScript** (root `tsconfig.base.json`)
- Docker & Render deploy

---

## 4) Klasör Yapısı (Özet)
Repo kökünde önemli dizinler/dosyalar:
- `apps/api/` → NestJS backend
  - `src/` → kaynak kod
  - `prisma/schema.prisma` → veritabanı şeması
  - `prisma/seed.ts` → seed (raw `pg` ile)
  - `dist/` → build çıktısı (repoda mevcut)
- `apps/dashboard/` → Next.js dashboard
  - `src/app/` → sayfalar (login + dashboard route’ları)
  - `src/lib/` → API client, auth hook
  - `src/components/` → sidebar, providers vb.
  - `.next/` → build cache/çıktı (repoda mevcut)
- `packages/shared/` → `@zmk/shared`
- `docker-compose.yml` → local Postgres+Redis
- `Dockerfile` → API için production image
- `render.yaml` → Render deploy tanımı (API + Dashboard + Postgres)
- `.env.example` → örnek environment değişkenleri

Not: Repo içinde `node_modules/`, `apps/api/dist/`, `apps/dashboard/.next/` gibi **build/bağımlılık artefact’ları** da bulunuyor.

---

## 5) Çalışma Prensibi (High-level Mimari)
Önerilen çalışma topolojisi:

```
Kullanıcı (Browser)
   │
   │  Next.js Dashboard (3000)
   │  - /api/* rewrite → API_URL/api/*
   ▼
NestJS API (4000, globalPrefix=/api)
   ├─ PostgreSQL (Prisma)
   ├─ Redis (BullMQ)
   ├─ Trendyol API (apigw.trendyol.com)
   ├─ AI Providers (OpenAI/Anthropic/Gemini/Groq)
   └─ WebSocket (/notifications)
```

Başlangıç noktaları:
- **API**: `apps/api/src/main.ts` → global prefix `/api`, CORS, Helmet, ValidationPipe, Swagger (dev only), Socket.IO adapter
- **Dashboard**: `apps/dashboard/next.config.js` → `/api/:path*` → `${API_URL}/api/:path*`

---

## 6) Backend Detayları (NestJS)
### 6.1 Bootstrap & Cross-cutting (main.ts + AppModule)
- Global prefix: `app.setGlobalPrefix("api")` → tüm HTTP endpoint’leri `/api/...`
- CORS: Dashboard URL + Chrome extension origin + Render domain + localhost
- Global validation: `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`
- Global rate limit: `ThrottlerModule` + `ThrottlerGuard`
- Global response wrapper: `ResponseInterceptor`
  - Başarılı cevapları `{ success: true, data, meta }` formatında sarmalar
  - `X-Response-Time` header’ı ekler
- Global exception filter: `GlobalExceptionFilter`
- Logger middleware: tüm route’lara uygulanır
- Swagger: yalnızca production değilse `/api/docs`

### 6.2 Auth & Tenant modeli
- `AuthController`:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/connect-store` (JWT)
  - `GET  /api/auth/connections` (JWT)
  - `GET  /api/auth/me` (JWT)
- `AuthService`:
  - Kayıtta yeni **Tenant + owner User** oluşturur
  - Login’de session kaydı açar
  - Trendyol bağlantısında API key/secret’i **AES-256-GCM** ile şifreleyerek saklar (`SellerConnection.apiKeyRef/apiSecretRef`)

### 6.3 Senkronizasyon & Arka Plan İşleri
İki ana mekanizma var:
1) **Cron tabanlı** otomatik sync
   - `SyncSchedulerService`:
     - Ürün sync: her 6 saatte bir
     - Sipariş sync: her 2 saatte bir + her 15 dakikada “quick” sync
2) **Queue/Worker tabanlı** işler
   - `WorkerModule` BullMQ queue’ları:
     - `scrape_queue`, `ai_analysis_queue`, `api_sync_queue`
   - Bull Board arayüzü: `/admin/queues`
   - Örnek worker: `ApiSyncWorkerService` Trendyol API’den sipariş/ürün çekip DB’ye yazar.

### 6.4 WebSocket Bildirim Merkezi
- `NotificationsGateway` namespace: `/notifications`
- Tenant bazlı room: `tenant:{tenantId}`
- DB’ye `Notification` kaydı atıp WebSocket ile push eder.

### 6.5 Modüller (AppModule import’ları)
Repo, çok sayıda domain modülü içerir:
- `TrendyolModule`, `AnalyticsModule`, `CompetitorModule`, `AdsModule`, `ScraperModule`,
  `IntelligenceModule`, `AutomationModule`, `GodModeModule`, `KeywordResearchModule`,
  `MarketplaceModule`, `FinanceModule`, `AuditModule`, `CommandCenterModule`, `ExtensionModule`,
  `NotificationsModule`, `TelegramModule`, `WarehouseModule`, `WorkerModule`

Bu modüller genellikle şu katmanlaşmayı takip eder:
`Controller` → `Service` → `PrismaService` (+ gerektiğinde dış API/queue/websocket)

---

## 7) API Endpoint’leri (Özet)
**Base path:** `/api`  
Controller prefix’leri (örnek): `/api/trendyol`, `/api/analytics`, `/api/competitors`, ...

Aşağıdaki tablo, projedeki controller’lardan gözlemlenen ana endpoint örneklerini özetler (tam liste dev ortamda Swagger: `/api/docs`).

| Domain | Prefix | Örnek Endpoint’ler |
|---|---|---|
| System | `/health`, `/system` | `GET /api/health`, `GET /api/health/ping`, `GET /api/system/status` |
| Auth | `/auth` | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/connect-store` |
| Trendyol | `/trendyol` | `POST /api/trendyol/products/sync`, `GET /api/trendyol/products`, `POST /api/trendyol/orders/sync`, `POST /api/trendyol/inventory/update`, `POST /api/trendyol/full-sync` |
| Analytics | `/analytics` | `GET /api/analytics/summary`, `/daily`, `/monthly`, `/profitability`, `/restocking` |
| Competitor | `/competitors` | `POST /api/competitors`, `GET /api/competitors`, `POST /api/competitors/:id/probe-now`, `GET /api/competitors/buybox/status`, `POST /api/competitors/pricing/actions/:actionId/apply` |
| Ads | `/ads` | `POST /api/ads/campaigns/sync`, `GET /api/ads/summary`, `GET /api/ads/autopilot` |
| AI | `/ai` | `POST /api/ai/generate`, `POST /api/ai/analyze-reviews`, `POST /api/ai/gap-analysis` *(plan guard ile kısıtlı)* |
| Intelligence | `/intelligence` | `POST /api/intelligence/research`, `GET /api/intelligence/war-room`, `POST /api/intelligence/chat/session`, `GET /api/intelligence/predictions/batch`, `GET /api/intelligence/trend/heatmap` |
| Keywords | `/keywords` | `POST /api/keywords/research`, `POST /api/keywords/tracking`, `GET /api/keywords/tracking/history/:keyword` |
| Scraper | `/scraper` | `POST /api/scraper/targets`, `POST /api/scraper/run/:targetId`, `GET /api/scraper/market/trends` |
| Extension | `/extension` | `POST /api/extension/match`, `GET /api/extension/jobs/next`, `POST /api/extension/jobs/:jobId/result` |
| Command Center | `/command-center` | `GET /api/command-center/insights`, `POST /api/command-center/insights/generate` |
| Audit | `/audit` | `GET /api/audit/logs`, `GET /api/audit/user-activity` |
| Finance (e-Fatura) | `/e-fatura` | `POST /api/e-fatura/generate/:orderId`, `GET /api/e-fatura/summary` |
| Marketplace | `/marketplace` | `GET /api/marketplace/dashboard`, `POST /api/marketplace/hepsiburada/connect`, `POST /api/marketplace/amazon-tr/connect` |
| God Mode | `/god-mode` | `POST /api/god-mode/detect-cartel`, `POST /api/god-mode/oos-snipe/:competitorProductId` *(enterprise plan)* |

---

## 8) Veritabanı (Prisma) — Şema ve İşlev
Şema dosyası: `apps/api/prisma/schema.prisma`  
Veri kaynağı: PostgreSQL (`DATABASE_URL`, `DIRECT_URL`)

### 8.1 Çoklu Kiracı (Multi-tenant) yaklaşımı
`Tenant` ana entity’dir. Birçok tabloda `tenantId` bulunur:
- `User`, `SellerConnection`, `Product`, `Order`, `KpiDaily`, `CompetitorProduct`, `AiRun`, `AuditLog`, `Notification`, ...

Bu; SaaS/white-label modeline uygundur. Uygulama katmanında (service query’lerinde) tenant filtrelerinin tutarlı uygulanması kritik.

### 8.2 Temel iş alanı tabloları (seçilmiş)
- Kimlik & Güvenlik:
  - `Tenant`, `User`, `Session`, `Subscription`
- Trendyol core:
  - `SellerConnection` (API credential referansları şifreli)
  - `Product`, `ProductVariant`, `Category`, `Brand`
  - `Order`, `OrderItem`, `Return`, `ReturnItem`
- Zaman serileri:
  - `PriceHistory`, `InventoryHistory`
- KPI & Analitik:
  - `KpiDaily`, `KpiMonthly`, `KpiSkuDaily`
  - `ActionableInsight` (command-center aksiyon önerileri)
- Rekabet:
  - `CompetitorProduct`, `CompetitorSnapshot`
  - `StockProbe`, `StockProbeResult`
  - `BuyboxSnapshot`
  - `PricingRule`, `PricingAction`
- AI:
  - `AiPrompt`, `AiRun`
  - `ReviewAnalysis`, `ReviewInsight`
  - `ChatSession`, `ChatMessage`
  - `AbTest`, `ProductResearch`, `WarRoomEntry`
- Reklam:
  - `AdCampaign`, `AdKeywordPerformance`, `AdDailyMetric`
- Scraping:
  - `ScrapeTarget`, `ScrapeResult`, `MarketSnapshot`
- Bildirim:
  - `Notification`, `TelegramChat`
- Extension entegrasyonu:
  - `ExtensionSession`, `PageContextCache`, `ExtensionJob`
- Otomasyon:
  - `AutomationRule`, `AlertRule`, `AlertEvent`
- Finans:
  - `FinancialTransaction`, `SettlementPeriod`
- SEO:
  - `KeywordTracking`, `KeywordRankHistory`, `SearchVolumeEstimate`

### 8.3 Migrasyon yaklaşımı
Repo içinde `prisma/migrations/` yok. Deploy tarafında `render.yaml` içinde:
- `prisma db push --accept-data-loss`

Bu yaklaşım geliştirme/demolar için pratik; ancak production’da **veri kaybı riski** taşır.

### 8.4 Seed
`apps/api/prisma/seed.ts`:
- Prisma yerine raw `pg` kullanır (yorumda Prisma engine P1010 bug’ı referansı var)
- Tenant, admin user, Trendyol seller connection, alert rules, automation rule seed eder.

---

## 9) Frontend (Dashboard) — UI & Veri Akışı
### 9.1 Sayfalar (App Router)
`apps/dashboard/src/app/` içinde:
- `/login` → login/register formu, token’ı `localStorage`’a yazar
- `/dashboard` ve alt route’lar:
  - `/dashboard/products`, `/dashboard/orders`, `/dashboard/returns`
  - `/dashboard/competitors`, `/dashboard/war-room`, `/dashboard/ai`, `/dashboard/agent`, `/dashboard/god-mode`
  - `/dashboard/audit`, `/dashboard/settings`, `/dashboard/insights`

### 9.2 API Client & Auth
- `src/lib/api.ts`:
  - `API_BASE = "/api"`; Next.js rewrite ile backend’e gider
  - Authorization: `Bearer ${localStorage(zmk_token)}`
  - 401 olunca token temizlenip `/login`’e yönlendirilir
- `src/lib/useAuth.ts`:
  - Hydration mismatch önlemek için `ready/authed` pattern’i uygular

### 9.3 Data Fetching
- React Query ile query/mutation:
  - Örn: Dashboard KPI ekranı `GET /api/analytics/summary`, `/top-products`, `/heatmap`, `/profitability`, `/restocking`
  - Ürün sayfası `GET /api/trendyol/products`, `POST /api/trendyol/products/sync`
  - Rakip sayfası `GET /api/competitors`, `POST /api/competitors`, `POST /api/competitors/:id/probe-now`

### 9.4 UI Yapısı
- `layout.tsx`: solda Sidebar, sağda içerik; global CSS `globals.css`
- `SidebarNav`: route’lara göre aktif link, “special” vurgular (Agent/God Mode)
- Zustand (`useAppStore`): çok sınırlı UI state (God Mode enabled, aktif menü)

---

## 10) Konfigürasyon, Çalıştırma ve Deploy
### 10.1 Local geliştirme
`docker-compose.yml`:
- Postgres 15 (host port: **5433**)
- Redis 7 (host port: **6379**)

README Quick Start:
1) `npm install`
2) `.env.example` → `.env`
3) `docker compose up -d`
4) `cd apps/api && npx prisma db push && npx tsx prisma/seed.ts`
5) `apps/api` dev: `npm run dev` (4000), `apps/dashboard` dev: `npm run dev` (3000)

### 10.2 Docker
Root `Dockerfile` yalnız API için production image oluşturur:
- build aşamasında `prisma generate` + `nest build`
- runtime: `node dist/main.js`

### 10.3 Render Deploy
`render.yaml`:
- `zmk-api` (Node web service) + `zmk-dashboard` (Node web service) + managed Postgres
- API build’te `prisma db push --accept-data-loss` kullanır.

---

## 11) Riskler, Gözlemler ve İyileştirme Önerileri
### 11.1 Repo hijyeni / build artefact’ları
- `node_modules/`, `dist/`, `.next/` repoda mevcut görünüyor. Öneri:
  - `.gitignore` ile hariç tutmak
  - CI/CD’de build üretilmesi, repoya commit edilmemesi

### 11.2 Migrasyon stratejisi
- `db push --accept-data-loss` production için riskli.
  - Öneri: Prisma migrations (`prisma migrate`) + kontrollü migration pipeline

### 11.3 Güvenlik
- `JwtStrategy` içinde default `secretOrKey: process.env.JWT_SECRET || "dev-secret"`
  - Öneri: prod’da env zorunlu kılınmalı (başlamadan fail-fast).
- `Bull Board` route’u `/admin/queues`:
  - Öneri: prod’da mutlaka auth/role guard ile korunmalı.
- Token saklama:
  - Dashboard token’ı `localStorage`’da. XSS riskine karşı:
    - Öneri: HttpOnly cookie + CSRF stratejisi veya en azından CSP/escape/strict input sanitization.

### 11.4 Multi-tenant veri izolasyonu
- Bazı endpoint’ler sadece `id` parametresi alıyor (örn. bazı servis çağrılarında tenant filtrelemesi gözlemlenmeyebilir).
  - Öneri: “tenantId always in where clause” prensibi için code review checklist + helper/repository katmanı.

### 11.5 Observability / Operasyon
- `X-Response-Time` iyi; bunun yanında:
  - Öneri: structured logging (requestId/tenantId correlation), metrics (Prometheus), tracing (OpenTelemetry)

### 11.6 Test & Kalite
- Öneri: en azından kritik akışlar için (Auth + Trendyol sync + KPI) e2e test (Playwright API / supertest) ve unit test seti.

---

## 12) Sonuç
Bu repo; Trendyol satıcıları için “tek panel” yaklaşımıyla **operasyon + analitik + rekabet istihbaratı + AI + otomasyon** katmanlarını birleştiren, NestJS tabanlı güçlü bir backend ve Next.js tabanlı bir dashboard içeriyor. Mimari modüler; veri modeli oldukça geniş ve SaaS/multi-tenant senaryosuna uygun.

Bir sonraki en yüksek etkiyi sağlayacak iyileştirmeler: **migrasyon stratejisinin sağlamlaştırılması**, **prod güvenliğinin sıkılaştırılması** (JWT secret zorunluluğu, admin route guard’ları), **repo artefact temizliği**, ve **tenant izolasyonu için sistematik kontroller** olacaktır.


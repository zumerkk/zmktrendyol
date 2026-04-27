# ZMK Trendyol Platform - Güncel Durum Raporu (Rakip İstihbarat Paneli Odağında)

Tarih: 2026-04-16

Bu rapor; ZMK Trendyol Platformu'nun mevcut analizini ve yakın zamanda sisteme entegre edilen **Rakip Fiyat/Stok İstihbarat Paneli (v1.1)** özelliklerinin durumunu özetler.

---

## 1. İş Paketleri Durumu

### ✅ Tamamlanmış İş Paketleri
*   **Temel Altyapı ve Veritabanı:** `RivalWatchTarget`, `RivalScan`, `RivalVariantScan`, `RivalAlert`, `RivalChangeEvent`, `RivalDecision` tabloları Prisma şemasına eklendi ve veritabanı migrate edildi.
*   **API ve Servis Katmanı:** `rivals` modülü (Controller, Service, DTOs) oluşturuldu. Hedef ekleme, silme, güncelleme, listeleme işlemleri aktif.
*   **Scraper (Tarayıcı) Motoru:** Playwright kullanılarak Trendyol ürün sayfalarından fiyat, varyant, stok durumu ve kampanya sinyallerini çıkaran `TrendyolScraperService` (best-effort) geliştirildi.
*   **Karar ve Alarm Motorları:** Varyant farklarına, hedef fiyata ve stok kapanmalarına göre çalışan kural bazlı `DecisionEngine` ve `AlertsEngine` devreye alındı. Farkları tespit eden `DiffEngine` aktif.
*   **Otomatik Tarama (Scheduler):** İzlenen hedefleri 15 dakikada bir otomatik olarak tarayan `RivalsScheduler` servisi (`@Cron`) aktifleştirildi.
*   **Kârlılık (Profit) Hesabı:** Rakip ürün ile "bizim ürünümüz" (`ourProductId`) eşleştirildiğinde günlük, haftalık ve aylık kârlılık sunan endpoint eklendi.
*   **Dashboard Arayüzü:** Next.js üzerinde `dashboard/rivals` komuta merkezi tasarlandı. Sol menüde hedefler, ortada varyant analizleri, sağda karar ve kâr ekranları bağlandı.
*   **Güvenlik / Temel Eksikler:** Refresh Token altyapısı, Bull Board admin koruması ve JWT secret eksiklikleri çözüldü. Linter problemleri giderildi.

### 🔄 Devam Eden / Optimizasyon Bekleyen İş Paketleri
*   **Test Kapsamı:** Jest + Supertest altyapısı kuruldu ancak şu an sadece temel E2E doğrulama testleri (Health check ve listeleme) mevcut. Kural motorları için Unit test yazılması plan dahilinde ancak henüz kodlanmadı.
*   **Rate-Limit Yönetimi:** `scan-now` (şimdi tara) butonunun kötüye kullanımını önlemek için tenant bazlı throttling/rate-limit eklenmesi planlanıyor.

### ⏳ Henüz Başlatılmamış (V2 ve Sonrası İçin Planlanan) İş Paketleri
*   Otomatik ürün eşleştirme (farklı mağaza ilanlarını tek üründe normalize etme).
*   Yorum ve puan artış hızından satış hacmi tahmini yapılması.
*   Hepsiburada, N11, Amazon TR pazaryeri entegrasyonları.
*   Kuponlar, kişisel kampanyalar ve üyeye özel sepet fiyatlarının analizi.

---

## 2. Teknik Mimari ve Entegrasyon Noktaları
*   **Mimari:** Modüler NestJS yapısı (RivalsModule) sorunsuz entegre edildi. Mevcut Trendyol/Prisma/Auth bağımlılıkları ile tam uyumlu çalışıyor.
*   **Veri Kaynakları:**
    *   **Trendyol Kamusal Verisi:** Ürün detay sayfaları (`Playwright` ile). DOM değişikliklerine karşı dayanıklı olması için CSS selector'lerde fallback'ler (alternatif seçiciler) kullanıldı.
    *   **İç Veri (Internal):** Kullanıcının API entegrasyonu üzerinden çektiği kendi maliyet/satış bilgileri (`Product` ve `OrderItem` tabloları).
*   **Entegrasyon Noktaları:** Dashboard üzerinden React Query ile `GET /api/rivals/targets/:id/summary` ve `profit` endpointleri periyodik olarak (30s-60s) dinleniyor.

---

## 3. V1 ve V1.1 Arasındaki Farklar
*   **V1 Tasarımında:** Temel rakip izleme, varyant fiyat/stok sinyali, alarm ve AL/BEKLE/İZLE kural motoru tasarlandı.
*   **V1.1 Kararları (Eklemeler):**
    *   **Eşleştirme ve Kâr Hesabı:** Rakibin ürünü ile "Bizim Ürünümüz" (`ourProductId`) eşleştirildi. Böylece sadece rakibi izlemekle kalmayıp aynı panelde **Bizim Kârlılığımız** (Günlük, Haftalık, Aylık) hesaplanabilir hale getirildi.
    *   **UI Optimizasyonu:** Tasarım dokümanındaki "Sağ panel" kararı genişletilerek kâr durumu (Profit) kutusu arayüze entegre edildi.

---

## 4. Riskler ve Çözüm Önerileri
1.  **Risk: Playwright (Scraper) Kırılganlığı:** Trendyol ürün sayfası DOM yapısını (CSS sınıflarını) değiştirirse scraper çalışmayabilir.
    *   **Çözüm:** `trendyol-scraper.service.ts` içinde kullanılan selector'ler çoklu `||` koşuluyla (best-effort) yazıldı. Ancak kalıcı çözüm için UI testleri gibi DOM yapısını düzenli kontrol eden bir mekanizma gereklidir.
2.  **Risk: Trendyol Bot Koruması (Blocked/429):** Kamusal sayfalara çok sık istek atılması durumunda IP'ler bloklanabilir.
    *   **Çözüm:** Scheduler'a *jitter* (rastgele bekleme süresi) eklendi ve Concurrency (eşzamanlılık) düşük tutuldu. İlerleyen aşamada proxy havuzu entegrasyonu aktif edilmelidir.
3.  **Risk: Veri Kaybı (Migration):** Mevcut deployment (Render) stratejisinde `prisma db push --accept-data-loss` komutu kullanılıyor.
    *   **Çözüm:** `npx prisma migrate dev` ile migration dosyaları oluşturuldu. Production ortamında kesinlikle `prisma migrate deploy` komutu kullanılmalı.

---

## 5. Takvim, Kaynak ve Bütçe
*   **Takvim:** V1.1 planı (2026-04-16 tarihli doküman) tam olarak hedeflenen sürede, eksiksiz olarak koda dökülmüştür. Gecikme bulunmamaktadır.
*   **Kaynak:** Tüm geliştirmeler monorepo içinde tek bir full-stack ekosisteminde (Agent) başarıyla tamamlandı. Dış kaynağa (farklı bir servise) ihtiyaç duyulmadı.
*   **Bütçe:** Kamusal scraping kullanıldığı için ek API veya veri sağlama maliyeti doğmadı. Ancak scraper (Playwright) çalıştırmak RAM yoğun bir işlem olduğu için sunucu ölçeklemesinde (server scaling) maliyet artışı öngörülebilir.

---

## 6. Aksiyon Önerileri ve Önceliklendirilmiş Görev Listesi

### Hemen Yapılacaklar (Kritik)
1.  [ ] **Rate Limiting:** `scan-now` endpointine (Örn: her ürün için 5 dakikada 1 kez çalıştırılabilir gibi) kısıtlama eklenmesi.
2.  [ ] **Proxy Havuzu:** `.env` dosyasındaki `PROXY_POOL_URL` bilgisinin scraper yapılandırmasına tam entegrasyonunun test edilmesi.
3.  [ ] **Production Migration:** `render.yaml` dosyasındaki veritabanı güncelleme komutunun `prisma migrate deploy` olarak değiştirilmesi.

### Bir Sonraki Kontrol Noktasına (V1.2) Kadar Yapılacaklar
1.  [ ] **Test Kapsamı:** `decision.engine.ts` ve `alerts.engine.ts` için uç durumları (edge cases) kapsayan Unit Testlerin yazılması.
2.  [ ] **UI İyileştirmesi:** Varyant sayısı çok fazla olan ayakkabı vb. ürünler için varyant tablosuna sayfalama veya kaydırma (scroll) eklenmesi.
3.  [ ] **Bildirim Entegrasyonu:** Karar motorundan çıkan "AL" veya "Critical Alarm" sonuçlarının `TelegramModule` üzerinden WhatsApp/Telegram ile satın alma ekibine iletilmesi.
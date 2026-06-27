# TORA — Geliştirme Planı

## Proje Yapısı
Yönetici > Birim Amiri > Birim Personeli  
Birimler: Sistem · Network · Yazılım · Test · Some  
Roller: `ADMIN` · `BIRIM_AMIRI` · `YAZILIMCI` · `DEVOPS` · `IS_ANALISTI` · `TESTCI`

> Bu dosya: üstte **açık backlog**, ortada **teknik borç**, altta **tamamlananlar** ve **arşiv** (kapatılan güvenlik bulguları). Tamamlanan işlerin detayı `docs/` ve git geçmişindedir.

---

## 🔜 Açık Backlog

### Kısa Vadeli

#### API Dokümantasyonu (Swagger)
- [x] SpringDoc OpenAPI (Swagger UI) entegrasyonu
  - **Düzeltme:** `springdoc-openapi-starter-webmvc-ui` 2.3.0 eklendi; `OpenApiConfig` JWT bearer şeması + API bilgisi tanımlar.
- [x] `/api/docs` path'inde Swagger UI (sadece dev profil + IP allowlist)
  - **Düzeltme:** springdoc yalnızca `dev` profilinde açık (`application-dev.yml`), prod'da kapalı. Erişim Nginx IP allowlist ile sınırlı (`Frontend/nginx.conf` → `geo $swagger_denied`); Spring tarafı `permitAll`, operasyonlar `Authorize` + `@PreAuthorize` ile korunur. `SPRING_PROFILES_ACTIVE` docker-compose'da varsayılan `dev`.
- [x] Her controller'a `@Tag` annotation'ı (21 controller); endpoint/DTO seviyesi `@Operation`/`@Schema` ileride zenginleştirilebilir.

### Düşük Öncelik (şimdilik gerekli görülmedi — 2026-06-27)

#### Dosya Eki Yükleme
- [ ] `task_attachments` tablosu + depolama servisi + upload/download/delete endpoint'leri
- [ ] TaskModal drag & drop, boyut/tür limiti, önizleme

#### İki Faktörlü Doğrulama (2FA)
- [ ] TOTP tabanlı 2FA (Google Authenticator), QR üretme/doğrulama
- [ ] Kullanıcı bazlı aç/kapa + ADMIN için zorunlu politika

### Orta Vadeli

#### Görev Bağımlılıkları
- [ ] `task_dependencies` tablosu (blocking / blocked_by ilişkisi)
- [ ] Görev detayında bağımlılık ekleme/kaldırma UI
- [ ] Gantt chart'ta bağımlılık okları
- [ ] Bağımlı görev tamamlanmadan başlatılamaz kuralı

#### Tekrarlayan Görevler
- [ ] Tekrar şablonu (günlük / haftalık / aylık / özel cron)
- [ ] Scheduled job ile otomatik görev oluşturma
- [ ] Tekrar serisini düzenleme (bu oluşumdan itibaren / tüm seri)
- [ ] Zincir iş bir iş kapatıldığında otomatik başka bir işin oluşması başka birim dahil

#### Zaman Takibi
- [ ] `time_entries` tablosu (görev + kullanıcı + başlangıç/bitiş)
- [ ] Görev üzerinde "Başla / Durdur" zamanlayıcı + manuel saat girişi
- [ ] Harcanan süre görünümü (görev + birim + kişi bazlı)

#### Toplu Görev İşlemleri (kısmen ✅ 2026-06-27)
- [x] Liste görünümünde çoklu seçim (checkbox + tümünü seç) + toplu işlem barı
- [x] Toplu durum değiştirme + toplu atama (ekle) + toplu silme — `POST /api/tasks/bulk` (per-task izin/log/bildirim/SLA korunur, partial sonuç döner)
- [ ] Kanban görünümünde çoklu seçim
- [ ] Toplu birim/proje taşıma

#### Takvim Geliştirmeleri
- [ ] Sürükle-bırak görev taşıma (takvim görünümünde)
- [ ] Günlük detay görünümü (saat bazlı timeline)
- [ ] iCal export (Google Calendar / Outlook)
- [ ] Tatil ve resmi izin günleri görünümü
- [ ] Yazdırma dostu takvim çıktısı

#### Sprint / Milestone Desteği
- [ ] `milestones` tablosu (proje milestone'ları, tarih + başlık)
- [ ] `sprints` tablosu (başlangıç/bitiş, hedef, birim)
- [ ] Görevleri sprint/milestone'a bağlama, sprint board görünümü
- [ ] Burndown chart + proje ilerleme yüzdesi widget'ı

### Görsel İyileştirmeler
- [ ] mobil arayüzün geliştirmesi
- [ ] her monitörde her çözünülükte güzel görünmesi
- [ ] renk şemasını düzenlenmesi
- [ ] yazılar tam oturması

#### Raporlama — Kalan
- [ ] Haftalık/aylık birim performans raporu **PDF export** (Excel + tarayıcı-yazdırma PDF mevcut; sunucu-üretimli PDF eksik)

#### SLA — Kalan (opsiyonel)
- [ ] Ayrı "SLA Uyumu" rapor türü/sayfası (birim bazlı uyum tablosu olarak export)
- [ ] Eskalasyon kuralı: ihlalde önceliği yükselt / üst amire bildir
- [ ] Etiket bazlı politika + ilk-yanıt (response) SLA'sı + resmi tatil takvimi

### Uzun Vadeli

#### Bildirim Geliştirmeleri
- [ ] WebSocket (STOMP) ile gerçek zamanlı bildirimler (polling yerine)
- [ ] E-posta bildirim tercihleri (kullanıcı bazlı) + e-posta şablonları

#### Mobil & PWA
- [ ] Progressive Web App (Service Worker, offline destek, yüklenebilir)
- [ ] Push notification (Web Push API)
- [ ] Mobil uyumlu görev oluşturma/düzenleme akışı

#### Otomasyon & Entegrasyon
- [ ] Webhook desteği (görev olaylarında dış URL çağrısı)
- [ ] Slack / Microsoft Teams entegrasyonu (bildirim köprüsü)
- [ ] E-posta ile görev oluşturma (IMAP listener)
- [ ] Otomatik görev atama kuralları (round-robin, birim bazlı)

#### Gelişmiş Güvenlik
- [ ] IP allowlist (admin panel sadece belirli IP'lerden)
- [ ] Gelişmiş CSP — nonce tabanlı inline script kontrolü
- [ ] Güvenlik tarama raporu (OWASP ZAP) + penetrasyon testi hazırlığı
- [ ] Token store'u Redis'e taşıma (çok-instance + TTL; şu an DB tabanlı)

---

## 🐛 Teknik Borç

- [ ] Unit test coverage — servis katmanı (JUnit 5 + Mockito)
- [ ] Integration test — REST endpoint'leri (`@SpringBootTest` + Testcontainers)
- [ ] E2E test — kritik akışlar (Playwright veya Cypress)
- [ ] Frontend component test (React Testing Library)
- [ ] CI/CD pipeline (GitHub Actions: build + test + Docker push)
- [ ] Performans kabul kriterleri doğrulaması (Hibernate sorgu sayısı / profiler ile) — optimizasyonlar yapıldı, ölçüm formal değil

---

## ✅ Tamamlananlar

### Temel Altyapı
- [x] Docker Compose (postgres + backend + frontend/nginx)
- [x] Liquibase veritabanı migration (V1–V30)
- [x] Spring Boot 3.2 + JPA/Hibernate + PostgreSQL 15
- [x] React 18 + TypeScript + Vite
- [x] Catppuccin Mocha/Latte tema (dark/light geçiş, localStorage)

### Kimlik Doğrulama & Yetkilendirme
- [x] JWT stateless authentication (24 saat) + **rotate-on-use refresh token** (7 gün)
- [x] LDAP + Local User hibrit authentication (LDAP önce, fallback local)
- [x] Spring Security rol hiyerarşisi (`ADMIN > BIRIM_AMIRI > USER`)
- [x] Rate limiting + account lockout — IP/kullanıcı bazlı, `LoginAttemptService` (DB tabanlı)
- [x] **Oturum Yönetimi** — aktif oturum listesi (cihaz/IP/tarih), tek oturumu/diğer cihazları sonlandırma (V29; `/api/users/me/sessions`)

### Güvenlik Sertleştirme
- [x] **AES-GCM + PBKDF2 şifreleme** — `EncryptionService` (AES/GCM/NoPadding, 12-byte IV, PBKDF2 65 536 iter); eski ECB kayıtlar geriye dönük uyumlu, yazımda GCM'e yükseliyor
- [x] **DB tabanlı token revocation + refresh store** — `revoked_tokens`/`refresh_tokens` (V28), SHA-256 hash; logout blacklist, her istekte kontrol; saatlik temizlik (restart/çok-instance güvenli)
- [x] **HTTP güvenlik başlıkları** — X-Frame-Options (DENY), X-Content-Type-Options, HSTS (1 yıl), CSP
- [x] **CORS sertleştirme** — `@CrossOrigin("*")` kaldırıldı, merkezi `SecurityConfig`, `allowCredentials(false)`, prod'da `*` uyarısı
- [x] **Startup secret doğrulama** — `ENFORCE_SECRET_VALIDATION=true` ile default JWT/Encryption secret'ta uygulama başlamıyor; `ENCRYPTION_SALT` env
- [x] **Admin audit log** + **login geçmişi görünümü** (son 10 giriş)
- [x] LDAP log temizliği (SLF4J, şifre loga düşmüyor); LDAP test endpoint generic mesaj
- [x] **2026-06 güvenlik taramaları** — tüm bulgular kapatıldı (aşağıda Arşiv)

### Kullanıcı & Birim Yönetimi (Admin)
- [x] Kullanıcı ekle/düzenle/sil (soft delete), birime atama, rol değiştirme
- [x] LDAP kullanıcı arama ve import
- [x] Birim amiri atama, üye yönetimi, renk/ikon ayarlama

### Görev Yönetimi
- [x] Görev CRUD + alt görev (subtask) desteği
- [x] Öncelik seviyeleri (NORMAL/HIGH/URGENT), esnek etiket sistemi (TaskLabel)
- [x] Görev geçmişi / aktivite log (TaskLog), görev yorumları + `@mention`
- [x] **SLA Takibi** — politika tablosu (V30), durum (ON_TRACK/AT_RISK/BREACHED/MET), ihlal bildirimleri, admin CRUD, uyum metriği, görev kartı + rapor SLA sütunu

### Görünümler & Takvim
- [x] Aylık takvim, haftalık, 12 aylık genel bakış, Kanban, Gantt (subtask hiyerarşisi)
- [x] Liste görünümü (sayfalama), takım planlama görünümü

### Arama & Filtreleme
- [x] Global full-text search (görev/proje/kullanıcı; `tsvector`/`tsquery` + trigram), debounce dropdown
- [x] Gelişmiş filtreler (durum/öncelik/etiket/atanan) + kaydedilmiş filtreler (V27)

### Bildirim Sistemi
- [x] `TASK_ASSIGNED` / `TASK_STATUS_CHANGED` / `TASK_DUE_SOON` (08:00 cron) / `COMMENT_*` / `SLA_*`
- [x] Header bildirim zili + okunmamış badge (30 sn polling), bildirim paneli
- [x] Timestamp UTC düzeltmesi

### Dashboard & Raporlama
- [x] Birim dashboard (istatistik/leaderboard/grafik) + genel özet, Caffeine cache (5 dk, hedefli eviction)
- [x] Raporlar: performans, birim karşılaştırma, kişisel verimlilik, süreç süresi
- [x] Excel export (Apache POI) + tarayıcı-yazdırma PDF; İş Listesi tablosunda SLA sütunu

### Performans & Altyapı
- [x] N+1 giderimi (`@BatchSize` + ManyToOne `JOIN FETCH`), dashboard SQL aggregation
- [x] JWT filter `userDetails` cache (5 dk), YEAR()→tarih aralığı + composite index (V25)
- [x] Route-level lazy loading + Vite chunk splitting
- [x] DB index optimizasyonu (V23/V25/V26), HikariCP (keepalive, sızıntı tespiti)
- [x] AOP logging (sadece write + hatalar), log temizleme (sistem 30g / görev 90g)
- [x] Örnek veri seed'i SLA dolu üretiyor + idempotent (tekrar seed etmez)

### UX
- [x] Toast bildirim sistemi, LoadingSpinner, inline form doğrulama
- [x] WCAG 2.1 AA (skip link, focus ring, ARIA), klavye kısayolları (`?`, `g h/p/d/a/u`)
- [x] Hata sayfaları (403/500/network) + ErrorBoundary, responsive (desktop/tablet/mobil)

---

## 📁 Arşiv — Kapatılan Güvenlik Bulguları

> Detaylı düzeltme açıklamaları git geçmişinde ve `docs/authentication.md` içinde.

### Tarama 2026-06-07
- [x] Kimlik doğrulamasız ADMIN kaydı → `register` artık `@PreAuthorize("hasRole('ADMIN')")`
- [~] Varsayılan admin `admin/admin` → **bilinçli atlandı** (kullanıcı kendi değiştirir)
- [x] Kullanıcı listesi email ifşası → `SimpleUserDTO` (email yok)
- [x] Varsayılan JWT/Encryption key → `ENFORCE_SECRET_VALIDATION` fail-fast
- [x] LDAP soft-delete bypass → reaktivasyonda roller temizleniyor
- [x] Sabit KDF salt → `ENCRYPTION_SALT` env değişkeni

### Tarama 2026-06-10 (Fable 5) — tümü kapatıldı
- [x] X-Forwarded-For spoof → `X-Real-IP` birincil (spoof edilemez)
- [x] Kullanıcı adı enumerasyonu → tek generic `AUTHENTICATION_FAILED` kodu
- [x] CORS `*`+credentials → `allowCredentials(false)` + prod uyarısı
- [x] In-memory token store → DB'ye taşındı (V28, SHA-256)
- [x] LDAP test ham mesaj + docker sabit DB şifresi → generic mesaj + `${DB_PASSWORD}` env

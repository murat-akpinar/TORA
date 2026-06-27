# TORA — Geliştirme Planı

## Proje Yapısı
Yönetici > Birim Amiri > Birim Personeli  
Birimler: Sistem · Network · Yazılım · Test · Some  
Roller: `ADMIN` · `BIRIM_AMIRI` · `YAZILIMCI` · `DEVOPS` · `IS_ANALISTI` · `TESTCI`

> Bu dosya: üstte **açık backlog**, ortada **teknik borç**, altta **tamamlananlar** ve **arşiv** (kapatılan güvenlik bulguları). Tamamlanan işlerin detayı `docs/` ve git geçmişindedir.

---

## 🔜 Açık Backlog

### 🔨 Üzerinde Çalışılıyor — Zincir Görevler (Chain Tasks)

> **Durum:** Tasarım onaylandı, uygulama planı hazırlanıyor. **Yarım kalırsa buradan devam.**
> **Tasarım belgesi:** `docs/superpowers/specs/2026-06-27-zincir-gorevler-design.md`
> **Uygulama planı:** `docs/superpowers/plans/2026-06-27-zincir-gorevler.md` (yazılıyor)

Bir görev **tamamlanınca** (COMPLETED) önceden tanımlı **bir veya birden çok takip görevi** otomatik açılır (farklı birimlere de). Senaryo: "sunucu açma" işi bitince → izleme (Grafana/Zabbix) + Network birimi + Some-log işleri otomatik düşer.

- [ ] V31 migration: `task_chains`, `task_chain_assignees`, `tasks.spawned_from_task_id`
- [ ] `TaskChain` entity + `TaskChainService` (`upsertChains` + `fireIfDefined`, best-effort)
- [ ] `updateTaskStatus` entegrasyonu (sadece COMPLETED tetikler; toplu işlemler otomatik kapsanır)
- [ ] DTO: `TaskChainRequest`/`TaskChainDTO`, `CreateTaskRequest.chains`, `TaskDTO.chains` + `spawnedFrom`
- [ ] Frontend: TaskModal "Tamamlanınca açılacak işler" listesi + görev detayında zincir/kaynak rozeti
- [ ] Integration testler (üretim doğruluğu, bir-kez guard, cross-birim, no-op, bulk)
- [ ] Regresyon kontrolü + docs güncelleme (database-schema · api-reference · architecture · frontend)

**Kararlar:** inline tanım · çoklu takip · tek adım (döngüsüz) · göreli tarih · sadece COMPLETED · createdBy=tamamlayan · erişim baypas · best-effort. **Sonraki adım (kapsam dışı):** tekrar kullanılabilir şablon (etiket/proje bazlı otomatik zincir).

### Kısa Vadeli

#### İş Kodu (Task Code) Üretimi — her işe okunabilir kod
> Git entegrasyonunun **ön koşulu**; tek başına da faydalı (insanlar "SIS-42" diye konuşur, koda göre arar).
- [ ] `tasks.code` kolonu (VARCHAR, **unique**, **değişmez**) — oluşturmada bir kez üretilir; iş başka birime taşınsa bile kod değişmez (kimlik gibi)
- [ ] Format: `<BİRİM_ÖNEKİ>-<sıra>` (örn. `SIS-0042`, `NET-0007`); sıra **atomik** üretilir (DB sequence / sayaç tablosu — yarış koşulu yok)
- [ ] Birim → önek eşlemesi: Sistem=`SIS` · Network=`NET` · Yazılım=`YAZ` · Test=`TEST` · Some=`SOME` (ileride yönetilebilir)
- [ ] Tüm üretim yolları kod alır: normal `createTask` **ve** zincirle üretilen görevler (`TaskChainService.spawn`)
- [ ] Frontend: görev kartı/başlığında kod rozeti + koda göre arama (mevcut full-text search'e dahil)
- [ ] Geriye dönük: mevcut işlere tek seferlik kod atama (migration changeSet)

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

#### Tekrarlayan Görevler (zaman tetiklemeli — zincirden sonraki iş)
- [ ] Tekrar şablonu (günlük / haftalık / aylık / özel cron)
- [ ] Scheduled job ile otomatik görev oluşturma (örn. hafta içi her gün backup-job kontrolü)
- [ ] Tekrar serisini düzenleme (bu oluşumdan itibaren / tüm seri)
> Not: "iş kapanınca zincirleme yeni iş" kısmı **olay tetiklemeli** olduğu için ayrıldı → üstteki "🔨 Üzerinde Çalışılıyor — Zincir Görevler".

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
- [ ] **Git entegrasyonu (GitLab / GitHub / Gitea)** — iş kodu (örn. `SIS-42`) git ile iş arasındaki glue; self-hosted (Gitea/GitLab) öncelikli. **Ön koşul:** "İş Kodu Üretimi" (yukarıda).
  - **Bağlama (kod 3 kanaldan yakalanır):** branch adı (`feature/SIS-42-...`), commit mesajı (`SIS-42 ...`), MR/PR başlık/açıklaması → webhook ile taranıp işe bağlanır
  - **Webhook olayları:** push / MR-PR açıldı / merge → işin aktivite akışına link + not düşer
  - **Durum senkronu:** MR açıldı → "Yapılıyor"; MR merge → "Tamamlandı" (bu zincir görevlerini bile tetikleyebilir)
  - **Aşamalı kurulum:** önce **hafif** (webhook + kod tarama, salt-okur, git API yazma yetkisi gerekmez) → sonra **zengin** (iş içinden "Branch oluştur / MR oluştur" butonları, git API ile yazma + repo token)
  - **Çoklu platform:** GitHub/GitLab/Gitea API farkları tek bir entegrasyon arayüzü arkasında soyutlanır
- [ ] **Slack / Microsoft Teams entegrasyonu** — bildirim köprüsü (atama/durum/SLA olayları kanala düşer) + slash-command / mesajla görev oluşturma
- [ ] E-posta ile görev oluşturma (IMAP listener)
- [ ] Otomatik görev atama kuralları (round-robin, birim bazlı)

#### Gelişmiş Güvenlik
- [ ] IP allowlist (admin panel sadece belirli IP'lerden)
- [ ] Gelişmiş CSP — nonce tabanlı inline script kontrolü
- [ ] Güvenlik tarama raporu (OWASP ZAP) + penetrasyon testi hazırlığı
- [ ] Token store'u Redis'e taşıma (çok-instance + TTL; şu an DB tabanlı)

---

## 🐛 Teknik Borç

### Denetim Bulguları (2026-06-27)
> Zincir özelliği öncesi kod incelemesi. #1 ve #2 zincir planında düzeltiliyor (`docs/superpowers/plans/2026-06-27-zincir-gorevler.md`); aşağıdakiler ayrı borç.
- [ ] **Bulk işlem tx bütünlüğü** — `bulkOperation` her görevi try/catch ile sayıyor ama hepsi tek transaction (`TaskService` sınıf düzeyinde `@Transactional`). Bir görev DB hatası verirse tüm tx rollback olur → "succeeded" sayısı yanıltıcı (aslında hiçbiri kaydedilmez). **Düzeltme:** her görevi `REQUIRES_NEW` ile ayrı tx'te işle (ayrı bean üzerinden, self-invocation tx açmaz).
- [ ] **Durum geçişi tek noktadan değil** — status hem `updateTaskStatus` hem `updateTask` hem `createTask`'ta set ediliyor (3 yer). Yan etkiler (bildirim/log/SLA/zincir) dağınık tetikleniyor; ileride tek "status transition" yardımcısında toplanmalı (event tabanlı). Zincir için #2'de kısmen ele alındı.
- [ ] **Ölü kolon temizliği** — `tasks.is_postponed` / `postponed_to_date` / `postponed_from_date` / `task_type` (deprecated, V18 sonrası kullanılmıyor). Bir migration'da drop edilebilir (Task.java'da not mevcut). Düşük öncelik.
- [ ] **Durum makinesi yok** — herhangi bir durumdan herhangi birine geçişe izin var (ör. COMPLETED → OPEN serbest). İş kuralı gerekiyorsa geçiş validasyonu eklenebilir.

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

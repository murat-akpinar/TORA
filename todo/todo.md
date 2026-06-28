# TORA — Geliştirme Planı

## Proje Yapısı
Yönetici > Birim Amiri > Birim Personeli  
Birimler: Sistem · Network · Yazılım · Test · Some  
Roller: `ADMIN` · `BIRIM_AMIRI` · `YAZILIMCI` · `DEVOPS` · `IS_ANALISTI` · `TESTCI`

> Bu dosya: üstte **açık backlog**, ortada **teknik borç**, altta **tamamlananlar** ve **arşiv** (kapatılan güvenlik bulguları). Tamamlanan işlerin detayı `docs/` ve git geçmişindedir.

---

## 🔜 Açık Backlog

#### ✅ Zincir Görevler (Chain Tasks) — TAMAMLANDI (2026-06-27)

> **Tasarım:** `docs/superpowers/specs/2026-06-27-zincir-gorevler-design.md` · **Plan:** `docs/superpowers/plans/2026-06-27-zincir-gorevler.md`

Bir görev **COMPLETED** olunca tanımlı **bir veya birden çok takip görevi** otomatik açılır (farklı birime de). Senaryo doğrulandı: "sunucu açma" bitince → izleme (Sistem) + Network işleri ilgili birimlere düştü.

- [x] V31 migration: `task_chains`, `task_chain_assignees`, `tasks.spawned_from_task_id`
- [x] `TaskChain` entity + `TaskChainService` (`upsertChains` + `fireIfDefined`)
- [x] Tetikleme: **AFTER_COMMIT + REQUIRES_NEW** event (tamamlamayı bozmaz); `updateTaskStatus` **ve** `updateTask` COMPLETED'e geçişte yayınlar; bulk otomatik kapsanır
- [x] DTO: `TaskChainRequest`/`TaskChainDTO`, `CreateTaskRequest.chains`, `TaskDTO.chains` + `spawnedFrom`
- [x] Frontend: TaskModal "Tamamlanınca açılacak işler" listesi + kaynak rozeti
- [x] 5 Mockito unit testi (üretim doğruluğu, bir-kez guard, best-effort) — bir bug yakaladı (`Set`→`List`)
- [x] Uçtan uca senaryo doğrulandı + docs güncellendi (database-schema · api-reference · architecture · frontend)
- **Not (kapsam dışı, sonraki):** etiket/proje bazlı tekrar kullanılabilir şablon; tekrarlayan (zaman tetiklemeli) görevler

**Kararlar:** inline tanım · çoklu takip · tek adım (döngüsüz) · göreli tarih · sadece COMPLETED · createdBy=tamamlayan · erişim baypas · best-effort. **Sonraki adım (kapsam dışı):** tekrar kullanılabilir şablon (etiket/proje bazlı otomatik zincir).

### Kısa Vadeli

#### ✅ İş Kodu (Task Code) Üretimi — TAMAMLANDI (2026-06-27)
> Git entegrasyonunun **ön koşulu**. Tasarım: `docs/superpowers/specs/2026-06-27-is-kodu-design.md`. **Karar:** tek global önek `TORA-0001` (birim öneki yerine — daha basit).
- [x] `tasks.code` (VARCHAR(20), **unique**, **değişmez**); V32 `task_code_seq` + DEFAULT `TORA-nnnn`
- [x] Üretim **DB düzeyi**: Hibernate `@Generated(INSERT)` → tüm insert yolları otomatik kod alır (normal görev **ve** zincir görev `TaskChainService.spawn` — E2E doğrulandı)
- [x] Geriye dönük: mevcut işlere `id` sırasına göre kod (en eski = `TORA-0001`), idempotent backfill
- [x] Arama: `SearchService` görevleri **koda göre** de bulur (tam + kısmi; `TORA-0002`/`0002` doğrulandı)
- [x] Frontend: kod rozeti (TaskModal başlığı + TaskCard + TaskListView)
- **Not (kapsam dışı):** raporlarda kod sütunu; önekin admin panelinden değiştirilmesi → ileride. **Sonraki:** Git entegrasyonu (kod = branch/MR glue).

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
#### ✅ Git Entegrasyonu (Inbound / Webhook) — TAMAMLANDI (2026-06-28)
> **Tasarım:** `docs/superpowers/specs/2026-06-27-git-entegrasyonu-inbound-design.md` · **Plan:** `docs/superpowers/plans/2026-06-27-git-entegrasyonu-inbound.md`

GitHub/GitLab/Gitea webhook'ları iş koduyla (`TORA-\d+`) görevlere bağlanıyor; commit/MR `task_git_links`'e idempotent yazılıyor; admin-ayarlı durum senkronu (MR merge → COMPLETED zincir görevleri de tetikliyor).
- [x] V33 migration: `git_settings` (tek satır, secret şifreli) + `task_git_links` (unique `(task_id,platform,link_type,external_id)`) + `git-otomasyonu` sistem kullanıcısı
- [x] Platform-bağımsız çekirdek (`GitWebhookService`) + parser/platform (`Github`/`Gitlab`/`Gitea`WebhookParser), imza doğrulama (HMAC-SHA256 / token), `HmacUtil` (constant-time)
- [x] Ham gövde controller (`/api/webhooks/git/{platform}`, JWT'siz `permitAll`, imza ile korunur, 401/404/200), `SecurityConfig` + Nginx UA-filtre baypası (guard map)
- [x] Durum senkronu sistem aktörü (`updateTaskStatusAsSystem`) → COMPLETED'te `TaskCompletedEvent` (çift tetikleme guard); admin ayar sayfası + TaskModal "Bağlı commit/MR" paneli (`TaskDTO.gitLinks`)
- [x] Birim testleri: `HmacUtilTest`, 3 parser testi, `GitWebhookServiceTest`; docs güncellendi (schema · architecture · api-reference · frontend)
- [x] Admin Git ayar paneli tema uyumu (2026-06-28): stilsiz HTML → Catppuccin (`GitSettings.css`); toggle switch, platform renkli webhook rozetleri, Kopyala butonları, responsive grid
- **Sonraki sub-project (backlog):** outbound (iş içinden "Branch/MR oluştur", repo token + git API yazma), aktör email-eşleme (`resolveGitActor`), smart-commit komutları (`TORA-42 #done`)
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
- [x] **Bulk işlem tx bütünlüğü** — `bulkOperation` tek transaction'da çalışıyordu; bir görev DB hatası verince tüm grup rollback olabilir, "succeeded" sayısı yanıltıcı olurdu.
  - **Düzeltme (2026-06-27):** `bulkOperation` `@Transactional(propagation = NOT_SUPPORTED)` yapıldı; her görev `@Lazy` self-proxy üzerinden (`self.updateTaskStatus/bulkAssign/deleteTask`) kendi `REQUIRED` tx'inde işleniyor → başarılılar kalıcı, hatalı izole. Doğrulama: 2 geçerli + 1 geçersiz id → `{succeeded:2, failed:1}` ve iki görev DB'de gerçekten değişti.
- [ ] **Durum geçişi tek noktadan değil** — status hem `updateTaskStatus` hem `updateTask` hem `createTask`'ta set ediliyor (3 yer). Yan etkiler (bildirim/log/SLA/zincir) dağınık tetikleniyor; ileride tek "status transition" yardımcısında toplanmalı (event tabanlı). Zincir için #2'de kısmen ele alındı.
- [ ] **Ölü kolon temizliği** — `tasks.is_postponed` / `postponed_to_date` / `postponed_from_date` / `task_type` (deprecated, V18 sonrası kullanılmıyor). Bir migration'da drop edilebilir (Task.java'da not mevcut). Düşük öncelik.
- [ ] **Durum makinesi yok** — herhangi bir durumdan herhangi birine geçişe izin var (ör. COMPLETED → OPEN serbest). İş kuralı gerekiyorsa geçiş validasyonu eklenebilir.
- [ ] **Subtask Set + id-eşitliği** — `Task.subtasks` `Set<Subtask>`, `Subtask` `@EqualsAndHashCode(of="id")`. Henüz id almamış birden çok yeni subtask `Set`'te aynı (null id) sayılıp **çakışabilir** → tek seferde çok subtask eklenince bir kısmı düşebilir. (Zincir tarafında `chains` `List`'e çevrilerek çözüldü; subtask'ta doğrulanmalı.) Düşük-orta öncelik.

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

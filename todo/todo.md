# TORA — Geliştirme Planı

## Proje Yapısı
Yönetici > Birim Amiri > Birim Personeli  
Birimler: Sistem · Network · Yazılım · Test · Some  
Roller: `ADMIN` · `BIRIM_AMIRI` · `YAZILIMCI` · `DEVOPS` · `IS_ANALISTI` · `TESTCI`

---

## ✅ Tamamlananlar

### Temel Altyapı
- [x] Docker Compose (postgres + backend + frontend/nginx)
- [x] Liquibase veritabanı migration (V1–V23)
- [x] Spring Boot 3.2 + JPA/Hibernate + PostgreSQL 15
- [x] React 18 + TypeScript + Vite
- [x] Catppuccin Mocha dark tema (CSS custom properties)

### Kimlik Doğrulama & Yetkilendirme
- [x] JWT stateless authentication (24 saat, yapılandırılabilir)
- [x] LDAP + Local User hibrit authentication (LDAP önce, fallback local)
- [x] Spring Security rol hiyerarşisi (`ADMIN > BIRIM_AMIRI > USER`)
- [x] Rate limiting — IP bazlı, `LoginAttemptService` (DB tabanlı)
- [x] Account lockout — başarısız giriş takibi (yapılandırılabilir eşik/süre)

### Güvenlik Sertleştirme
- [x] **AES-GCM + PBKDF2 şifreleme** — `EncryptionService`: AES/GCM/NoPadding, rastgele 12-byte IV, PBKDF2WithHmacSHA256 (65 536 iter, 256-bit); eski ECB kayıtlar "GCM:" prefix ile geriye dönük uyumlu
- [x] **JWT token revocation** — `TokenBlacklistService` (Caffeine, 24h TTL, 10K kapasite); `POST /api/auth/logout` blacklist'e ekliyor; her istekte kontrol
- [x] **Refresh token** — `RefreshTokenService` (Caffeine, 7 gün TTL, rotate-on-use); login'de çift token; frontend proaktif yenileme (5 dk öncesi) + expire olunca otomatik refresh
- [x] **HTTP güvenlik başlıkları** — X-Frame-Options (DENY), X-Content-Type-Options, HSTS (1 yıl, includeSubDomains), Content-Security-Policy
- [x] **`@CrossOrigin("*")` kaldırıldı** — 18 controller'ın tamamından temizlendi; CORS merkezi `SecurityConfig` üzerinden yönetiliyor
- [x] **LDAP log temizliği** — `LdapConfig`, `LdapImportService`, `LdapSettingsService`'teki tüm `System.out/err.println` → SLF4J; şifre loga düşmüyor
- [x] **Şifreleme anahtarı rotation** — `updateLdapSettings()`'te ECB-şifreli mevcut parola otomatik GCM'e yükseltiliyor
- [x] **Admin audit log** — `AdminService`'te kullanıcı/birim oluşturma/güncelleme/silme `SystemLogService`'e yazılıyor (kim · ne zaman · ne yaptı)
- [x] **Login geçmişi görünümü** — `GET /api/users/me/login-history`; Profil → Ayarlar sekmesinde son 10 giriş (IP, tarih/saat, başarılı/başarısız)
- [x] AES-256 şifreleme (LDAP şifreleri, DB'de şifreli)

### Kullanıcı & Birim Yönetimi (Admin)
- [x] Kullanıcı ekleme / düzenleme / silme (soft delete)
- [x] Kullanıcıyı birime atama, rol değiştirme
- [x] LDAP kullanıcı arama ve import
- [x] Birim amiri atama, üye yönetimi (ekleme/çıkarma)
- [x] Birim renk ve ikon ayarlama

### Görev Yönetimi
- [x] Görev CRUD (oluştur/düzenle/sil/durum güncelle)
- [x] Alt görev (subtask) desteği
- [x] Öncelik seviyeleri (NORMAL / HIGH / URGENT)
- [x] Esnek etiket sistemi (TaskLabel — task_type yerine)
- [x] Erteleme takibi ve gecikme hesaplama (OVERDUE tespiti, scheduled job)
- [x] Görev geçmişi / aktivite log (TaskLog — tüm CRUD işlemleri)
- [x] Görev yorumları (`task_comments`) + `@mention` otomatik tamamlama
- [x] Görev yorumlarında bildirim (`COMMENT_MENTION` + `COMMENT_ON_TASK`)

### Görünümler & Takvim
- [x] Aylık takvim görünümü (CalendarView)
- [x] Haftalık görünüm (WeekView)
- [x] 12 aylık genel bakış (MonthView)
- [x] Kanban board (durum bazlı sütunlar)
- [x] Gantt chart (timeline + subtask hiyerarşisi)
- [x] Liste görünümü (TaskListView) — sayfalama, 20 kayıt/sayfa
- [x] Takım planlama görünümü (TeamPlannerView)

### Bildirim Sistemi
- [x] `TASK_ASSIGNED` — görev atandığında
- [x] `TASK_STATUS_CHANGED` — durum değişiminde (atanan + oluşturan)
- [x] `TASK_DUE_SOON` — bitiş 1 gün kala (her sabah 08:00 cron)
- [x] `COMMENT_MENTION` / `COMMENT_ON_TASK` — yorum bildirimleri
- [x] Header bildirim zili + okunmamış badge (30 sn polling)
- [x] Bildirim panel (okundu yap, sil, sayfalama, okunmuş=soluk/yeni=canlı)
- [x] Timestamp UTC düzeltmesi (`LocalDateTime` → `Z` suffix ile doğru saat)

### Dashboard & Raporlama
- [x] Birim dashboard (istatistik, leaderboard, grafik)
- [x] Genel özet sayfası (tüm birimler özet)
- [x] Dashboard cache (Caffeine, 5 dk TTL, görev mutasyonlarında evict)

### Profil & UX
- [x] Kullanıcı profili — isim değiştirme, parola değiştirme
- [x] Görev bazlı kişisel dashboard (Profil → Dashboard sekmesi)
- [x] Toast bildirim sistemi (success / error / warn / info)
- [x] Ortak LoadingSpinner bileşeni
- [x] Form inline doğrulama (`formValidation.ts` + `field-error`)
- [x] ARIA erişilebilirlik (role, aria-live, aria-invalid, prefers-reduced-motion)
- [x] Responsive tasarım (desktop 4 sütun → tablet 2–3 → mobile 1)

### Performans & Altyapı
- [x] Route-level lazy loading (`React.lazy()` + Suspense)
- [x] Vite chunk splitting (`vendor-react` / `vendor-date` / `vendor-http`)
- [x] DB index optimizasyonu (V23: `task_assignees.user_id`, `tasks.created_by`, `tasks(team_id,status)`)
- [x] Sistem logları (backend + frontend error logger)
- [x] Sistem sağlığı kontrolü (HealthController + SystemHealthController)
- [x] AOP logging — sadece write operasyonları + hatalar DB'ye yazılıyor
- [x] Log temizleme (sistem: 30 gün, görev: 90 gün — scheduled job)
- [x] HikariCP bağlantı havuzu (keepalive, sızıntı tespiti)

### UX Borcu
- [x] Tüm sayfada kapsamlı responsive denetimi (tablet/mobil) — 900 px tablet breakpoint eklendi, Header kırılıyor
- [x] Tüm bileşende WCAG 2.1 AA uyumluluk denetimi — skip link, focus ring, aria-label, aria-current, role eklemeleri
- [x] Klavye kısayolları (güç kullanıcı navigasyonu) — `?` yardım paneli, `g h/p/d/a/u` navigasyon
- [x] Hata sayfaları iyileştirme (500, 403, ağ hatası) — ErrorPage + ErrorBoundary eklendi, /403 /500 /network-error rotaları
- [x] Dark / Light mod geçişi (Catppuccin Latte alternatifi) — ThemeContext + Header toggle, localStorage kalıcı


---

## ⚡ Performans Optimizasyonu (aktif sprint)

> Hedef: Tek kullanıcıda bile takvim/dashboard/kanban gecikmelerini ortadan kaldırmak.  
> Redis yok — uygulama katmanı düzeltmeleri.

### 1. N+1 — Task listesi [ROI: ÇOK YÜKSEK]
**Sorun:** `convertToDTO()` her task için `team`, `createdBy`, `project`, `assignees`, `subtasks`, `labels` ilişkilerini LAZY yükler → N task = ~6N ek SELECT.  
**Plan:**
- [x] `Task` entity — `assignees`, `subtasks`, `labels` koleksiyonlarına `@BatchSize(size = 50)` ekle (multiple-bag hatasını önlemek için JOIN FETCH yerine batch loading)
- [x] `TaskRepository` — tüm liste sorgularına (`findByTeamId`, `findByTeamIdAndYear`, `findByTeamIdAndYearAndMonth`, `findByTeamIdsAndYear`, `findByTeamIdsAndYearAndMonth`, `findByProjectId*`, `findByTeamIdsAndDateRange`) `LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project` ekle (ManyToOne — güvenli)
- [x] YEAR()/MONTH() fonksiyon sorguları → `startDate >= :from AND startDate < :to` aralık sorgularına dönüştürüldü (index kullanımı için)
- [x] Test: build başarılı, servisler healthy

### 2. Kanban — gereksiz full refetch [ROI: YÜKSEK, değişiklik trivial]
**Sorun:** `CalendarPage.tsx handleStatusChange` → status güncelleme sonrası tüm yılın task listesini `getTasks` ile refetch ediyor; `updateTaskStatus` zaten güncel task döndürüyor.  
**Plan:**
- [x] `handleStatusChange` içinde `getTasks` çağrısını kaldır
- [x] `updateTaskStatus` response'unu `setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t))` ile uygula
- [x] `handleTaskSaved` ile aynı pattern — tutarlılık sağlanır

### 3. Dashboard — SQL aggregation [ROI: YÜKSEK]
**Sorun:** `getTeamDashboardStats` → her takım için tüm task listesi DB'den çekiliyor, Java stream ile sayılıyor. `getTopCompleters` / `getTopCancellers` aynı listeyi ikinci/üçüncü kez yüklüyor.  
**Plan:**
- [x] `TaskRepository`'ye yeni JPQL sorguları eklendi: `countByTeamIdsGroupByStatus`, `countByTeamIdsAndDateRangeGroupByStatus`, `findTopAssigneesByTeamIdsAndStatus`, `findTopAssigneesByTeamIdsAndStatusAndDateRange`
- [x] `DashboardService.getTeamDashboardStats()` → tek SQL GROUP BY sorgusuna çevrildi; tüm task listesi yükü kaldırıldı
- [x] `getTopCompleters` / `getTopCancellers` → `getTopAssignees()` olarak birleştirildi, SQL GROUP BY + ORDER BY ile çalışıyor
- [x] Cache key'i ve `@Cacheable` davranışı korundu

### 4. JWT filter — her istekte DB [ROI: ORTA]
**Sorun:** `JwtAuthenticationFilter` → `userDetailsService.loadUserByUsername(username)` → her istekte DB.  
**Plan:**
- [x] `CacheConfig`'e `userDetails` cache eklendi (Caffeine, 5 dk TTL, 500 kapasite)
- [x] `UserDetailsServiceImpl.loadUserByUsername()` → `@Cacheable("userDetails")` + `evictUserCache(username)` helper metot
- [x] `AdminService.updateUser` + `deleteUser` → `evictUserCache` çağrısı eklendi
- [x] `AuthController.logout` → token'dan username çıkarılıp `evictUserCache` çağrısı eklendi
- [x] Güvenlik korundu: blacklist token bazlı çalışmaya devam ediyor

### 5. YEAR() sorguları → tarih aralığına çevir [ROI: ORTA]
**Sorun:** `YEAR(t.startDate) = :year` ve `MONTH(t.startDate) = :month` fonksiyon çağrıları `idx_tasks_team_status` ve diğer index'leri bypass eder.  
**Plan:**
- [x] `TaskRepository` YEAR/MONTH sorguları → `startDate >= :from AND startDate < :to` aralık sorgularına dönüştürüldü (Adım 2'de yapıldı)
- [x] `TaskService.getTasks()` → year/month parametrelerini `LocalDate` aralığına çeviriyor
- [x] `V25__performance_index_start_date.xml` — `tasks(team_id, start_date)` ve `tasks(project_id, start_date)` composite index eklendi; Liquibase başarıyla uyguladı

### 6. Dashboard cache — teamId bazlı eviction [ROI: DÜŞÜK-ORTA]
**Sorun:** Her task mutasyonunda `allEntries = true` tüm dashboard cache'ini temizliyor; farklı birimlerin cache'i gereksiz yere kayboluyor.  
**Plan:**
- [x] `TaskService` CRUD metodlarındaki `@Caching(allEntries=true)` → kaldırıldı
- [x] `evictDashboardCache(teamId)` helper eklendi: Caffeine native cache üzerinden `teamId:` ve `null:` prefix'li key'leri hedefli temizler
- [x] `createTask`, `updateTask`, `deleteTask`, `updateTaskStatus` → `evictDashboardCache` çağrısına geçildi

### Kabul Kriterleri
- [ ] `GET /api/tasks?teamId=X&year=2026` — Hibernate log'da N task için ≤ 5 sorgu (önceki: ~6N)
- [ ] Kanban'da durum değiştirme → sıfır ekstra network isteği (sadece PUT /status)
- [ ] `GET /api/teams/{id}/dashboard/details` — Java profiler/log ile tek sorgu turunda döner
- [ ] JWT filter: ikinci istekte `SELECT * FROM users WHERE username=?` görünmemeli

---

## 🔜 Kısa Vadeli

### Dosya Eki Yükleme
- [ ] `task_attachments` tablosu (Liquibase migration)
- [ ] Dosya depolama servisi (local filesystem, `/uploads` volume)
- [ ] `POST/GET/DELETE /api/tasks/{id}/attachments` endpoint'leri
- [ ] TaskModal içinde drag & drop yükleme alanı
- [ ] Dosya boyutu limiti (10 MB), izin verilen türler (pdf, png, jpg, docx, xlsx)
- [ ] İndirme linki + önizleme (görsel dosyalar için)

### API Dokümantasyonu
- [ ] SpringDoc OpenAPI (Swagger UI) entegrasyonu
- [ ] `/api/docs` path'inde Swagger UI (sadece admin erişimli veya dev profil)
- [ ] Her endpoint'e `@Operation` / `@Tag` açıklaması
- [ ] DTO'lara `@Schema` annotation'ları

### İki Faktörlü Doğrulama (2FA)
- [ ] TOTP tabanlı 2FA (Google Authenticator uyumlu)
- [ ] Kullanıcı bazlı 2FA aktif/pasif ayarı (Profil → Ayarlar)
- [ ] Admin panelinde zorunlu 2FA politikası (ADMIN rolü için)
- [ ] QR kod üretme ve doğrulama endpoint'leri

### Session Yönetimi
- [ ] Aktif refresh token listesi görünümü (cihaz/IP/tarih)
- [ ] Tek bir session'ı sonlandırma (token invalidate)
- [ ] "Tüm diğer cihazlardan çıkış yap" özelliği

---

## 🔮 Orta Vadeli

### Görev Bağımlılıkları
- [ ] `task_dependencies` tablosu (blocking / blocked_by ilişkisi)
- [ ] Görev detayında bağımlılık ekleme/kaldırma UI
- [ ] Gantt chart'ta bağımlılık okları
- [ ] Bağımlı görev tamamlanmadan bağımlı görev başlatılamaz kuralı

### Tekrarlayan Görevler
- [ ] Tekrar şablonu (günlük / haftalık / aylık / özel cron)
- [ ] Scheduled job ile otomatik görev oluşturma
- [ ] Tekrar serisini düzenleme (bu oluşumdan itibaren / tüm seri)

### Zaman Takibi
- [ ] `time_entries` tablosu (görev + kullanıcı + başlangıç/bitiş)
- [ ] Görev üzerinde "Başla / Durdur" zamanlayıcı
- [ ] Manuel saat girişi
- [ ] Harcanan süre görünümü (görev + birim + kişi bazlı)

### Toplu Görev İşlemleri
- [ ] Liste/Kanban görünümünde çoklu seçim (checkbox)
- [ ] Toplu durum değiştirme, birim/proje taşıma, atama
- [ ] Toplu silme (sadece ADMIN / BIRIM_AMIRI)

### Arama & Filtreleme
- [x] Global arama (görev, proje, kullanıcı — header arama çubuğu)
- [x] PostgreSQL full-text search (`tsvector` / `tsquery`)
- [x] Anlık sonuç dropdown (debounce 300 ms)
- [x] Sonuçları varlık türüne göre gruplama (Görevler / Projeler / Kullanıcılar)
- [x] Gelişmiş filtreler (durum, öncelik, etiket, atanan kombinasyonları)
- [x] Kaydedilmiş filtreler / hızlı filtre favorileri

### Raporlama & Analitik
- [ ] Haftalık/aylık birim performans raporu (PDF export)
- [ ] Birim karşılaştırma grafikleri (tamamlanan/geciken/toplam)
- [ ] Kişisel verimlilik metrikleri (ortalama tamamlama süresi)
- [ ] Excel export (görev listesi filtrelenmiş)
- [ ] Süreç süresi analizi (görev açılış → kapanış istatistikleri)

### Takvim Geliştirmeleri
- [ ] Sürükle-bırak görev taşıma (takvim görünümünde)
- [ ] Günlük detay görünümü (saat bazlı timeline)
- [ ] iCal export (Google Calendar / Outlook entegrasyonu)
- [ ] Tatil ve resmi izin günleri görünümü
- [ ] Yazdırma dostu takvim çıktısı

### Sprint / Milestone Desteği
- [ ] `milestones` tablosu (proje milestone'ları, tarih + başlık)
- [ ] `sprints` tablosu (başlangıç/bitiş, hedef, birim)
- [ ] Görevleri sprint veya milestone'a bağlama
- [ ] Sprint board görünümü (farklı Kanban)
- [ ] Burndown chart (sprint bazlı)
- [ ] Proje ilerleme yüzdesi widget'ı

---

## 🚀 Uzun Vadeli

### Bildirim Geliştirmeleri
- [ ] WebSocket (STOMP) ile gerçek zamanlı bildirimler (polling yerine)
- [ ] E-posta bildirim tercihleri (kullanıcı bazlı — hangi olaylar)
- [ ] E-posta şablonları (görev atama, yaklaşan bitiş)

### Mobil & PWA
- [ ] Progressive Web App (Service Worker, offline destek, yüklenebilir)
- [ ] Push notification (tarayıcı bildirimi — Web Push API)
- [ ] Mobil uyumlu görev oluşturma/düzenleme akışı

### Otomasyon & Entegrasyon
- [ ] Webhook desteği (görev olaylarında dış URL çağrısı)
- [ ] Slack / Microsoft Teams entegrasyonu (bildirim köprüsü)
- [ ] E-posta ile görev oluşturma (IMAP listener)
- [ ] Otomatik görev atama kuralları (round-robin, birim bazlı)
- [ ] SLA takibi (yapılandırılabilir eşikler, ihlal bildirimi)

### Gelişmiş Güvenlik
- [ ] IP allowlist (admin panel sadece belirli IP'lerden)
- [ ] Gelişmiş CSP — nonce tabanlı inline script kontrolü
- [ ] Güvenlik tarama raporu (OWASP ZAP entegrasyonu)
- [ ] Penetrasyon testi hazırlığı (gizli uç nokta denetimi)

---

## 🔴 Güvenlik Açıkları (Aktif Tarama — 2026-06-07)

> Kod taramasıyla tespit edilmiş, doğrulanmış açıklar. Önem sırasına göre sıralanmıştır.  
> Kural: Bu bölümdeki her madde kapatılmadan production'a yeni özellik deploy edilmez.

### KRİTİK — Hemen Kapatılmalı

- [x] **Kimlik doğrulamasız ADMIN kaydı** — `AuthController.java:259` + `SecurityConfig.java:71`  
  `/api/auth/register` endpoint'i `permitAll()` ve `role` alanı kullanıcıdan geliyor; herkes `{"role":"ADMIN"}` ile admin hesabı açabiliyor.  
  **Düzeltme:** `register` endpoint'ini `SecurityConfig`'den kaldır, `AdminController`'a taşı ve `@PreAuthorize("hasRole('ADMIN')")` ekle. Ya da `CreateLocalUserRequest.role` alanını kaldırıp sabit `USER` ata.

- [ ] ~~**Varsayılan admin şifresi `admin/admin`**~~ — `V4__create_admin_user.xml:16` — **ATLANDI** (default olarak kalacak, kullanıcı kendi değiştirir)  
  Liquibase migration'da bcrypt(`admin`) hash'i sabit gömülü; deploy edilen her ortamda bu hesap aktif.  
  **Düzeltme:** Migration'dan şifreyi kaldır, `JWT_SECRET` gibi `ADMIN_INITIAL_PASSWORD` env değişkeninden al ve hash'i runtime'da `SampleDataInitializer` içinde oluştur. Ya da ilk girişte zorunlu şifre değiştir.

### YÜKSEK — Bu Sprint İçinde Kapatılmalı

- [x] **Kullanıcı listesi — email ifşası** — `AuthController.java:285`  
  `GET /api/auth/users` endpoint'i task atama/mention için gerekmekte ancak email dahil hassas alanları herkese açıyordu.  
  **Düzeltme:** `SimpleUserDTO` oluşturuldu; endpoint artık email döndürmuyor. `/api/admin/users` hâlâ tam bilgi veriyor.

- [x] **Varsayılan JWT secret ve Encryption key** — `application.yml:55,80`  
  `JWT_SECRET` ve `ENCRYPTION_KEY` env değişkeni set edilmezse bilinen default değerler kullanılıyordu.  
  **Düzeltme:** `JwtConfig` ve `EncryptionService`'e `@PostConstruct` doğrulama eklendi; `ENFORCE_SECRET_VALIDATION=true` ile default değer tespitinde uygulama başlamıyor. Docker-compose dev'de `false`.

### ORTA — Sonraki Sprint

- [x] **LDAP auto-provisioning soft-delete bypass** — `LdapAuthService.java:239-243`  
  Admin tarafından soft-delete edilen kullanıcı, LDAP hesabı hâlâ aktifse giriş yaparak eski rolleriyle reaktive oluyordu.  
  **Düzeltme:** `syncUserFromLdap()` soft-deleted kullanıcıyı reaktive ederken artık tüm rolleri temizliyor; admin yeniden rol ataması yapmalı.

- [x] **EncryptionService sabit KDF salt** — `EncryptionService.java:28`  
  `KDF_SALT = "Tora-v2"` (7 byte) sabit ve NIST minimumunun (16 byte) altında.  
  **Düzeltme:** `ENCRYPTION_SALT` env değişkeninden okunuyor; default `Tora-v2` geri uyumlu. Production'da `openssl rand -base64 16` ile özel salt set edilmeli.

---

## 🔴 Güvenlik Açıkları (Aktif Tarama — 2026-06-10)

> Fable 5 ile yapılan ikinci kod taraması. Yukarıdaki 2026-06-07 bulgularından **farklı**.  
> Doğrulandı: JWT secret default doğrulaması `JwtConfig.validateJwtSecret()` ile zaten kapalı — tekrar açılmadı.  
> **Durum (2026-06-26): Tüm maddeler kapatıldı.** Düzeltmeler aşağıda her maddenin altında.

### YÜKSEK — ✅ Kapatıldı

- [x] **X-Forwarded-For spoof ile rate-limit / hesap kilidi baypası** — `AuthController.java`  
  **Açık:** `getClientIpAddress()` önce istemci kontrolündeki `X-Forwarded-For`'u okuyup `split(",")[0]` ile ilk değeri alıyordu; nginx XFF'yi `proxy_add_x_forwarded_for` ile *eklediğinden* ilk eleman saldırganın gönderdiği değerdi → sahte XFF ile IP brute-force/lockout baypası.  
  **Düzeltme:** `getClientIpAddress()` artık client kontrolündeki XFF'ye güvenmiyor; nginx'in set ettiği (spoof edilemez, tek değer) **`X-Real-IP`** birincil kaynak, yoksa `remoteAddr`.

- [x] **Kullanıcı adı enumerasyonu — login `code` alanı** — `AuthController.java`  
  **Açık:** Mesaj her durumda "Invalid username or password" olsa da yanıttaki `code` alanı `USER_NOT_FOUND` ↔ `INVALID_PASSWORD` olarak farklılaşıyordu.  
  **Düzeltme:** Tüm kimlik doğrulama hataları artık tek genel **`AUTHENTICATION_FAILED`** kodu + aynı mesajı döndürüyor; `USER_NOT_FOUND`/`INVALID_PASSWORD`/`LDAP_AUTHENTICATION_FAILED` ayrımı kaldırıldı, spesifik neden yalnızca sunucu logunda.

### ORTA — ✅ Kapatıldı

- [x] **CORS: `allowCredentials(true)` + origin pattern `*`** — `SecurityConfig.java`  
  **Açık:** `CORS_ALLOWED_ORIGINS=*` modunda `setAllowedOriginPatterns(["*"])` + `setAllowCredentials(true)` her origin'i credential'la yansıtıyordu.  
  **Düzeltme:** Token Authorization header'da taşındığından **`allowCredentials(false)`** yapıldı (cookie yok) — asıl açık olan `*`+credentials yansıması ortadan kalktı. Ayrıca production'da (`ENFORCE_SECRET_VALIDATION=true`) `*` origin kullanılırsa başlangıçta **uyarı logu** basılıyor (credential'sız wildcard düşük riskli olduğundan uygulama yine başlar; açık origin listesi önerilir).

- [x] **In-memory token blacklist & refresh store — kalıcı değil** — `TokenBlacklistService.java`, `RefreshTokenService.java`  
  **Açık:** Caffeine cache tek instance ve süreç ömrüyle sınırlıydı; restart'ta blacklist temizleniyor, çok-instance'ta paylaşılmıyordu.  
  **Düzeltme:** Her ikisi **DB'ye taşındı** (V28: `revoked_tokens`, `refresh_tokens`). Token'lar **SHA-256 hash** olarak saklanıyor (plaintext değil); blacklist JWT expiry'siyle, refresh token 7 gün TTL + rotate-on-use. Süresi dolan kayıtlar saatlik `@Scheduled` job ile temizleniyor. Restart/çok-instance güvenli. (Redis'e geçiş ileride opsiyonel.)

### DÜŞÜK — ✅ Kapatıldı

- [x] **LDAP test endpoint'leri ham `e.getMessage()` döndürüyor** — `LdapSettingsController.java`  
  **Açık:** Test/güncelleme yanıtlarında iç istisna mesajı (DN, bağlantı detayı) dönebiliyordu.  
  **Düzeltme:** Endpoint'ler artık genel mesaj döndürüyor ("Ayrıntılar sunucu loglarında"); tam istisna `logger.error` ile yalnızca sunucu loguna yazılıyor.  
  **+ docker-compose:** Sabit DB parolası (`postgres`) → `${DB_PASSWORD:-postgres}` env değişkenine taşındı (hem `postgres.POSTGRES_PASSWORD` hem `backend.DB_PASSWORD`).

---

## 🐛 Teknik Borç & İyileştirmeler

### Kod Kalitesi
- [ ] Unit test coverage — servis katmanı (JUnit 5 + Mockito)
- [ ] Integration test — REST endpoint'leri (`@SpringBootTest` + Testcontainers)
- [ ] E2E test — kritik akışlar (Playwright veya Cypress)
- [ ] Frontend component test (React Testing Library)


# Zincir Görevler (Chain Tasks) — Tasarım Belgesi

**Tarih:** 2026-06-27
**Durum:** Onaylandı (uygulama bekliyor)
**Kapsam:** "Tekrarlayan / Zincir Görevler" backlog maddesinin **zincir** kısmı. Tekrarlayan (zaman tetiklemeli) görevler ayrı bir sonraki iş olarak ele alınacaktır.

---

## 1. Amaç ve senaryo

Bir görev **tamamlandığında**, önceden tanımlanmış bir veya birden çok **takip görevi** otomatik olarak oluşur — bunlar başka birimlere de düşebilir. Böylece birimler arası standart iş akışları elle iş açmadan zincirlenir.

**Gerçek senaryo (System birimi):**
Bir "sunucu açma" işi tamamlandığında otomatik olarak:
1. İzleme görevi (Grafana/Zabbix) — System birimine
2. "Böyle bir sunucu açıldı" görevi — Network birimine
3. "Loglar geliyor mu" görevi — Some ekibine

Üçü birden, ilgili birimlere, iş tamamlandığı anda açılır.

---

## 2. Alınan kararlar (özet)

| Konu | Karar |
|---|---|
| Tanım nerede | Görev üzerinde **inline** (göreve eklenir), ayrı kural motoru yok |
| Çokluk | **Çoklu takip**: bir görev → birden çok takip tanımı (farklı birimlere) |
| Derinlik | **Tek adım**: üretilen görev kendi zincir tanımını taşımaz → döngü imkânsız |
| Tarih | **Göreli**: `startDate` = tamamlanma günü, `endDate` = tamamlanma günü + `durationDays` |
| Tetikleyici | **Sadece COMPLETED** (CANCELLED tetiklemez) |
| Oluşturan (createdBy) | Kaynağı COMPLETED yapan **kullanıcı** |
| Atanan (assignee) | Tanımda seçilen hedef birim kullanıcı(ları); boş bırakılabilir |
| Erişim | Sistem ürettiği için hedef birim **erişim kontrolü baypas** edilir |
| İzlenebilirlik | Üretilen görevde kalıcı `spawned_from_task_id` bağı + task log kayıtları |
| Hata davranışı | **Best-effort**: bozuk bir tanım kaynağın tamamlanmasını asla engellemez |
| Bir-kez garantisi | Her tanım yalnızca bir kez tetiklenir (`triggered_at`); reopen→recomplete tekrar üretmez |

**Sonraki adım (bu kapsamın dışında):** Etiket/proje bazlı **tekrar kullanılabilir şablon** — aynı üretim motorunun üzerine eklenecek.

---

## 3. Veri modeli (Liquibase V31)

### Yeni tablo: `task_chains`
Bir kaynak görevin **birden çok** satırı olabilir (her satır = bir takip tanımı).

| Alan | Tip | Kısıt | Açıklama |
|---|---|---|---|
| `id` | bigserial | PK | |
| `source_task_id` | bigint | FK→`tasks(id)`, NOT NULL, ON DELETE CASCADE | tanımın bağlı olduğu kaynak görev (unique DEĞİL) |
| `title` | varchar(255) | NOT NULL | takip görevinin başlığı |
| `content` | text | NULL | |
| `target_team_id` | bigint | FK→`teams(id)`, NOT NULL | hedef birim (aynı veya farklı) |
| `target_project_id` | bigint | FK→`projects(id)`, NULL | opsiyonel |
| `priority` | varchar(20) | NULL | boşsa üretimde NORMAL |
| `duration_days` | int | NOT NULL, ≥0 | `endDate = completionDay + durationDays` |
| `triggered_at` | timestamp | NULL | bir-kez garantisi; doluysa tekrar üretmez |
| `created_at` | timestamp | NOT NULL | |
| `updated_at` | timestamp | NOT NULL | |

İndeks: `idx_task_chains_source` (`source_task_id`).

### Yeni tablo: `task_chain_assignees`
| Alan | Tip | Kısıt |
|---|---|---|
| `chain_id` | bigint | FK→`task_chains(id)`, ON DELETE CASCADE |
| `user_id` | bigint | FK→`users(id)`, ON DELETE CASCADE |

PK (`chain_id`, `user_id`).

### `tasks` tablosuna yeni kolon
| Alan | Tip | Kısıt | Açıklama |
|---|---|---|---|
| `spawned_from_task_id` | bigint | FK→`tasks(id)`, NULL, **ON DELETE SET NULL** | üretilen görev → kaynağı; kaynak silinse de çocuk kalır |

İndeks: `idx_tasks_spawned_from` (`spawned_from_task_id`).

---

## 4. Backend tasarımı

### 4.1 Entity'ler
- **`TaskChain`** (yeni): `@ManyToOne` source `Task`; `@ManyToMany` assignees (`task_chain_assignees`); `@ManyToOne` targetTeam, targetProject; alanlar yukarıdaki gibi. `@PrePersist/@PreUpdate` ile `created_at/updated_at`.
- **`Task`** (değişiklik): `spawnedFrom` için `@ManyToOne(fetch = LAZY) @JoinColumn(name = "spawned_from_task_id")`. Kaynak görevin tanımlarına erişim için `@OneToMany(mappedBy = "source", cascade = ALL, orphanRemoval = true)` `Set<TaskChain> chains`.

### 4.2 Servis: `TaskChainService` (yeni)
Tek sorumluluk: zincir tanımlarını yönetmek ve tetiklemek. İzole, test edilebilir.

- **`upsertChains(Task source, List<TaskChainRequest> defs)`** — create/update sırasında çağrılır. Mevcut tanımları verilen listeye göre günceller (yoksa siler). `durationDays ≥ 0`, `title` zorunlu, `targetTeamId` zorunlu doğrulanır.
- **`fireIfDefined(Task source, User completer)`** — `updateTaskStatus` içinde, durum COMPLETED'e geçip kaydedildikten **sonra** çağrılır:
  1. Kaynağın `triggered_at IS NULL` olan tanımlarını al; yoksa no-op.
  2. Her tanım için yeni `Task` kur: başlık/içerik/öncelik tanımdan; `team = targetTeam` (repository üzerinden, **erişim kontrolü baypas**); `project = targetProject`; `startDate = LocalDate.now()`, `endDate = now + durationDays`; `status = OPEN`; `createdBy = completer`; atananlar = tanımdaki geçerli kullanıcılar (eksikler elenir); `spawnedFrom = source`.
  3. Kaydet → `slaService.recalculate(newTask)` → log: kaynağa `CHAIN_TRIGGERED`, yeniye `CHAIN_CREATED` → atananlara bildirim → hedef birim dashboard cache evict.
  4. `tanım.triggered_at = now`.
  5. **Her tanım kendi try/catch'inde**: biri patlarsa diğerleri devam eder, hata loglanır; kaynağın tamamlanması asla bozulmaz.

> **Düzeltme (2026-06-27 denetim):** `TaskService` `@Transactional` olduğundan, zincir tamamlama tx'i İÇİNDE çalışırsa bir spawn hatası tüm tx'i rollback-only yapıp tamamlamayı geri alır. Bu yüzden tetikleme **commit sonrası ayrı transaction'da** yapılır: `TaskCompletedEvent` yayınlanır, `@TransactionalEventListener(AFTER_COMMIT)` + `REQUIRES_NEW` ile dinlenir. Ayrıca status hem `updateTaskStatus` hem `updateTask`'tan COMPLETED'e geçebildiği için event **her iki yoldan** (yalnızca geçişte) yayınlanır. Detay: uygulama planı Task 5–6.

### 4.3 Entegrasyon noktası
`TaskService.updateTaskStatus(...)`: `notifyTaskStatusChanged` çağrısından sonra, `if (request.getStatus() == COMPLETED) taskChainService.fireIfDefined(task, currentUser);`. **Toplu işlemler** (`bulkOperation` → STATUS) zaten `updateTaskStatus`'u çağırdığı için otomatik kapsanır — ayrı kanca gerekmez.

`createTask` / `updateTask`: `request.getChains()` doluysa `taskChainService.upsertChains(task, request.getChains())`.

---

## 5. API / DTO

Yeni controller endpoint'i **yok**; mevcut görev create/update/status akışları kullanılır.

- **`TaskChainRequest`** (yeni DTO): `title`, `content`, `targetTeamId`, `targetProjectId`, `priority`, `durationDays`, `assigneeIds`.
- **`CreateTaskRequest`** (değişiklik): opsiyonel `List<TaskChainRequest> chains`.
- **`TaskChainDTO`** (yeni): gösterim için tanım alanları + `targetTeamName`, `triggeredAt`.
- **`TaskDTO`** (değişiklik): `List<TaskChainDTO> chains`; `spawnedFromTaskId`; `spawnedFromTitle`.

---

## 6. Frontend (React/TS)

- **TaskModal** — yeni katlanır bölüm **"Tamamlanınca açılacak işler"**:
  - Tanım **listesi**; `+ İş ekle` ile satır eklenir, çöp kutusuyla kaldırılır.
  - Satır alanları: başlık (zorunlu), hedef birim (select), atananlar (seçilen birimin kullanıcıları — birim değişince liste güncellenir), öncelik, süre (gün).
  - Boş liste = zincir yok.
- **Görev detayı/kart**:
  - Tanım varsa rozet/özet: "Tamamlanınca: «başlık» → «birim»" (çoklu ise sayı).
  - `spawnedFrom` doluysa: "Bu iş #X tamamlanınca oluştu" (kaynağa link).
- Hedef birim kullanıcıları mevcut kullanıcı listeleme API'siyle çekilir (yeni endpoint gerekmez).

---

## 7. Edge case'ler

- **Bir-kez garantisi:** `triggered_at` dolu tanım yeniden tetiklenmez (reopen→recomplete güvenli).
- **CANCELLED / diğer durumlar:** tetiklemez.
- **Toplu tamamlama:** `updateTaskStatus` üzerinden kapsanır.
- **Geçersiz atanan:** silinmiş kullanıcı elenir; atanan boş kalabilir.
- **Hedef birim silinmiş:** tetikleme anında targetTeam yoksa o tanım atlanır + log; diğerleri çalışır.
- **Kaynak görev silinir:** tanımlar cascade silinir; üretilmiş çocuk görevler `spawned_from_task_id = NULL` ile kalır.
- **Aynı birime zincir:** desteklenir (System → System izleme görevi).
- **Best-effort transaction:** her tanım kendi try/catch'inde; başarısızlık tamamlamayı geri almaz.

---

## 8. Test planı

Integration ağırlıklı:
1. Chain tanımlı görev COMPLETED → her tanım için doğru takip görevi (başlık, birim, atanan, `startDate=bugün`, `endDate=bugün+N`, `createdBy=tamamlayan`, `spawnedFrom`).
2. Çoklu tanım → hepsi üretilir, doğru birimlere.
3. Bir-kez garantisi: ikinci kez COMPLETED → yeni üretim yok.
4. Cross-birim: tamamlayanın erişimi olmayan hedef birime de üretim olur (baypas).
5. No-op: tanım yok / durum COMPLETED değil → üretim yok.
6. Toplu tamamlama zinciri tetikler.
7. Geçersiz atanan elenir; hedef birim silinmişse o tanım atlanır, diğerleri üretilir, tamamlama başarılı.

---

## 9. Dokümantasyon (CLAUDE.md gereği — aynı değişiklikte)

- `docs/database-schema.md` — `task_chains`, `task_chain_assignees`, `tasks.spawned_from_task_id`.
- `docs/api-reference.md` — `chains` alanı (task create/update), `TaskDTO.chains`/`spawnedFrom`.
- `docs/architecture.md` — zincir tetikleme akışı (`updateTaskStatus → TaskChainService.fireIfDefined`).
- `todo/todo.md` — zincir maddesi `[x]` + **Düzeltme/sonuç** notu.

---

## 10. Açık not (kapsam dışı, gelecek)

- **Tekrar kullanılabilir şablon:** etiket/proje bazlı otomatik zincir — aynı üretim motorunun üstüne.
- **Tekrarlayan (zaman tetiklemeli) görevler:** günlük/haftalık/cron + scheduler — ayrı iş.

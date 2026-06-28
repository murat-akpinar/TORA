# Database Schema

## Overview

TORA uses **PostgreSQL 15** as its database, with **Liquibase** managing all schema migrations. The database is automatically created and migrated when the application starts.

---

## Tables

### `users`

Stores all application users (both LDAP-imported and locally created).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `username` | VARCHAR(100) | NO | — | Unique username |
| `email` | VARCHAR(255) | NO | — | Unique email address |
| `full_name` | VARCHAR(255) | NO | — | Display name |
| `ldap_dn` | VARCHAR(500) | YES | NULL | LDAP Distinguished Name (NULL for local users) |
| `password` | VARCHAR(255) | YES | NULL | BCrypt-hashed password (NULL for LDAP users) |
| `is_active` | BOOLEAN | NO | true | Soft delete flag |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | now() | Last update timestamp |

**Unique constraints**: `username`, `email`

---

### `roles`

Role definitions for the authorization system.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `name` | VARCHAR(50) | NO | — | Unique role name |
| `description` | VARCHAR(255) | YES | NULL | Human-readable description |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |

**Unique constraints**: `name`

**Default roles (seeded by V2 migration)**:
| Name | Description |
|------|-------------|
| `ADMIN` | Full system administrator |
| `BIRIM_AMIRI` | Department head / team leader |
| `YAZILIMCI` | Software developer |
| `DEVOPS` | DevOps engineer |
| `IS_ANALISTI` | Business analyst |
| `TESTCI` | QA / Tester |

---

### `teams`

Departments / organizational units.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `name` | VARCHAR(100) | NO | — | Unique team name |
| `description` | VARCHAR(500) | YES | NULL | Team description |
| `leader_id` | BIGINT | YES | NULL | FK → `users.id` (team leader) |
| `is_active` | BOOLEAN | NO | true | Soft delete flag |
| `color` | VARCHAR(7) | YES | NULL | Hex color code (e.g., `#89b4fa`) |
| `icon` | VARCHAR(50) | YES | NULL | Emoji icon (e.g., `💻`) |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | now() | Last update timestamp |

**Unique constraints**: `name`

**Default teams (seeded by V2/V17 migrations)**:
| Name | Icon | Color |
|------|------|-------|
| Sistem Birimi | 🖥️ | #89b4fa |
| Network Birimi | 🌐 | #a6e3a1 |
| Some Birimi | 📡 | #f9e2af |
| Yazılım Birimi | 💻 | #cba6f7 |
| Test Birimi | 🧪 | #f38ba8 |

---

### `tasks`

Core task/work item records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `code` | VARCHAR(20) | NO | `TORA-nnnn` | Okunabilir iş kodu; DB üretir (`task_code_seq`), değişmez, UNIQUE (V32) |
| `title` | VARCHAR(255) | NO | — | Task title |
| `content` | TEXT | YES | NULL | Detailed description |
| `start_date` | DATE | NO | — | Task start date |
| `end_date` | DATE | NO | — | Task due date |
| `status` | VARCHAR(20) | NO | `OPEN` | Task status (enum) |
| `task_type` | VARCHAR(20) | NO | `TASK` | Task type (enum) |
| `priority` | VARCHAR(20) | NO | `NORMAL` | Priority level (enum) |
| `team_id` | BIGINT | NO | — | FK → `teams.id` |
| `project_id` | BIGINT | YES | NULL | FK → `projects.id` |
| `created_by` | BIGINT | NO | — | FK → `users.id` |
| `postponed_to_date` | DATE | YES | NULL | New date after postponement (legacy) |
| `postponed_from_date` | DATE | YES | NULL | Original date before postponement (legacy) |
| `is_postponed` | BOOLEAN | NO | false | Whether task has been postponed (legacy flag) |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | now() | Last update timestamp |

**SLA columns (V30)**: `sla_due_at` (TIMESTAMP, nullable — computed resolution deadline), `sla_status` (VARCHAR(20): `ON_TRACK`/`AT_RISK`/`BREACHED`/`MET`, indexed), `completed_at` (TIMESTAMP, set when status → COMPLETED).

**Status values** (`TaskStatus` enum): `OPEN`, `IN_PROGRESS`, `TESTING`, `COMPLETED`, `CANCELLED`

> The `POSTPONED` and `OVERDUE` statuses were retired in migration **V18** (existing rows migrated to `IN_PROGRESS`). The `postponed_*` / `is_postponed` columns remain for historical data but are no longer set by new status transitions.

**Task type values** (`TaskType` enum): `TASK`, `FEATURE`, `BUG`, `IMPROVEMENT`, `RESEARCH`, `DOCUMENTATION`, `TEST`, `MAINTENANCE`, `MEETING`

> `task_type` is retained on the row, but the flexible `task_labels` system (V22) is the primary categorization mechanism in the UI.

**Priority values** (`Priority` enum): `NORMAL`, `HIGH`, `URGENT`

---

### `subtasks`

Child tasks belonging to a parent task.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `task_id` | BIGINT | NO | — | FK → `tasks.id` |
| `title` | VARCHAR(255) | NO | — | Subtask title |
| `content` | TEXT | YES | NULL | Subtask description |
| `start_date` | DATE | YES | NULL | Subtask start date |
| `end_date` | DATE | YES | NULL | Subtask due date |
| `assignee_id` | BIGINT | YES | NULL | FK → `users.id` |
| `is_completed` | BOOLEAN | NO | false | Completion flag |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | now() | Last update timestamp |

---

### `projects`

Project containers that group tasks across teams.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `name` | VARCHAR(255) | NO | — | Project name |
| `description` | TEXT | YES | NULL | Project description |
| `start_date` | DATE | YES | NULL | Project start date |
| `end_date` | DATE | YES | NULL | Project deadline |
| `status` | VARCHAR(20) | NO | `ACTIVE` | Project status (enum) |
| `created_by` | BIGINT | NO | — | FK → `users.id` |
| `manager_id` | BIGINT | YES | NULL | FK → `users.id` (project manager, V24) |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | now() | Last update timestamp |

**Status values**: `ACTIVE`, `COMPLETED`, `ON_HOLD`, `CANCELLED`

---

### `task_status_history`

Audit trail for task status changes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `task_id` | BIGINT | NO | — | FK → `tasks.id` |
| `old_status` | VARCHAR(20) | YES | NULL | Previous status (NULL for creation) |
| `new_status` | VARCHAR(20) | NO | — | New status value |
| `changed_by` | BIGINT | NO | — | FK → `users.id` |
| `change_reason` | VARCHAR(500) | YES | NULL | Optional reason for the change |
| `postponed_to_date` | DATE | YES | NULL | New date (for POSTPONED transitions) |
| `created_at` | TIMESTAMP | NO | now() | When the change occurred |

---

### `task_logs`

Comprehensive audit log for all task operations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `task_id` | BIGINT | YES | NULL | FK → `tasks.id` (nullable for deleted tasks) |
| `task_title` | VARCHAR(255) | YES | NULL | Preserved title (survives task deletion) |
| `action` | VARCHAR(50) | NO | — | Operation type |
| `old_value` | TEXT | YES | NULL | Previous state (JSON) |
| `new_value` | TEXT | YES | NULL | New state (JSON) |
| `changed_by` | BIGINT | NO | — | FK → `users.id` |
| `change_reason` | VARCHAR(500) | YES | NULL | Optional reason |
| `created_at` | TIMESTAMP | NO | now() | When the action occurred |

**Action values**: `CREATED`, `UPDATED`, `DELETED`, `STATUS_CHANGED`, `ASSIGNEE_ADDED`, `ASSIGNEE_REMOVED`

**Indexes**: `task_id`, `changed_by`, `action`, `created_at`

---

### `system_logs`

Application-level logging from both backend and frontend.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `level` | VARCHAR(20) | NO | — | Log level |
| `message` | TEXT | NO | — | Log message |
| `source` | VARCHAR(20) | NO | — | Origin system |
| `user_id` | BIGINT | YES | NULL | FK → `users.id` |
| `ip_address` | VARCHAR(45) | YES | NULL | Client IP (supports IPv6) |
| `endpoint` | VARCHAR(255) | YES | NULL | API endpoint path |
| `exception` | TEXT | YES | NULL | Exception stack trace |
| `created_at` | TIMESTAMP | NO | now() | When the log was recorded |

**Level values**: `INFO`, `WARN`, `ERROR`, `DEBUG`

**Source values**: `BACKEND`, `FRONTEND`

**Indexes**: `source`, `level`, `created_at`, `user_id`

---

### `ldap_settings`

LDAP connection configuration (stored in DB for runtime changes).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `urls` | VARCHAR(500) | NO | — | LDAP server URL(s) |
| `base` | VARCHAR(500) | NO | — | Base DN |
| `username` | VARCHAR(500) | YES | NULL | Bind DN |
| `password_encrypted` | VARCHAR(500) | YES | NULL | AES-256 encrypted bind password |
| `user_search_base` | VARCHAR(500) | YES | NULL | User search base OU |
| `user_search_filter` | VARCHAR(500) | YES | NULL | User search filter pattern |
| `is_enabled` | BOOLEAN | NO | false | Whether LDAP auth is active |
| `created_at` | TIMESTAMP | NO | now() | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | now() | Last update timestamp |

---

### `login_attempts`

Tracks login attempts for rate limiting and account lockout.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `username` | VARCHAR(100) | YES | NULL | Attempted username |
| `ip_address` | VARCHAR(45) | NO | — | Client IP address |
| `attempt_time` | TIMESTAMP | NO | now() | When the attempt occurred |
| `success` | BOOLEAN | NO | — | Whether the attempt succeeded |

**Indexes**: `username`, `ip_address`, `attempt_time`

---

## Join Tables

### `user_roles`
| Column | Type | Description |
|--------|------|-------------|
| `user_id` | BIGINT | FK → `users.id` |
| `role_id` | BIGINT | FK → `roles.id` |

### `user_teams`
| Column | Type | Description |
|--------|------|-------------|
| `user_id` | BIGINT | FK → `users.id` |
| `team_id` | BIGINT | FK → `teams.id` |

### `task_assignees`
| Column | Type | Description |
|--------|------|-------------|
| `task_id` | BIGINT | FK → `tasks.id` |
| `user_id` | BIGINT | FK → `users.id` |

### `project_teams`
| Column | Type | Description |
|--------|------|-------------|
| `project_id` | BIGINT | FK → `projects.id` |
| `team_id` | BIGINT | FK → `teams.id` |

### `task_comment_mentions`
| Column | Type | Description |
|--------|------|-------------|
| `comment_id` | BIGINT | FK → `task_comments.id`, ON DELETE CASCADE |
| `user_id` | BIGINT | FK → `users.id` |

PK: `(comment_id, user_id)`. Index: `user_id`.

### `task_chain_assignees`
| Column | Type | Description |
|--------|------|-------------|
| `chain_id` | BIGINT | FK → `task_chains.id`, ON DELETE CASCADE |
| `user_id` | BIGINT | FK → `users.id`, ON DELETE CASCADE |

PK: `(chain_id, user_id)`. Üretilen takip görevine atanacak (hedef birim) kullanıcılar.

---

## `notifications`

Kullanıcı başına bildirim kayıtları.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `user_id` | BIGINT | NO | — | FK → `users.id`, ON DELETE CASCADE (alıcı) |
| `type` | VARCHAR(50) | NO | — | `TASK_ASSIGNED` / `TASK_STATUS_CHANGED` / `TASK_DUE_SOON` / `COMMENT_MENTION` / `COMMENT_ON_TASK` |
| `title` | VARCHAR(255) | NO | — | Başlık (UI'da kalın yazı) |
| `message` | TEXT | YES | NULL | Açıklayıcı metin |
| `related_task_id` | BIGINT | YES | NULL | FK → `tasks.id`, ON DELETE CASCADE |
| `related_comment_id` | BIGINT | YES | NULL | FK → `task_comments.id`, ON DELETE CASCADE |
| `actor_user_id` | BIGINT | YES | NULL | FK → `users.id` (tetikleyen) |
| `is_read` | BOOLEAN | NO | false | Okundu mu |
| `created_at` | TIMESTAMP | NO | now() | Üretim zamanı |
| `read_at` | TIMESTAMP | YES | NULL | Okundu işaretlenme zamanı |

**Indexes**: `user_id`, `(user_id, is_read)`, `(user_id, created_at)`, `related_task_id`

`TASK_DUE_SOON` her gün `08:00` cron'unda `TaskDueSoonNotifier` tarafından
üretilir; tamamlanmış/iptal edilmiş işler dışarıda bırakılır. Diğer tipler ilgili
servis aksiyonları (atama, durum değişimi, yorum) sırasında üretilir ve
`NotificationService.saveDeduped` ile son 60 saniye içinde aynı `(user, type, task)`
için tekrar üretilmez.

---

## `task_labels`

Birim bazlı etiketler — görev türlerinin yerini alan esnek etiket sistemi (V22).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `name` | VARCHAR(100) | NO | — | Etiket adı |
| `color` | VARCHAR(7) | NO | `#89b4fa` | Hex renk kodu |
| `team_id` | BIGINT | NO | — | FK → `teams.id`, ON DELETE CASCADE |
| `created_at` | TIMESTAMP | NO | now() | Oluşturma zamanı |

**Indexes**: `team_id`

Görevlere etiket atamak için `task_label_assignments` join tablosu kullanılır:

| Column | Type | Description |
|--------|------|-------------|
| `task_id` | BIGINT | FK → `tasks.id`, ON DELETE CASCADE |
| `label_id` | BIGINT | FK → `task_labels.id`, ON DELETE CASCADE |

PK: `(task_id, label_id)`

---

## `task_comments`

Görevlere ait kullanıcı yorumları.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `task_id` | BIGINT | NO | — | FK → `tasks.id`, ON DELETE CASCADE |
| `author_id` | BIGINT | NO | — | FK → `users.id` |
| `content` | TEXT | NO | — | Yorum metni (max 5000 karakter, controller seviyesinde) |
| `is_edited` | BOOLEAN | NO | false | Yorum düzenlendiyse `true` |
| `created_at` | TIMESTAMP | NO | now() | Oluşturma zamanı |
| `updated_at` | TIMESTAMP | NO | now() | Son güncelleme zamanı |

**Indexes**: `task_id`, `author_id`, `(task_id, created_at)`

`@kullaniciadi` mention'ları `task_comment_mentions` join tablosu üzerinden
ilgili kullanıcılara bağlanır.

---

## `saved_filters`

Kullanıcı başına kaydedilmiş arama/filtre tanımları (V27).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `user_id` | BIGINT | NO | — | FK → `users.id` (sahip) |
| `name` | VARCHAR(100) | NO | — | Filtre adı |
| `filter_json` | TEXT | NO | — | Serileştirilmiş filtre tanımı (durum/öncelik/etiket/atanan) |
| `created_at` | TIMESTAMP | NO | now() | Oluşturma zamanı |

**Indexes**: `user_id`

Kullanıcı başına maks. 20 filtre saklanır; silme işlemi sahiplik kontrolüne tabidir.

---

## `revoked_tokens`

Logout'ta iptal edilen (blacklist) JWT access token'ları (V28). Sadece SHA-256 hash saklanır.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `token_hash` | VARCHAR(64) | NO | — | Token'ın SHA-256 hash'i (unique) |
| `expires_at` | TIMESTAMP | NO | — | Token'ın doğal son kullanma zamanı |
| `created_at` | TIMESTAMP | NO | now() | İptal zamanı |

**Indexes**: `token_hash` (unique), `expires_at`

`TokenBlacklistService` her istekte `token_hash` ile kontrol eder; süresi geçen kayıtlar saatlik `@Scheduled` job ile silinir.

---

## `refresh_tokens`

Kalıcı refresh token'ları (V28). Sadece SHA-256 hash saklanır, rotate-on-use.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `token_hash` | VARCHAR(64) | NO | — | Token'ın SHA-256 hash'i (unique) |
| `username` | VARCHAR(100) | NO | — | Token'ın bağlı olduğu kullanıcı |
| `ip_address` | VARCHAR(45) | YES | NULL | Oturumun açıldığı IP (V29) |
| `user_agent` | VARCHAR(512) | YES | NULL | Oturum cihazı/tarayıcısı (V29) |
| `expires_at` | TIMESTAMP | NO | — | 7 gün sonrası |
| `created_at` | TIMESTAMP | NO | now() | Oluşturma zamanı |

**Indexes**: `token_hash` (unique), `expires_at`

`/api/auth/refresh` kullanımında eski satır silinip yenisi oluşturulur; süresi geçenler saatlik `@Scheduled` job ile temizlenir. Her satır aynı zamanda bir **oturum**'u temsil eder (Session Yönetimi: `GET/DELETE /api/users/me/sessions`, IP + cihaz + tarih ile listelenir).

---

## `sla_policies`

SLA çözüm-süresi politikaları (V30). Bir görev, opsiyonel **öncelik** ve/veya **birim** ile eşleşen en spesifik aktif politikaya bağlanır.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGSERIAL | NO | auto | Primary key |
| `name` | VARCHAR(100) | NO | — | Politika adı |
| `priority` | VARCHAR(20) | YES | NULL | Eşleşeceği öncelik (NULL = tümü) |
| `team_id` | BIGINT | YES | NULL | FK → `teams.id` (NULL = tüm birimler) |
| `target_hours` | INT | NO | — | Hedef çözüm süresi (saat) |
| `business_hours_only` | BOOLEAN | NO | false | `true` ise hafta sonları sayılmaz |
| `is_active` | BOOLEAN | NO | true | Politika aktif mi |
| `created_at` / `updated_at` | TIMESTAMP | NO | now() | Zaman damgaları |

**Indexes**: `is_active`. Seed (V30): URGENT→4s, HIGH→24s, NORMAL→72s (global, 7/24).

---

## Entity Relationship Diagram

```
┌──────────┐    user_roles    ┌────────────┐
│  users   │◄───────────────►│   roles    │
│          │  M:N             │            │
└──────────┘                  └────────────┘
  │ │ │ │
  │ │ │ └──── user_teams ────► ┌──────────┐
  │ │ │          M:N           │  teams   │
  │ │ │                        │          │◄── leader_id (1:1)
  │ │ │                        └──────────┘
  │ │ │                          │
  │ │ │                          │ 1:N
  │ │ │                          ▼
  │ │ │  created_by           ┌──────────┐    M:1     ┌──────────┐
  │ │ └──────────────────────►│  tasks   │───────────►│ projects │
  │ │    task_assignees  M:N  │          │            │          │
  │ └────────────────────────►│          │            └──────────┘
  │                           └──────────┘              │
  │                             │ │                     │ project_teams
  │                             │ │                     └──────► teams (M:N)
  │                             │ └── 1:N ──► ┌────────────────┐
  │                             │             │ task_status_    │
  │                             │             │ history         │
  │                             │             └────────────────┘
  │                             └──── 1:N ──► ┌──────────┐
  │                                           │ subtasks │
  │                                           └──────────┘
  │
  │  (referenced by)
  ├──► task_logs.changed_by
  ├──► system_logs.user_id
  └──► task_status_history.changed_by
```

---

## `task_chains`

Zincir tanımları: bir kaynak görev **COMPLETED** olunca otomatik açılacak takip görevleri. Bir kaynak görevin **birden çok** tanımı olabilir (1-N).

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | PK |
| `source_task_id` | BIGINT | FK → `tasks.id`, NOT NULL, ON DELETE CASCADE — tanımın bağlı olduğu kaynak görev |
| `title` | VARCHAR(255) | NOT NULL — üretilecek takip görevinin başlığı |
| `content` | TEXT | Opsiyonel açıklama |
| `target_team_id` | BIGINT | FK → `teams.id`, NOT NULL — hedef birim (aynı veya farklı) |
| `target_project_id` | BIGINT | FK → `projects.id`, nullable, ON DELETE SET NULL |
| `priority` | VARCHAR(20) | Opsiyonel; boşsa üretimde `NORMAL` |
| `duration_days` | INT | NOT NULL (≥0) — `end_date = tamamlanma_günü + duration_days` |
| `triggered_at` | TIMESTAMP | Bir-kez garantisi; doluysa yeniden üretmez |
| `created_at` / `updated_at` | TIMESTAMP | NOT NULL |

Index: `idx_task_chains_source (source_task_id)`. Atananlar `task_chain_assignees` join tablosunda.

**`tasks` tablosuna eklenen kolon:** `spawned_from_task_id` BIGINT, FK → `tasks.id`, nullable, **ON DELETE SET NULL** — zincirle üretilen görev kaynağını gösterir; kaynak silinse de üretilmiş görev kalır. Index: `idx_tasks_spawned_from`.

Tetikleme: `updateTaskStatus`/`updateTask` COMPLETED'e geçişte `TaskCompletedEvent` yayınlar; `TaskChainService.onTaskCompleted` **AFTER_COMMIT + REQUIRES_NEW** ile dinler (tamamlamayı bozmaz). Bkz. `docs/architecture.md`.

---

## `git_settings`

Git entegrasyonu (inbound/webhook) konfigürasyonu — **tek satır** (LDAP ayar deseni). Webhook secret `EncryptionService` ile şifreli saklanır, asla düz metin loglanmaz.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | PK |
| `is_enabled` | BOOLEAN | NOT NULL, default `false` — entegrasyon kapalıyken webhook 200 no-op döner |
| `webhook_secret_encrypted` | VARCHAR(500) | AES-GCM şifreli webhook secret; null = secret tanımsız |
| `mr_opened_status` | VARCHAR(20) | MR/PR açılınca senkronlanacak `TaskStatus`; null/boş = no-op |
| `mr_merged_status` | VARCHAR(20) | MR/PR merge olunca senkronlanacak `TaskStatus`; null/boş = no-op |
| `branch_status` | VARCHAR(20) | Branch açılınca senkronlanacak `TaskStatus`; null/boş = no-op. V34: `push_status` → `branch_status` rename (branch açılınca durum senkronu). |
| `created_at` / `updated_at` | TIMESTAMP | NOT NULL |

Migration tek satırı idempotent seed eder (`WHERE NOT EXISTS`).

## `task_git_links`

Bir göreve bağlı commit/MR referansları (webhook ile `TORA-\d+` koduyla eşlenip yazılır).

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | PK |
| `task_id` | BIGINT | FK → `tasks.id`, NOT NULL, ON DELETE CASCADE |
| `platform` | VARCHAR(20) | NOT NULL — `github` / `gitlab` / `gitea` |
| `link_type` | VARCHAR(20) | NOT NULL — `COMMIT` / `MR` |
| `external_id` | VARCHAR(255) | NOT NULL — commit SHA veya MR/PR numarası |
| `url` | VARCHAR(1000) | Commit/MR URL'i |
| `title` | VARCHAR(500) | Commit ilk satırı / MR başlığı |
| `status` | VARCHAR(30) | MR için `OPENED`/`MERGED`/`CLOSED`; commit için null |
| `branch` | VARCHAR(255) | Kaynak branch |
| `author` | VARCHAR(255) | Commit/MR yazarı (git tarafı) |
| `created_at` / `updated_at` | TIMESTAMP | NOT NULL |

Unique constraint `uq_task_git_link (task_id, platform, link_type, external_id)` → tekrar teslimat **idempotent upsert**. Index: `idx_git_link_task (task_id)`.

**Sistem kullanıcısı:** `git-otomasyonu` (`is_active=false`) — webhook kaynaklı durum değişimlerinde `changed_by`/aktör referansı. Listelerde görünmez, login devre dışı.

---

## Migration History

All migrations are in `Backend/src/main/resources/db/changelog/changes/`:

| Migration | Description |
|-----------|-------------|
| `V1__initial_schema.xml` | Initial tables: users, roles, teams, tasks, subtasks, task_status_history, user_roles, user_teams |
| `V2__seed_data.xml` | Seed default roles and teams |
| `V3__add_password_to_users.xml` | Add `password` column to users table |
| `V4__create_admin_user.xml` | Create default admin user |
| `V5__add_subtask_fields.xml` | Add `start_date`, `end_date`, `assignee_id` to subtasks |
| `V6__add_task_type_and_priority.xml` | Add `task_type` and `priority` columns to tasks |
| `V7__add_team_color_and_icon.xml` | Add `color` and `icon` columns to teams |
| `V8__add_projects.xml` | Create `projects` table, `project_teams` join table, add `project_id` to tasks |
| `V9__add_soft_delete.xml` | Add `is_active` column to users and teams |
| `V10__rename_daire_baskani_to_admin.xml` | Rename `DAIRE_BASKANI` role to `ADMIN` |
| `V11__create_ldap_settings.xml` | Create `ldap_settings` table |
| `V12__create_login_attempts.xml` | Create `login_attempts` table with indexes |
| `V13__create_system_logs.xml` | Create `system_logs` table with indexes |
| `V14__create_task_logs.xml` | Create `task_logs` table with indexes |
| `V15__rename_teams_to_birim.xml` | Update team names to Turkish department names |
| `V16__task_logs_preserve_deleted_task.xml` | Make `task_id` nullable in task_logs, add `task_title` column |
| `V17__add_departments.xml` | Add `BIRIM_AMIRI` role, set team icons and colors |
| `V18__remove_postponed_overdue_statuses.xml` | Migrate `POSTPONED`/`OVERDUE` task statuses to `IN_PROGRESS`, reset `is_postponed` |
| `V19__create_task_comments.xml` | Create `task_comments` and `task_comment_mentions` tables for görev yorumları |
| `V20__create_notifications.xml` | Create `notifications` table (user-targeted in-app notifications + indexes) |
| `V21__remove_admin_from_teams.xml` | Remove `admin` user rows from `user_teams` (yönetici birim üyesi değildir) |
| `V22__add_task_labels.xml` | Create `task_labels` table; migrate existing `task_type` data to labels; add `idx_task_labels_team_id` |
| `V23__performance_indexes.xml` | Add `idx_task_assignees_user_id`, `idx_tasks_created_by`, `idx_tasks_team_status` (bileşik) |
| `V24__add_project_manager.xml` | Add nullable `manager_id` (FK → users) column to `projects` |
| `V25__performance_index_start_date.xml` | Composite indexes `tasks(team_id, start_date)` and `tasks(project_id, start_date)` for year/month range filters |
| `V26__search_indexes.xml` | GIN full-text search indexes (tasks + projects) and `pg_trgm` trigram index (users) for global search |
| `V27__saved_filters.xml` | Create `saved_filters` table + `idx_saved_filters_user_id` |
| `V28__create_token_stores.xml` | Create `revoked_tokens` and `refresh_tokens` tables (persistent JWT blacklist + refresh store, SHA-256 hashed) with expiry indexes |
| `V29__add_session_info_to_refresh_tokens.xml` | Add `ip_address` + `user_agent` to `refresh_tokens` for the session-management UI |
| `V30__create_sla.xml` | Create `sla_policies` (+ seed defaults), add `sla_due_at`/`sla_status`/`completed_at` to `tasks` with `idx_tasks_sla_status` |
| `V31__create_task_chains.xml` | Create `task_chains` + `task_chain_assignees` (zincir görevler); add `spawned_from_task_id` to `tasks` (FK self, ON DELETE SET NULL) with indexes |
| `V32__task_code.xml` | Create `task_code_seq` sequence; add `tasks.code` (`VARCHAR(20)`, DEFAULT `'TORA-' \|\| lpad(nextval,4,'0')`, UNIQUE, indexed); backfill existing tasks in `id` order (`TORA-0001`…) |
| `V33__create_git_integration.xml` | Create `git_settings` (single-row config) + `task_git_links` (unique `(task_id,platform,link_type,external_id)`, index `task_id`); seed `git-otomasyonu` system user (`is_active=false`) |
| `V34__rename_push_status_to_branch_status.xml` | `git_settings.push_status` → `branch_status` rename (branch-event durum senkronu) |

### Adding New Migrations

1. Create a new XML file in `Backend/src/main/resources/db/changelog/changes/` following the naming convention: `V{N}__{description}.xml`
2. Add the file reference to `db.changelog-master.xml`
3. The migration runs automatically on next application startup

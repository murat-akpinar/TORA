# Git Entegrasyonu (Inbound / Webhook) — Tasarım Belgesi

**Tarih:** 2026-06-27
**Durum:** Onaylandı
**Kapsam:** v1 = **sadece inbound**. Git platformundan webhook al → iş koduyla görevi eşle → commit/MR'ı bağla + ayarlı durum senkronu. **Outbound** (branch/MR oluşturma) ayrı bir sonraki sub-project.

**Ön koşul:** İş kodu üretimi (tamamlandı — `TORA-0042`).

---

## 1. Kararlar

| Konu | Karar |
|---|---|
| Platform | **Platform-bağımsız**: GitHub, GitLab, Gitea (paylaşılan çekirdek + platform başına parser) |
| Bağlama anahtarı | İş kodu `TORA-\d+` — commit mesajı, branch adı, MR/PR başlık+açıklamasında aranır |
| Durum senkronu | **Ayarlanabilir** (admin): hangi olay → hangi durum (veya "değiştirme") |
| Bağlanan referanslar | `task_git_links` tablosu + görev detayında "Bağlı commit/MR" paneli |
| Aktör | **"Git Otomasyonu" sistem kullanıcısı** (seed). Email-eşleme v1 dışı; `resolveGitActor` tek noktada izole → sonra kolay eklenir |
| Bağlanma yöntemi | **Ham webhook** (admin her repoya URL + secret girer). OAuth-app self-hosted için kapsam dışı |
| Smart-commit komutları | Kapsam dışı (gelecek) |

> **Endüstri uyumu:** Jira/Linear/Azure DevOps ile aynı temel (key-as-glue, development panel, ayarlı geçişler). Tek fark OAuth-app yerine ham webhook — self-hosted (Gitea/GitLab) için doğru/pragmatik seçim.

---

## 2. Mimari

- **`GitWebhookController`** — `POST /api/webhooks/git/{platform}` (`platform ∈ github|gitlab|gitea`).
  JWT yok; **imza/secret ile doğrulanır**. Ham gövde (raw body) imza için korunur.
- **`GitWebhookParser`** arayüzü:
  - `boolean verify(Map<String,String> headers, byte[] rawBody, String secret)`
  - `Optional<GitEvent> parse(Map<String,String> headers, String body)`
  - Üç impl: `GithubWebhookParser` (HMAC-SHA256, `X-Hub-Signature-256`), `GiteaWebhookParser` (HMAC-SHA256, `X-Gitea-Signature`), `GitlabWebhookParser` (`X-Gitlab-Token` eşitlik).
  - Platform→parser eşlemesi bir `Map`/factory ile.
- **`GitEvent`** (ortak model): `platform`, `type` (`PUSH` / `MR_OPENED` / `MR_MERGED` / `MR_CLOSED`),
  `List<String> codeTexts` (taranacak metinler: commit mesajları, MR başlık/açıklama, branch adı),
  `List<GitRef> refs` (her ref: `externalId`, `url`, `title`, `status`, `branch`, `author`).
- **`GitWebhookService`** (çekirdek, platform-bağımsız):
  1. `git_settings` → enabled değilse 200 + no-op.
  2. Parser ile imza doğrula (geçersiz → 401).
  3. `parse` → `GitEvent`.
  4. `codeTexts`'ten `TORA-\d+` kodlarını çıkar (regex), eşleşen görevleri bul.
  5. Her (görev × ref) için `task_git_links` upsert (unique constraint → idempotent).
  6. Durum senkronu: ayardaki kurala göre (`mrOpenedStatus`/`mrMergedStatus`/`pushStatus`), **sistem kullanıcısı** adına durum değiştir; COMPLETED'e geçişte mevcut `TaskCompletedEvent` yayınla → **zincir görevleri tetiklenir**.
  7. Aktör: `resolveGitActor(GitEvent)` → şimdilik sistem kullanıcısı (ileride email-eşleme buraya).
- **`GitSettingsService`** + entity — `ldap_settings` deseni (secret `EncryptionService` ile şifreli). Admin CRUD.

---

## 3. Veri modeli (Liquibase V33)

### `git_settings` (tek satır)
| Column | Type | Açıklama |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `is_enabled` | BOOLEAN | Entegrasyon açık/kapalı |
| `webhook_secret_encrypted` | VARCHAR(500) | Webhook secret (AES-GCM, `EncryptionService`) |
| `mr_opened_status` | VARCHAR(20) | MR/PR açılınca geçilecek durum; NULL = değiştirme |
| `mr_merged_status` | VARCHAR(20) | MR/PR merge olunca; NULL = değiştirme |
| `push_status` | VARCHAR(20) | Push/commit gelince; NULL = değiştirme |
| `created_at` / `updated_at` | TIMESTAMP | |

### `task_git_links`
| Column | Type | Açıklama |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `task_id` | BIGINT | FK → `tasks.id`, ON DELETE CASCADE |
| `platform` | VARCHAR(20) | github / gitlab / gitea |
| `link_type` | VARCHAR(20) | COMMIT / MR |
| `external_id` | VARCHAR(255) | commit SHA veya MR/PR numarası |
| `url` | VARCHAR(1000) | tıklanır link |
| `title` | VARCHAR(500) | commit mesajı ilk satırı / MR başlığı |
| `status` | VARCHAR(30) | MR için: OPENED / MERGED / CLOSED (commit'te NULL) |
| `branch` | VARCHAR(255) | nullable |
| `author` | VARCHAR(255) | git yazar adı (gösterim) |
| `created_at` / `updated_at` | TIMESTAMP | |

**Unique:** (`task_id`, `platform`, `link_type`, `external_id`) → tekrar webhook'ta çift kayıt olmaz (upsert). Index: `task_id`.

### Seed: sistem kullanıcısı
`git-otomasyonu` kullanıcısı — `full_name='Git Otomasyonu'`, kullanılamaz şifre, `is_active=false` (atanan/kullanıcı listelerinde çıkmaz; sadece `created_by`/`changed_by` referansı). Liquibase changeSet ile, idempotent (varsa ekleme).

---

## 4. Güvenlik

- **SecurityConfig:** `/api/webhooks/git/**` → `permitAll` (JWT dış sistemden gelmez; **imza ile** korunur).
- İmza geçersiz/secret yanlış → **401**. Entegrasyon kapalı → 200 no-op (bilgi sızdırmaz).
- **Nginx:** webhook yolu için ayrı `location` — git sunucusunun User-Agent'ı (`GitHub-Hookshot`, `GitLab/...`, Gitea) 8G UA filtresine takılmasın diye o blokta UA kontrolü baypas; gövde imza için bozulmadan proxy'lenir.
- Raw body imza doğrulaması için controller `byte[]`/`@RequestBody String` + `ContentCachingRequest` ya da raw okuma kullanır (Jackson yeniden serialize farkı imza bozmasın).

---

## 5. Frontend

- **TaskModal** — "Bağlı commit/MR" paneli: `task.gitLinks` listesi (platform ikonu, başlık, MR durum rozeti OPENED/MERGED/CLOSED, tıklanır URL). Boşsa gösterilmez.
- **Admin → Git Entegrasyonu ayar sayfası** (LDAP ayarları deseni): aç/kapa toggle, webhook secret, 3 durum-senkron dropdown'u (her olay için durum veya "değiştirme"), ve git platformuna girilecek **3 webhook URL'si** + secret talimatı gösterimi.
- `TaskDTO`'ya `gitLinks: List<TaskGitLinkDTO>` eklenir; `convertToDTO`'da doldurulur.

---

## 6. Edge / test

- Bilinmeyen kod / eşleşen görev yok → yok say (debug log).
- Çift teslimat → unique constraint + upsert ile idempotent.
- Bir MR'da çok kod → eşleşen tüm görevlere bağla.
- MR closed (merge değil) → link `status=CLOSED`, durum değiştirme.
- Entegrasyon kapalı → no-op. İmza yok/yanlış → 401.
- Zaten hedef durumdaysa → durum no-op (zincir once-guard zaten çift üretmez).

**Testler:**
- Her parser: örnek payload (GitHub/GitLab/Gitea push + MR) → `GitEvent` doğru; imza doğrulama (geçerli/geçersiz).
- Kod çıkarma regex'i (`TORA-\d+`, çoklu, büyük/küçük harf).
- `GitWebhookService`: linking upsert + durum senkronu + COMPLETED'te event yayını (mock repo/publisher).

---

## 7. Kapsam dışı (sonraki sub-project'ler)
- **Outbound:** "Branch oluştur / MR oluştur" butonları, repo token/OAuth, git API'sine yazma.
- **Aktör email-eşleme** (`resolveGitActor` içine eklenecek).
- **Smart-commit komutları** (`#comment`, `#time`, `#close`).
- CI/build & deployment bağlama.

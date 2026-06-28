# Branch-Event Durum Senkronu + Webhook Secret Üreteci — Tasarım Belgesi

**Tarih:** 2026-06-28
**Durum:** Onaylandı
**Kapsam:** Git inbound durum-senkron davranışını yeniden düzenle — (1) "push/commit gelince → durum" otomatik senkronunu kaldır, yerine "branch açılınca → durum" ekle; commit'ler durumu yalnızca smart-commit komutlarıyla değiştirsin. (2) Admin panelinde webhook secret için "rastgele üret" butonu.

**Ön koşul:** Git Entegrasyonu (inbound) + smart-commit/email-eşleme — tamamlandı.

---

## 1. Kararlar

| Konu | Karar |
|---|---|
| Push/commit → durum | **Kaldırılır.** Push olayı yalnızca commit linking + smart-commit komutlarını işler; genel otomatik durum senkronu yok. |
| Branch açılınca → durum | **Yeni.** Branch oluşturma olayında, branch adındaki `TORA-\d+` koduyla eşleşen göreve ayarlı durum (örn. IN_PROGRESS) uygulanır. |
| MR/PR açılınca → durum | **Korunur** (`mrOpenedStatus`). |
| MR/PR merge olunca → durum | **Korunur** (`mrMergedStatus`). |
| Branch algılama | **Platform-native:** GitHub/Gitea `create` event (`ref_type=branch`); GitLab Push Hook'ta `before` = tüm sıfırlar (yeni branch). |
| DB | `git_settings.push_status` → **`branch_status`** rename (Liquibase **V34**, idempotent). |
| Secret üreteci | **Frontend-only:** `crypto.getRandomValues` ile 32-byte rastgele hex; backend değişmez. |
| Commit linking | **Değişmez** — push'ta commit'ler `task_git_links`'e bağlanmaya devam eder. |

---

## 2. Branch algılama (platform detayı)

Branch oluşturma olayı, link üretmeyen, yalnızca durum tetikleyen bir olaydır. Branch adı `codeTexts`'e konur; `refs` boştur (bağlanacak commit/MR yok).

- **GitHub:** `X-GitHub-Event: create`, gövde `{"ref_type":"branch","ref":"<branch>"}`. `ref_type != branch` (tag) → yok say.
- **Gitea:** `X-Gitea-Event: create`, gövde benzer (`ref_type`, `ref`). Tag → yok say.
- **GitLab:** Ayrı create event yok. `Push Hook`'ta `before == "0000000000000000000000000000000000000000"` → yeni branch = `BRANCH_CREATED`. (Bu durumda push'un commit linking'i **de** yapılır; aşağıya bak.)

> **GitLab özel durumu:** GitLab'da branch oluşturma + commit aynı Push Hook'ta gelir. `before`=sıfırlar ise olay **hem** `BRANCH_CREATED` (durum) **hem** commit linking gerektirir. Çözüm: GitLab push parser'ı `before`=sıfırlar olduğunda `BRANCH_CREATED` tipinde `GitEvent` döner ama `refs` yine commit'lerle dolar (linking korunur), `codeTexts` branch adını da içerir. `applyStatusSync` `BRANCH_CREATED` → `branchStatus` uygular; commit linking refs üzerinden çalışır; smart-commit yine ref mesajlarından işlenir. GitHub/Gitea'da `create` olayı commit içermez (`refs` boş), ayrı push olayı commit'leri taşır.

---

## 3. Veri modeli (Liquibase V34)

`V34__rename_git_push_status_to_branch_status.xml` — master changelog'a V33'ten sonra include edilir.

```xml
<changeSet id="34-rename-push-status" author="tora">
    <renameColumn tableName="git_settings"
                  oldColumnName="push_status"
                  newColumnName="branch_status"
                  columnDataType="VARCHAR(20)"/>
</changeSet>
```

> Mevcut `push_status` değeri (varsa) `branch_status` olarak korunur; kullanıcı admin panelinden yeniden ayarlayabilir. Rename, veri kaybı yapmaz.

---

## 4. Backend

### `GitEventType`
`PUSH, MR_OPENED, MR_MERGED, MR_CLOSED, BRANCH_CREATED` (yeni değer eklenir).

### Parser'lar
- **GithubWebhookParser / GiteaWebhookParser:** `parse` içinde `create` event'i ele alınır → `parseCreate(root)`: `ref_type=branch` ise `GitEvent(platform, BRANCH_CREATED, codeTexts=[ref], refs=[])`; değilse `Optional.empty()`.
- **GitlabWebhookParser:** `parsePush` içinde `before` tüm sıfırlar ise `type=BRANCH_CREATED` (refs commit'lerle dolu kalır, codeTexts branch adını içerir); değilse `PUSH` (mevcut).

### `GitSettings` (entity) / `GitSettingsDTO` / `UpdateGitSettingsRequest`
- `pushStatus` alanı → **`branchStatus`** (entity kolonu `branch_status`).

### `GitSettingsService`
- `updateSettings`: `s.setBranchStatus(normalize(req.getBranchStatus()))`.
- `toDTO`: `dto.setBranchStatus(s.getBranchStatus())`.

### `GitWebhookService.applyStatusSync`
```
target = switch (event.type()) {
    case MR_OPENED     -> settings.getMrOpenedStatus();
    case MR_MERGED     -> settings.getMrMergedStatus();
    case BRANCH_CREATED-> settings.getBranchStatus();
    case PUSH          -> null;   // push artık otomatik durum uygulamaz
    case MR_CLOSED     -> null;
};
```
Smart-commit override mantığı (`overridden` set) değişmez. `BRANCH_CREATED` olayında `refs` boşsa (GitHub/Gitea) linking ve smart-commit no-op; `applySmartCommits` boş ref listesinde zaten hiçbir şey yapmaz.

---

## 5. Frontend (`components/admin/GitSettings.tsx`)

- `GitSettingsDTO` arayüzü: `pushStatus` → `branchStatus`.
- Üçüncü durum alanının etiketi **"Push/commit gelince → durum"** → **"Branch açılınca → durum"**; state alanı `branchStatus`.
- PUT gövdesi: `pushStatus` → `branchStatus`.
- **Webhook Secret alanı:** input yanına **"Üret"** butonu. Tıklanınca:
  ```ts
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
  setSecret(hex);
  ```
  Üretilen değer input'a yazılır (görünür, kullanıcı kopyalayıp Gitea'ya da girebilsin); Kaydet'e basınca normal akışla şifreli saklanır.
- Tema uyumu: buton mevcut Catppuccin stiliyle (`GitSettings.css`), secret satırı input+buton yan yana.

---

## 6. Test

- **Parser testleri:** GitHub/Gitea `create` (branch) → `BRANCH_CREATED` + `codeTexts` branch adını içerir, `refs` boş; `create` (tag) → empty. GitLab push `before`=sıfırlar → `BRANCH_CREATED` (refs commit'lerle dolu).
- **GitWebhookServiceTest:**
  - `BRANCH_CREATED` + `branchStatus` ayarı → eşleşen göreve durum uygulanır.
  - `PUSH` olayında `branchStatus`/eski push ayarı **uygulanmaz** (genel otomatik durum yok); yalnızca linking + smart-commit.
- Mevcut MR_OPENED/MR_MERGED senkron testleri korunur (alan adı değişikliği dışında).

---

## 7. Kapsam dışı
- Outbound (Branch/MR oluşturma).
- Backend tarafı secret üretimi (frontend-only yeterli).
- MR_CLOSED → durum (mevcut davranış: değiştirme).

---

## 8. Dokümantasyon / kullanıcı notu
- `docs/architecture.md`, `docs/api-reference.md`, `docs/database-schema.md` (yeni migration + alan adı), `docs/frontend.md` güncellenir; `todo/todo.md` işaretlenir.
- **Webhook kurulum notu:** Branch durum senkronu için Gitea/GitHub webhook'unda **"Branch/Tag oluşturma" (create) event'i** seçili olmalı; ayrıca branch adı iş kodunu (`TORA-1148`) içermeli.

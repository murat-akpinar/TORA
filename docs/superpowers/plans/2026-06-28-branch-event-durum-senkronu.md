# Branch-Event Durum Senkronu + Webhook Secret Üreteci Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Git inbound durum senkronunu yeniden düzenle — "push/commit → durum" otomatik senkronunu kaldır, "branch açılınca → durum" ekle; commit'ler durumu yalnızca smart-commit komutlarıyla değiştirsin. Ayrıca admin panelinde webhook secret için "Üret" butonu.

**Architecture:** `GitEventType`'a `BRANCH_CREATED` eklenir; parser'lar GitHub/Gitea `create` (branch) ve GitLab push `before`=sıfırlar olaylarını bu tipe çevirir. `git_settings.push_status` kolonu `branch_status`'a rename edilir (V34) ve tüm Java kullanımları (entity/DTO/Request/Service) yeniden adlandırılır. `applyStatusSync` BRANCH_CREATED→branchStatus uygular, PUSH için artık durum uygulamaz. Frontend dropdown etiketi değişir + secret üreteci eklenir.

**Tech Stack:** Java 17, Spring Boot 3.2, JPA, Liquibase, JUnit 5, Mockito, Maven; React 18 + TypeScript (Vite).

## Global Constraints

- Java 17; webhook yalnızca imza doğrulamasından sonra işlenir (değişmez).
- Liquibase: yeni changeSet **V34**, mevcut ID'ler değişmez/çakışmaz (CLAUDE.md kuralı). Master changelog'a V33'ten sonra include.
- `git_settings.push_status` → **`branch_status`** rename; mevcut değer korunur (renameColumn).
- Java alan adı: `pushStatus` → `branchStatus` (entity, DTO, Request, Service hepsi).
- Otomatik durum: `BRANCH_CREATED`→`branchStatus`, `MR_OPENED`→`mrOpenedStatus`, `MR_MERGED`→`mrMergedStatus`, `PUSH`→**yok (null)**, `MR_CLOSED`→yok.
- Smart-commit override mantığı (`overridden` Set) değişmez.
- Secret üreteci **frontend-only** (`crypto.getRandomValues`, 32-byte hex); backend değişmez.
- Kod yorumları: uzun satır-satır açıklama yok; yalnızca kısa "neden" notları (CLAUDE.md).
- Test çalıştırma yerel makinede MÜMKÜN DEĞİL (Maven/Java/Docker yok). Implementer'lar TDD'yi **kod seviyesinde** uygular (failing test'i yaz, mantığı okuyarak RED→GREEN doğrula); gerçek `mvn test` sonda vaultscan'da çalışır. Test komutları planda referans içindir.
- Test komut formatı (referans): `cd Backend && mvn -q -Dtest=<SınıfAdı> test`.

---

### Task 1: `GitEventType.BRANCH_CREATED` + parser'lar branch olayını üretsin

**Files:**
- Modify: `Backend/src/main/java/com/tora/git/GitEventType.java`
- Modify: `Backend/src/main/java/com/tora/git/GithubWebhookParser.java`
- Modify: `Backend/src/main/java/com/tora/git/GiteaWebhookParser.java`
- Modify: `Backend/src/main/java/com/tora/git/GitlabWebhookParser.java`
- Modify (test): `Backend/src/test/java/com/tora/git/GithubWebhookParserTest.java`
- Modify (test): `Backend/src/test/java/com/tora/git/GiteaWebhookParserTest.java`
- Modify (test): `Backend/src/test/java/com/tora/git/GitlabWebhookParserTest.java`

**Interfaces:**
- Produces: `GitEventType.BRANCH_CREATED` (enum değeri). GitHub/Gitea `create` (branch) → `GitEvent(platform, BRANCH_CREATED, codeTexts=[branchAdı], refs=[])`. GitLab push `before`=sıfırlar → `GitEvent("gitlab", BRANCH_CREATED, texts, refs)` (refs commit'lerle dolu).
- Consumes: mevcut `GitEvent`, `GitRef` (9-alan).

- [ ] **Step 1: GithubWebhookParserTest'e branch create testlerini ekle (RED)**

`GithubWebhookParserTest.java` içine, `parse_unknownEvent_empty` testinden önce ekle:

```java
    @Test
    void parse_createBranch_returnsBranchCreated() {
        String body = """
            {"ref":"TORA-1148","ref_type":"branch"}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-github-event", "create"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.BRANCH_CREATED, ev.get().type());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-1148")));
        assertTrue(ev.get().refs().isEmpty());
    }

    @Test
    void parse_createTag_empty() {
        String body = """
            {"ref":"v1.0","ref_type":"tag"}
            """;
        assertTrue(parser.parse(Map.of("x-github-event", "create"), body).isEmpty());
    }
```

- [ ] **Step 2: Derle/çalıştır → RED doğrula**

Run: `cd Backend && mvn -q -Dtest=GithubWebhookParserTest test`
Expected: FAIL — `create` event işlenmiyor, `parse` `Optional.empty()` dönüyor (testte `isPresent()` başarısız).

- [ ] **Step 3: GitEventType'a BRANCH_CREATED ekle**

`GitEventType.java` tamamını değiştir:

```java
package com.tora.git;

public enum GitEventType {
    PUSH, MR_OPENED, MR_MERGED, MR_CLOSED, BRANCH_CREATED
}
```

- [ ] **Step 4: GithubWebhookParser — create event işle**

`parse` metodundaki event yönlendirmesine satır ekle (mevcut `if ("pull_request".equals(event))` satırından sonra):

```java
            if ("create".equals(event)) return parseCreate("github", root);
```

Sınıfa yeni private metot ekle (`parsePullRequest`'ten sonra):

```java
    private Optional<GitEvent> parseCreate(String platform, JsonNode root) {
        if (!"branch".equals(root.path("ref_type").asText(""))) return Optional.empty();
        String branch = root.path("ref").asText("");
        return Optional.of(new GitEvent(platform, GitEventType.BRANCH_CREATED, List.of(branch), List.of()));
    }
```

- [ ] **Step 5: GithubWebhookParserTest → GREEN doğrula**

Run: `cd Backend && mvn -q -Dtest=GithubWebhookParserTest test`
Expected: PASS.

- [ ] **Step 6: GiteaWebhookParser — create event işle + test**

`GiteaWebhookParser.parse` event yönlendirmesine ekle (`if ("pull_request"...` sonrası):

```java
            if ("create".equals(event)) return parseCreate("gitea", root);
```

Aynı `parseCreate` metodunu ekle (`parsePullRequest`'ten sonra):

```java
    private Optional<GitEvent> parseCreate(String platform, JsonNode root) {
        if (!"branch".equals(root.path("ref_type").asText(""))) return Optional.empty();
        String branch = root.path("ref").asText("");
        return Optional.of(new GitEvent(platform, GitEventType.BRANCH_CREATED, List.of(branch), List.of()));
    }
```

`GiteaWebhookParserTest.java` içine ekle (sınıf sonundan önce):

```java
    @Test
    void parse_createBranch_returnsBranchCreated() {
        String body = """
            {"ref":"TORA-1148","ref_type":"branch"}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitea-event", "create"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.BRANCH_CREATED, ev.get().type());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-1148")));
        assertTrue(ev.get().refs().isEmpty());
    }
```

- [ ] **Step 7: GitlabWebhookParser — push before=sıfırlar → BRANCH_CREATED + test**

`GitlabWebhookParser.parsePush` metodunda, `GitEvent` üretiminden önce `before` kontrolü ekle. Mevcut `return Optional.of(new GitEvent("gitlab", GitEventType.PUSH, texts, refs));` satırını şununla değiştir:

```java
        String before = root.path("before").asText("");
        GitEventType type = "0000000000000000000000000000000000000000".equals(before)
            ? GitEventType.BRANCH_CREATED : GitEventType.PUSH;
        return Optional.of(new GitEvent("gitlab", type, texts, refs));
```

`GitlabWebhookParserTest.java` içine ekle (sınıf sonundan önce):

```java
    @Test
    void parse_push_newBranch_returnsBranchCreated() {
        String body = """
            {"ref":"refs/heads/TORA-1148",
             "before":"0000000000000000000000000000000000000000",
             "commits":[{"id":"c1","message":"TORA-1148 init","url":"http://gl/c1","author":{"name":"Mo","email":"mo@firma.com"}}]}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitlab-event", "Push Hook"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.BRANCH_CREATED, ev.get().type());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-1148")));
    }
```

> Not: `GiteaWebhookParserTest` ve `GitlabWebhookParserTest` zaten `Optional`/`GitEventType` import ediyor; ek import gerekmez.

- [ ] **Step 8: Tüm parser testlerini çalıştır → GREEN**

Run: `cd Backend && mvn -q -Dtest=GithubWebhookParserTest,GiteaWebhookParserTest,GitlabWebhookParserTest test`
Expected: PASS (yerelde test çalışmıyorsa: her yeni testin payload'ını ve parser dalını okuyarak RED→GREEN doğrula ve raporla).

- [ ] **Step 9: Commit**

```bash
git add Backend/src/main/java/com/tora/git/GitEventType.java Backend/src/main/java/com/tora/git/GithubWebhookParser.java Backend/src/main/java/com/tora/git/GiteaWebhookParser.java Backend/src/main/java/com/tora/git/GitlabWebhookParser.java Backend/src/test/java/com/tora/git/GithubWebhookParserTest.java Backend/src/test/java/com/tora/git/GiteaWebhookParserTest.java Backend/src/test/java/com/tora/git/GitlabWebhookParserTest.java
git commit -m "feat(git): BRANCH_CREATED event tipi + parser branch-olusturma destegi"
```

---

### Task 2: `push_status` → `branch_status` rename (V34 + Java) + `applyStatusSync` güncelleme

**Files:**
- Create: `Backend/src/main/resources/db/changelog/changes/V34__rename_git_push_status_to_branch_status.xml`
- Modify: `Backend/src/main/resources/db/changelog/db.changelog-master.xml`
- Modify: `Backend/src/main/java/com/tora/model/GitSettings.java`
- Modify: `Backend/src/main/java/com/tora/dto/GitSettingsDTO.java`
- Modify: `Backend/src/main/java/com/tora/dto/UpdateGitSettingsRequest.java`
- Modify: `Backend/src/main/java/com/tora/service/GitSettingsService.java`
- Modify: `Backend/src/main/java/com/tora/service/GitWebhookService.java`
- Modify (test): `Backend/src/test/java/com/tora/service/GitWebhookServiceTest.java`

**Interfaces:**
- Consumes: `GitEventType.BRANCH_CREATED` (Task 1).
- Produces: `GitSettings.getBranchStatus()/setBranchStatus(String)`, `GitSettingsDTO.branchStatus`, `UpdateGitSettingsRequest.branchStatus`. `applyStatusSync` artık `BRANCH_CREATED→branchStatus`, `PUSH→null`.

> **Atomik:** entity kolon/alan rename tüm `getPushStatus`/`setPushStatus` çağrılarını kırar; bu task hepsini tek commit'te düzeltir (derleme bütünlüğü).

- [ ] **Step 1: Servis testine branch-status + push-no-status testleri ekle (RED)**

`GitWebhookServiceTest.java` içine ekle (import zaten `com.tora.model.enums.TaskStatus` içeriyor; yoksa ekle). Mevcut `process_smartCommitDone_setsStatusViaMatchedEmailActor` testindeki `gs.setPushStatus("OPEN");` satırını `gs.setBranchStatus("OPEN");` olarak değiştir (rename). Ardından iki yeni test ekle:

```java
    @Test
    void process_branchCreated_appliesBranchStatus() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(true);
        gs.setBranchStatus("IN_PROGRESS");
        when(settings.getActiveSettings()).thenReturn(gs);
        when(settings.getDecryptedSecret()).thenReturn("s");

        GitWebhookParser parser = mock(GitWebhookParser.class);
        when(parser.platform()).thenReturn("github");
        when(parser.verify(any(), any(), eq("s"))).thenReturn(true);
        when(parser.parse(any(), any())).thenReturn(Optional.of(
            new GitEvent("github", GitEventType.BRANCH_CREATED, List.of("TORA-12"), List.of())));

        Task task = new Task();
        task.setId(5L);
        task.setCode("TORA-12");
        TaskRepository taskRepo = mock(TaskRepository.class);
        when(taskRepo.findByCode("TORA-12")).thenReturn(Optional.of(task));

        User actor = new User();
        actor.setId(1L);
        UserRepository userRepo = mock(UserRepository.class);
        when(userRepo.findByUsername("git-otomasyonu")).thenReturn(Optional.of(actor));

        TaskService taskService = mock(TaskService.class);
        GitWebhookService svc = new GitWebhookService(
            settings, List.of(parser), taskRepo, mock(TaskGitLinkRepository.class),
            userRepo, taskService, new SmartCommitParser(), mock(TaskCommentService.class));

        var result = svc.process("github", Map.of(), "{}".getBytes());
        assertEquals(GitWebhookService.WebhookOutcome.PROCESSED, result.outcome());
        verify(taskService).updateTaskStatusAsSystem(5L, TaskStatus.IN_PROGRESS, actor);
    }

    @Test
    void process_push_doesNotApplyAutoStatus() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(true);
        gs.setBranchStatus("IN_PROGRESS"); // push'a uygulanmamali
        when(settings.getActiveSettings()).thenReturn(gs);
        when(settings.getDecryptedSecret()).thenReturn("s");

        GitWebhookParser parser = mock(GitWebhookParser.class);
        when(parser.platform()).thenReturn("github");
        when(parser.verify(any(), any(), eq("s"))).thenReturn(true);
        GitRef ref = new GitRef("COMMIT", "abc", "http://x", "TORA-12 fix",
            null, "feat", "Ada", "ada@firma.com", "TORA-12 fix");
        when(parser.parse(any(), any())).thenReturn(Optional.of(
            new GitEvent("github", GitEventType.PUSH, List.of("TORA-12 fix"), List.of(ref))));

        Task task = new Task();
        task.setId(5L);
        task.setCode("TORA-12");
        TaskRepository taskRepo = mock(TaskRepository.class);
        when(taskRepo.findByCode("TORA-12")).thenReturn(Optional.of(task));
        TaskGitLinkRepository linkRepo = mock(TaskGitLinkRepository.class);
        when(linkRepo.findByTask_IdAndPlatformAndLinkTypeAndExternalId(5L, "github", "COMMIT", "abc"))
            .thenReturn(Optional.empty());

        TaskService taskService = mock(TaskService.class);
        GitWebhookService svc = new GitWebhookService(
            settings, List.of(parser), taskRepo, linkRepo, mock(UserRepository.class),
            taskService, new SmartCommitParser(), mock(TaskCommentService.class));

        var result = svc.process("github", Map.of(), "{}".getBytes());
        assertEquals(GitWebhookService.WebhookOutcome.PROCESSED, result.outcome());
        verify(taskService, never()).updateTaskStatusAsSystem(eq(5L), any(), any());
    }
```

- [ ] **Step 2: Çalıştır → RED**

Run: `cd Backend && mvn -q -Dtest=GitWebhookServiceTest test`
Expected: FAIL — `setBranchStatus` metodu yok (derleme hatası).

- [ ] **Step 3: V34 migration dosyası oluştur**

Create `Backend/src/main/resources/db/changelog/changes/V34__rename_git_push_status_to_branch_status.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.20.xsd">

    <changeSet id="34-rename-push-status-to-branch-status" author="tora">
        <renameColumn tableName="git_settings"
                      oldColumnName="push_status"
                      newColumnName="branch_status"
                      columnDataType="VARCHAR(20)"/>
    </changeSet>

</databaseChangeLog>
```

- [ ] **Step 4: Master changelog'a V34 include ekle**

`Backend/src/main/resources/db/changelog/db.changelog-master.xml` içinde, `V33__create_git_integration.xml` include satırından sonra ekle:

```xml
    <include file="db/changelog/changes/V34__rename_git_push_status_to_branch_status.xml"/>
```

- [ ] **Step 5: GitSettings entity — kolon/alan rename**

`Backend/src/main/java/com/tora/model/GitSettings.java` içinde şu bloğu:

```java
    @Column(name = "push_status", length = 20)
    private String pushStatus;
```

şununla değiştir:

```java
    @Column(name = "branch_status", length = 20)
    private String branchStatus;
```

- [ ] **Step 6: DTO ve Request rename**

`GitSettingsDTO.java`: `private String pushStatus;` → `private String branchStatus;`
`UpdateGitSettingsRequest.java`: `private String pushStatus;` → `private String branchStatus;`

- [ ] **Step 7: GitSettingsService rename**

`GitSettingsService.java`:
- `updateSettings` içindeki `s.setPushStatus(normalize(req.getPushStatus()));` → `s.setBranchStatus(normalize(req.getBranchStatus()));`
- `toDTO` içindeki `dto.setPushStatus(s.getPushStatus());` → `dto.setBranchStatus(s.getBranchStatus());`

- [ ] **Step 8: GitWebhookService.applyStatusSync — switch güncelle**

`GitWebhookService.java` `applyStatusSync` içindeki `switch` bloğunu:

```java
        String target = switch (event.type()) {
            case MR_OPENED -> settings.getMrOpenedStatus();
            case MR_MERGED -> settings.getMrMergedStatus();
            case PUSH -> settings.getPushStatus();
            case MR_CLOSED -> null;
        };
```

şununla değiştir:

```java
        String target = switch (event.type()) {
            case MR_OPENED -> settings.getMrOpenedStatus();
            case MR_MERGED -> settings.getMrMergedStatus();
            case BRANCH_CREATED -> settings.getBranchStatus();
            case PUSH, MR_CLOSED -> null;
        };
```

- [ ] **Step 9: Çalıştır → GREEN**

Run: `cd Backend && mvn -q -Dtest=GitWebhookServiceTest test`
Expected: PASS (6 mevcut + 2 yeni = 8 test). Yerelde çalışmıyorsa: switch'in BRANCH_CREATED→branchStatus, PUSH→null davranışını ve rename'in tüm çağrı yerlerinde tutarlılığını okuyarak doğrula ve raporla.

- [ ] **Step 10: Tüm git + servis testlerini birlikte çalıştır (regresyon referansı)**

Run: `cd Backend && mvn -q -Dtest=GithubWebhookParserTest,GitlabWebhookParserTest,GiteaWebhookParserTest,GitWebhookServiceTest,SmartCommitParserTest,TaskCommentServiceSystemTest,HmacUtilTest test`
Expected: PASS (gerçek doğrulama sonda vaultscan'da).

- [ ] **Step 11: Commit**

```bash
git add Backend/src/main/resources/db/changelog/changes/V34__rename_git_push_status_to_branch_status.xml Backend/src/main/resources/db/changelog/db.changelog-master.xml Backend/src/main/java/com/tora/model/GitSettings.java Backend/src/main/java/com/tora/dto/GitSettingsDTO.java Backend/src/main/java/com/tora/dto/UpdateGitSettingsRequest.java Backend/src/main/java/com/tora/service/GitSettingsService.java Backend/src/main/java/com/tora/service/GitWebhookService.java Backend/src/test/java/com/tora/service/GitWebhookServiceTest.java
git commit -m "feat(git): push_status -> branch_status rename (V34) + branch durum senkronu, push otomatik durum kaldirildi"
```

---

### Task 3: Frontend — dropdown rename + webhook secret üreteci

**Files:**
- Modify: `Frontend/src/components/admin/GitSettings.tsx`
- Modify: `Frontend/src/components/admin/GitSettings.css`

**Interfaces:**
- Consumes: backend `GitSettingsDTO.branchStatus` (Task 2). PUT gövdesi `branchStatus` alanı.

> Frontend için birim testi yok (proje deseni); doğrulama deploy sonrası tarayıcıda. Implementer kodu okuyarak tutarlılığı doğrular.

- [ ] **Step 1: DTO arayüzü + state rename**

`GitSettings.tsx` içindeki `interface GitSettingsDTO` bloğunda `mrMergedStatus: string | null;` satırından sonra gelen `pushStatus: string | null;` satırını `branchStatus: string | null;` yap.

- [ ] **Step 2: PUT gövdesini güncelle**

`save` fonksiyonundaki `api.put` gövdesinde `pushStatus: s.pushStatus || null,` satırını `branchStatus: s.branchStatus || null,` yap.

- [ ] **Step 3: Üçüncü durum alanını "Branch açılınca" yap**

`statusField('Push/commit gelince → durum', s.pushStatus, (v) => setS({ ...s, pushStatus: v }))` satırını şununla değiştir:

```tsx
        {statusField('Branch açılınca → durum', s.branchStatus, (v) => setS({ ...s, branchStatus: v }))}
```

- [ ] **Step 4: Webhook Secret alanına "Üret" butonu ekle**

`GitSettings.tsx` içinde, Webhook Secret alanının bulunduğu `<div className="git-field full">` bloğunda, `<input type="password" ...>` öğesini bir satır içinde butonla sar. Mevcut input'u şu yapıyla değiştir (secret state'i ve setSecret zaten var):

```tsx
          <div className="git-secret-row">
            <input
              type="text"
              value={secret}
              placeholder={s.secretConfigured ? '••••• (değiştirmek için yaz)' : 'secret'}
              onChange={(e) => setSecret(e.target.value)}
            />
            <button type="button" className="git-generate" onClick={generateSecret}>Üret</button>
          </div>
```

> Not: `type="password"` yerine `type="text"` — üretilen secret'i kullanıcı görüp Gitea'ya kopyalayabilsin (admin-only sayfa).

`generateSecret` fonksiyonunu bileşen içinde `copy` fonksiyonundan sonra ekle:

```tsx
  const generateSecret = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    setSecret(hex);
  };
```

- [ ] **Step 5: CSS — secret satırı + Üret butonu (tema uyumlu)**

`GitSettings.css` sonuna ekle:

```css
.git-secret-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.git-secret-row input {
  flex: 1;
  min-width: 0;
}

.git-generate {
  flex-shrink: 0;
  padding: 0 16px;
  background: var(--ctp-surface0);
  color: var(--ctp-text);
  border: 1px solid var(--ctp-surface1);
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Cascadia Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}

.git-generate:hover {
  background: var(--ctp-surface1);
  border-color: var(--ctp-blue);
  color: var(--ctp-blue);
}
```

- [ ] **Step 6: Tutarlılık kontrolü + commit**

`pushStatus` kelimesinin `GitSettings.tsx` içinde hiç kalmadığını doğrula (hepsi `branchStatus`). Sonra:

```bash
git add Frontend/src/components/admin/GitSettings.tsx Frontend/src/components/admin/GitSettings.css
git commit -m "feat(git): admin panel 'Branch acilinca -> durum' + webhook secret uretme butonu"
```

---

### Task 4: Dokümantasyon + todo

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/api-reference.md`
- Modify: `docs/database-schema.md`
- Modify: `docs/frontend.md`
- Modify: `todo/todo.md`

**Interfaces:** yok (dokümantasyon).

- [ ] **Step 1: architecture.md — durum senkronu açıklamasını güncelle**

Git entegrasyonu bölümünde, `applyStatusSync`/durum senkronu anlatımına şu cümleyi ekle (smart-commit maddesinin yakınına):

```markdown
- **Durum senkronu olayları:** `BRANCH_CREATED` (branch adındaki iş koduyla eşleşen göreve `branchStatus`, örn. IN_PROGRESS), `MR_OPENED`→`mrOpenedStatus`, `MR_MERGED`→`mrMergedStatus`. **Push olayı otomatik durum uygulamaz** — commit'ler yalnızca linking + smart-commit komutlarıyla durumu etkiler. Branch algılama: GitHub/Gitea `create` (ref_type=branch) event'i, GitLab push'ta `before`=tüm sıfırlar.
```

- [ ] **Step 2: api-reference.md — git settings alan adı + olay notu**

Git webhook/settings bölümünde `pushStatus` geçen yeri `branchStatus` olarak güncelle ve şu notu ekle:

```markdown
**Durum senkron ayarları:** `mrOpenedStatus`, `mrMergedStatus`, `branchStatus` (branch açılınca). Push/commit olayında otomatik durum **uygulanmaz**; commit durumu yalnızca smart-commit komutlarıyla değişir.
```

- [ ] **Step 3: database-schema.md — git_settings kolon adı**

`git_settings` tablosu açıklamasında `push_status` → `branch_status` olarak güncelle; kısa not: "V34: `push_status` → `branch_status` rename (branch açılınca durum senkronu)."

- [ ] **Step 4: frontend.md — admin git ayarı notu**

Git Entegrasyonu (GitSettings.tsx) açıklamasında "3 durum-senkron dropdown (MR açıldı / MR merge / push …)" ifadesini şu şekilde güncelle:

```markdown
3 durum-senkron dropdown (MR açıldı / MR merge / **branch açılınca**); push otomatik durum uygulamaz. Webhook Secret alanında **"Üret"** butonu (tarayıcıda `crypto.getRandomValues` ile 32-byte hex).
```

- [ ] **Step 5: todo.md — maddeyi ekle**

`#### ✅ Git Entegrasyonu (Inbound / Webhook)` bloğunda, "Sonraki sub-project" satırından önce ekle:

```markdown
- [x] Branch-event durum senkronu (2026-06-28): `BRANCH_CREATED` olayı (GitHub/Gitea `create`, GitLab `before`=zeros) → `branch_status` (V34 rename); push artık otomatik durum uygulamaz (sadece smart-commit); admin panelde webhook secret "Üret" butonu. Tasarım: `docs/superpowers/specs/2026-06-28-branch-event-durum-senkronu-design.md`
```

- [ ] **Step 6: Commit**

```bash
git add docs/architecture.md docs/api-reference.md docs/database-schema.md docs/frontend.md todo/todo.md
git commit -m "docs(git): branch-event durum senkronu + secret ureteci dokumantasyonu"
```

---

## Self-Review Notları

- **Spec kapsamı:** §1/§4 push→branch + applyStatusSync → Task 2. §2 branch algılama (create/before-zeros) → Task 1. §3 V34 migration → Task 2. §5 frontend rename + secret üreteci → Task 3. §6 testler → Task 1 (parser) + Task 2 (servis). §8 docs → Task 4.
- **Tip tutarlılığı:** `BRANCH_CREATED` Task 1'de tanımlanır, Task 2 switch'inde kullanılır. `branchStatus` (getBranchStatus/setBranchStatus) Task 2'de entity/DTO/Request/Service'te tutarlı; frontend `branchStatus` Task 3'te. `GitWebhookService` constructor 8-arg (değişmez). `GitEvent(platform, BRANCH_CREATED, codeTexts, refs)` imzası Task 1 parser + Task 2 test'te tutarlı.
- **Migration:** V34 benzersiz, V33'ten sonra include; renameColumn veri korur.
- **Push testi:** `process_push_doesNotApplyAutoStatus` — branchStatus set ama PUSH→null olduğu için durum uygulanmaz; mevcut `process_smartCommitDone` testindeki `setPushStatus` → `setBranchStatus` rename edilir (override zaten COMPLETED uyguluyor, PUSH null ile çelişmez).
- **Gerçek test:** Migration (Liquibase) ve tüm testler sonda vaultscan'da `docker compose` + `mvn test` ile doğrulanır.

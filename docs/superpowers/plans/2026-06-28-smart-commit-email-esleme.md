# Smart-commit Komutları + Aktör Email-Eşleme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Git inbound webhook akışına smart-commit komutları (durum geçişi + yorum) ve commit yazarının email ile TORA kullanıcısına eşlenmesini ekle.

**Architecture:** Mevcut `GitWebhookService` çekirdeğine, platform-bağımsız saf bir `SmartCommitParser` (metin → komut listesi) + servis-uygulama katmanı eklenir. `GitRef`'e `authorEmail` ve `message` (tam tarama metni) alanları eklenir; `resolveGitActor` event yerine ref/email bazlı çalışır. DB migration ve frontend değişikliği yoktur.

**Tech Stack:** Java 17, Spring Boot 3.2, JPA, JUnit 5, Mockito, Maven.

## Global Constraints

- Java 17; Spring Security rol hiyerarşisi bozulmaz (bu iş yalnızca webhook akışını etkiler, yeni endpoint yok).
- Webhook yalnızca imza doğrulaması geçtikten sonra işlenir (mevcut koruma — değişmez).
- DB migration **yok** (`authorEmail`/`message` runtime ref alanları). Yeni Liquibase changeSet eklenmez.
- Frontend değişikliği **yok**.
- Kod yorumları: uzun satır-satır açıklama yok; yalnızca kısa "neden" notları (CLAUDE.md kuralı).
- İş kodu deseni: `TORA-\d+` (mevcut `GitWebhookService.CODE_PATTERN`).
- Komut→durum eşlemesi **kodda sabit** (admin yapılandırması yok).
- Test çalıştırma dizini: `Backend/`. Komut formatı: `cd Backend && mvn -q -Dtest=<SınıfAdı> test`.

---

### Task 1: `GitRef`'e `authorEmail` + `message` alanları; parser'lar doldursun

**Files:**
- Modify: `Backend/src/main/java/com/tora/git/GitRef.java`
- Modify: `Backend/src/main/java/com/tora/git/GithubWebhookParser.java`
- Modify: `Backend/src/main/java/com/tora/git/GitlabWebhookParser.java`
- Modify: `Backend/src/main/java/com/tora/git/GiteaWebhookParser.java`
- Modify (test): `Backend/src/test/java/com/tora/git/GithubWebhookParserTest.java`
- Modify (test): `Backend/src/test/java/com/tora/git/GitlabWebhookParserTest.java`
- Modify (test): `Backend/src/test/java/com/tora/git/GiteaWebhookParserTest.java`
- Modify (test): `Backend/src/test/java/com/tora/service/GitWebhookServiceTest.java`

**Interfaces:**
- Produces: `GitRef(String linkType, String externalId, String url, String title, String status, String branch, String author, String authorEmail, String message)` — record, iki yeni alan **sona** eklenir.
- Consumes: yok.

> **Not:** Record'a alan eklemek tüm `new GitRef(...)` çağrılarını derleme hatasına düşürür. Bu task atomiktir: alan + 6 çağrı + test güncellemeleri tek commit. TDD: önce bir parser testine email assert'i ekle (kırmızı: derlenmez/null), sonra tümünü uygula (yeşil).

- [ ] **Step 1: Test assert'lerini ekle (kırmızı yap)**

`GithubWebhookParserTest.java` → `parse_push_extractsCommitsAndMessages` testine, mevcut payload'a author email ekle ve assert et. Payload'daki author satırını şununla değiştir:

```java
{"id":"abc123","message":"TORA-12 fix login","url":"http://gh/c/abc123","author":{"name":"Ada","email":"ada@firma.com"}}
```

Aynı testin sonuna ekle:

```java
        assertEquals("ada@firma.com", ref.authorEmail());
        assertEquals("TORA-12 fix login", ref.message());
```

- [ ] **Step 2: Derlemeyi çalıştır, kırmızı doğrula**

Run: `cd Backend && mvn -q -Dtest=GithubWebhookParserTest test`
Expected: FAIL — derleme hatası `cannot find symbol: method authorEmail()` / `message()`.

- [ ] **Step 3: `GitRef` record'una iki alan ekle**

`GitRef.java` tamamını şununla değiştir:

```java
package com.tora.git;

public record GitRef(
    String linkType,
    String externalId,
    String url,
    String title,
    String status,
    String branch,
    String author,
    String authorEmail,
    String message
) {}
```

- [ ] **Step 4: `GithubWebhookParser` — iki çağrıyı güncelle**

`parsePush` içindeki `refs.add(new GitRef(...))` çağrısını şununla değiştir (commit author email + tam mesaj):

```java
            refs.add(new GitRef("COMMIT",
                c.path("id").asText(""),
                c.path("url").asText(""),
                firstLine(msg),
                null, branch,
                c.path("author").path("name").asText(""),
                c.path("author").path("email").asText(""),
                msg));
```

`parsePullRequest` içindeki `GitRef ref = new GitRef(...)` çağrısını şununla değiştir (PR'de yazar email yok → null; mesaj = title + "\n" + body):

```java
        GitRef ref = new GitRef("MR",
            pr.path("number").asText(""),
            pr.path("html_url").asText(""),
            pr.path("title").asText(""),
            status, branch,
            pr.path("user").path("login").asText(""),
            null,
            pr.path("title").asText("") + "\n" + pr.path("body").asText(""));
```

- [ ] **Step 5: `GitlabWebhookParser` — iki çağrıyı güncelle**

`parsePush` içindeki `refs.add(new GitRef(...))`:

```java
            refs.add(new GitRef("COMMIT",
                c.path("id").asText(""),
                c.path("url").asText(""),
                firstLine(msg),
                null, branch,
                c.path("author").path("name").asText(""),
                c.path("author").path("email").asText(""),
                msg));
```

`parseMr` içindeki `GitRef ref = new GitRef(...)`:

```java
        GitRef ref = new GitRef("MR",
            oa.path("iid").asText(""),
            oa.path("url").asText(""),
            oa.path("title").asText(""),
            status, branch,
            root.path("user").path("username").asText(""),
            null,
            oa.path("title").asText("") + "\n" + oa.path("description").asText(""));
```

- [ ] **Step 6: `GiteaWebhookParser` — iki çağrıyı güncelle**

`parsePush` içindeki `refs.add(new GitRef(...))`:

```java
            refs.add(new GitRef("COMMIT",
                c.path("id").asText(""),
                c.path("url").asText(""),
                firstLine(msg),
                null, branch,
                c.path("author").path("name").asText(""),
                c.path("author").path("email").asText(""),
                msg));
```

`parsePullRequest` içindeki `GitRef ref = new GitRef(...)`:

```java
        GitRef ref = new GitRef("MR",
            root.path("number").asText(pr.path("number").asText("")),
            pr.path("html_url").asText(""),
            pr.path("title").asText(""),
            status, branch,
            pr.path("user").path("login").asText(""),
            null,
            pr.path("title").asText("") + "\n" + pr.path("body").asText(""));
```

- [ ] **Step 7: `GitWebhookServiceTest` içindeki `new GitRef(...)` çağrısını düzelt**

`process_linksCommitToMatchedTask` testindeki şu satırı:

```java
        GitRef ref = new GitRef("COMMIT", "abc", "http://x", "TORA-12 fix", null, "feat", "Ada");
```

şununla değiştir:

```java
        GitRef ref = new GitRef("COMMIT", "abc", "http://x", "TORA-12 fix", null, "feat", "Ada", "ada@firma.com", "TORA-12 fix");
```

- [ ] **Step 8: Gitlab/Gitea parser testlerine email payload + assert ekle**

`GitlabWebhookParserTest.java` push testinde author düğümüne `"email":"ada@firma.com"` ekle (commit objesine), ve push ref assert'lerine ekle:

```java
        assertEquals("ada@firma.com", ref.authorEmail());
```

`GiteaWebhookParserTest.java` push testinde aynı şekilde author'a `"email":"ada@firma.com"` ekle ve ekle:

```java
        assertEquals("ada@firma.com", ref.authorEmail());
```

> Mevcut testlerde push commit author bloğu `{"name":"..."}` biçiminde; içine `"email":"ada@firma.com"` ekle. MR testlerinde email yok → `authorEmail()` null kalır, assert eklenmez.

- [ ] **Step 9: Tüm git testlerini çalıştır, yeşil doğrula**

Run: `cd Backend && mvn -q -Dtest=GithubWebhookParserTest,GitlabWebhookParserTest,GiteaWebhookParserTest,GitWebhookServiceTest test`
Expected: PASS — tüm testler geçer.

- [ ] **Step 10: Commit**

```bash
git add Backend/src/main/java/com/tora/git/GitRef.java Backend/src/main/java/com/tora/git/GithubWebhookParser.java Backend/src/main/java/com/tora/git/GitlabWebhookParser.java Backend/src/main/java/com/tora/git/GiteaWebhookParser.java Backend/src/test/java/com/tora/git/GithubWebhookParserTest.java Backend/src/test/java/com/tora/git/GitlabWebhookParserTest.java Backend/src/test/java/com/tora/git/GiteaWebhookParserTest.java Backend/src/test/java/com/tora/service/GitWebhookServiceTest.java
git commit -m "feat(git): GitRef'e authorEmail + message alanlari (smart-commit/email-esleme onkosulu)"
```

---

### Task 2: `SmartCommand` + `SmartCommitParser` (saf parser, TDD)

**Files:**
- Create: `Backend/src/main/java/com/tora/git/SmartCommand.java`
- Create: `Backend/src/main/java/com/tora/git/SmartCommitParser.java`
- Test: `Backend/src/test/java/com/tora/git/SmartCommitParserTest.java`

**Interfaces:**
- Produces:
  - `SmartCommand.Kind` enum: `STATUS`, `COMMENT`.
  - `record SmartCommand(SmartCommand.Kind kind, com.tora.model.enums.TaskStatus status, String text)`.
  - `SmartCommitParser` — Spring `@Component`, metot: `List<SmartCommand> parse(String text)`.
- Consumes: `com.tora.model.enums.TaskStatus` (mevcut enum: `OPEN, IN_PROGRESS, TESTING, COMPLETED, CANCELLED`).

- [ ] **Step 1: `SmartCommitParserTest` yaz (kırmızı)**

Create `Backend/src/test/java/com/tora/git/SmartCommitParserTest.java`:

```java
package com.tora.git;

import com.tora.model.enums.TaskStatus;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SmartCommitParserTest {

    private final SmartCommitParser parser = new SmartCommitParser();

    @Test
    void parse_doneAlias_returnsCompletedStatus() {
        List<SmartCommand> cmds = parser.parse("TORA-42 #done isi bitirdim");
        assertEquals(1, cmds.size());
        assertEquals(SmartCommand.Kind.STATUS, cmds.get(0).kind());
        assertEquals(TaskStatus.COMPLETED, cmds.get(0).status());
    }

    @Test
    void parse_turkishAndEnglishAliases() {
        assertEquals(TaskStatus.COMPLETED, parser.parse("#kapat").get(0).status());
        assertEquals(TaskStatus.IN_PROGRESS, parser.parse("#progress").get(0).status());
        assertEquals(TaskStatus.IN_PROGRESS, parser.parse("#basla").get(0).status());
        assertEquals(TaskStatus.TESTING, parser.parse("#test").get(0).status());
        assertEquals(TaskStatus.CANCELLED, parser.parse("#iptal").get(0).status());
        assertEquals(TaskStatus.OPEN, parser.parse("#reopen").get(0).status());
    }

    @Test
    void parse_caseInsensitive() {
        assertEquals(TaskStatus.COMPLETED, parser.parse("#DONE").get(0).status());
    }

    @Test
    void parse_comment_capturesTextUntilNextHashOrEol() {
        List<SmartCommand> cmds = parser.parse("#comment review bekliyor #done");
        assertEquals(2, cmds.size());
        SmartCommand comment = cmds.stream().filter(c -> c.kind() == SmartCommand.Kind.COMMENT).findFirst().orElseThrow();
        assertEquals("review bekliyor", comment.text());
        assertTrue(cmds.stream().anyMatch(c -> c.kind() == SmartCommand.Kind.STATUS && c.status() == TaskStatus.COMPLETED));
    }

    @Test
    void parse_emptyComment_ignored() {
        List<SmartCommand> cmds = parser.parse("#comment   ");
        assertTrue(cmds.isEmpty());
    }

    @Test
    void parse_unknownCommand_ignored() {
        assertTrue(parser.parse("#frobnicate something").isEmpty());
    }

    @Test
    void parse_noCommand_empty() {
        assertTrue(parser.parse("TORA-42 normal commit mesaji").isEmpty());
        assertTrue(parser.parse(null).isEmpty());
    }

    @Test
    void parse_multipleStatusCommands_allReturned() {
        List<SmartCommand> cmds = parser.parse("#progress #test");
        assertEquals(2, cmds.size());
    }
}
```

- [ ] **Step 2: Test'i çalıştır, kırmızı doğrula**

Run: `cd Backend && mvn -q -Dtest=SmartCommitParserTest test`
Expected: FAIL — `SmartCommand` / `SmartCommitParser` derlenemez.

- [ ] **Step 3: `SmartCommand` record'unu yaz**

Create `Backend/src/main/java/com/tora/git/SmartCommand.java`:

```java
package com.tora.git;

import com.tora.model.enums.TaskStatus;

public record SmartCommand(Kind kind, TaskStatus status, String text) {

    public enum Kind { STATUS, COMMENT }

    public static SmartCommand status(TaskStatus status) {
        return new SmartCommand(Kind.STATUS, status, null);
    }

    public static SmartCommand comment(String text) {
        return new SmartCommand(Kind.COMMENT, null, text);
    }
}
```

- [ ] **Step 4: `SmartCommitParser` yaz**

Create `Backend/src/main/java/com/tora/git/SmartCommitParser.java`:

```java
package com.tora.git;

import com.tora.model.enums.TaskStatus;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class SmartCommitParser {

    // Komut: # ile baslar, kelime; comment komutu metni sonraki # veya satir sonuna kadar alir.
    private static final Pattern TOKEN = Pattern.compile("#([A-Za-z]+)");

    private static final Map<String, TaskStatus> STATUS_ALIASES = Map.ofEntries(
        Map.entry("done", TaskStatus.COMPLETED),
        Map.entry("close", TaskStatus.COMPLETED),
        Map.entry("tamam", TaskStatus.COMPLETED),
        Map.entry("kapat", TaskStatus.COMPLETED),
        Map.entry("progress", TaskStatus.IN_PROGRESS),
        Map.entry("wip", TaskStatus.IN_PROGRESS),
        Map.entry("basla", TaskStatus.IN_PROGRESS),
        Map.entry("test", TaskStatus.TESTING),
        Map.entry("testing", TaskStatus.TESTING),
        Map.entry("cancel", TaskStatus.CANCELLED),
        Map.entry("iptal", TaskStatus.CANCELLED),
        Map.entry("reopen", TaskStatus.OPEN),
        Map.entry("open", TaskStatus.OPEN),
        Map.entry("ac", TaskStatus.OPEN)
    );

    private static final java.util.Set<String> COMMENT_KEYWORDS = java.util.Set.of("comment", "yorum");

    public List<SmartCommand> parse(String text) {
        List<SmartCommand> out = new ArrayList<>();
        if (text == null || text.isBlank()) return out;

        Matcher m = TOKEN.matcher(text);
        while (m.find()) {
            String keyword = m.group(1).toLowerCase();
            TaskStatus status = STATUS_ALIASES.get(keyword);
            if (status != null) {
                out.add(SmartCommand.status(status));
            } else if (COMMENT_KEYWORDS.contains(keyword)) {
                String body = captureCommentBody(text, m.end());
                if (!body.isBlank()) {
                    out.add(SmartCommand.comment(body.trim()));
                }
            }
            // bilinmeyen komut: yok say
        }
        return out;
    }

    // Komut sonundan, sonraki '#' veya satir sonuna kadar olan metni doner.
    private String captureCommentBody(String text, int from) {
        int end = text.length();
        for (int i = from; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == '#' || ch == '\n' || ch == '\r') { end = i; break; }
        }
        return text.substring(from, end);
    }
}
```

- [ ] **Step 5: Test'i çalıştır, yeşil doğrula**

Run: `cd Backend && mvn -q -Dtest=SmartCommitParserTest test`
Expected: PASS — 8 test geçer.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/main/java/com/tora/git/SmartCommand.java Backend/src/main/java/com/tora/git/SmartCommitParser.java Backend/src/test/java/com/tora/git/SmartCommitParserTest.java
git commit -m "feat(git): SmartCommitParser - commit mesajindan durum/yorum komutlari"
```

---

### Task 3: `UserRepository.findByEmailIgnoreCase` + `TaskCommentService.createSystemComment`

**Files:**
- Modify: `Backend/src/main/java/com/tora/repository/UserRepository.java`
- Modify: `Backend/src/main/java/com/tora/service/TaskCommentService.java`
- Test: `Backend/src/test/java/com/tora/service/TaskCommentServiceSystemTest.java` (Create)

**Interfaces:**
- Produces:
  - `UserRepository.findByEmailIgnoreCase(String email) -> Optional<User>`.
  - `TaskCommentService.createSystemComment(Task task, String content, User author) -> TaskComment` — auth/SecurityContext kullanmaz; bildirim gönderir.
- Consumes: yok.

- [ ] **Step 1: `createSystemComment` için test yaz (kırmızı)**

Create `Backend/src/test/java/com/tora/service/TaskCommentServiceSystemTest.java`:

```java
package com.tora.service;

import com.tora.model.Task;
import com.tora.model.TaskComment;
import com.tora.model.User;
import com.tora.repository.TaskCommentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskCommentServiceSystemTest {

    @Mock TaskCommentRepository commentRepository;
    @Mock NotificationService notificationService;
    @InjectMocks TaskCommentService service;

    @Test
    void createSystemComment_savesWithGivenAuthorAndNotifies() {
        Task task = new Task();
        task.setId(7L);
        User actor = new User();
        actor.setId(3L);
        actor.setUsername("ada");

        when(commentRepository.save(any(TaskComment.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        TaskComment saved = service.createSystemComment(task, "git ile eklendi", actor);

        assertEquals("git ile eklendi", saved.getContent());
        assertEquals(actor, saved.getAuthor());
        assertEquals(task, saved.getTask());
        verify(commentRepository).save(any(TaskComment.class));
        verify(notificationService).notifyNewComment(any(TaskComment.class));
    }
}
```

> `TaskCommentService` alanları `@Autowired field injection`; `@InjectMocks` yalnızca mock'lanan alanları doldurur, diğerleri null kalır. `createSystemComment` yalnızca `commentRepository` + `notificationService` (+ mention için `userRepository`) kullanmalı; mention'sız içerikte `userRepository` çağrılmaz, null sorun olmaz.

- [ ] **Step 2: Test'i çalıştır, kırmızı doğrula**

Run: `cd Backend && mvn -q -Dtest=TaskCommentServiceSystemTest test`
Expected: FAIL — `createSystemComment` metodu yok.

- [ ] **Step 3: `findByEmailIgnoreCase` ekle**

`UserRepository.java` içinde `findByEmail` satırından sonra ekle:

```java
    Optional<User> findByEmailIgnoreCase(String email);
```

- [ ] **Step 4: `createSystemComment` ekle**

`TaskCommentService.java` içinde `createComment(...)` metodundan sonra ekle:

```java
    // Webhook/sistem aktörü için; SecurityContext yok, erisim kontrolu uygulanmaz (guvenilir kaynak).
    @Transactional
    public TaskComment createSystemComment(Task task, String content, User author) {
        TaskComment comment = new TaskComment();
        comment.setTask(task);
        comment.setAuthor(author);
        comment.setContent(content.trim());
        comment.setMentions(resolveMentions(content));

        TaskComment saved = commentRepository.save(comment);
        notificationService.notifyCommentMention(saved, saved.getMentions());
        notificationService.notifyNewComment(saved);
        return saved;
    }
```

- [ ] **Step 5: Test'i çalıştır, yeşil doğrula**

Run: `cd Backend && mvn -q -Dtest=TaskCommentServiceSystemTest test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/main/java/com/tora/repository/UserRepository.java Backend/src/main/java/com/tora/service/TaskCommentService.java Backend/src/test/java/com/tora/service/TaskCommentServiceSystemTest.java
git commit -m "feat(git): createSystemComment + findByEmailIgnoreCase (smart-commit altyapisi)"
```

---

### Task 4: `GitWebhookService` — smart-commit uygula + email-eşleme aktör

**Files:**
- Modify: `Backend/src/main/java/com/tora/service/GitWebhookService.java`
- Modify (test): `Backend/src/test/java/com/tora/service/GitWebhookServiceTest.java`

**Interfaces:**
- Consumes: `SmartCommitParser.parse(String)`, `SmartCommand`, `TaskCommentService.createSystemComment(Task,String,User)`, `UserRepository.findByEmailIgnoreCase(String)`, `TaskService.updateTaskStatusAsSystem(Long,TaskStatus,User)`, `GitWebhookService.extractCodes(Collection)`.
- Produces: davranış değişikliği — komut işleme + ref bazlı aktör. Public imzalar değişmez (`process`, `extractCodes`).

> **Tasarım:** Constructor'a `SmartCommitParser` + `TaskCommentService` enjekte edilir. `process()` içinde linking'den sonra her ref için: `extractCodes(ref.message)` ile o ref'in kodları + `smartCommitParser.parse(ref.message)` ile komutlar. Komutlar yalnızca o ref'in kodlarına karşılık gelen görevlere uygulanır. STATUS işlenen görev id'leri `overridden` set'ine girer; `applyStatusSync` yalnızca bu set'te olmayan görevlere uygulanır. `resolveGitActor(GitRef)` → email-eşleme.

- [ ] **Step 1: Servis testine smart-commit + email-eşleme testleri ekle (kırmızı)**

`GitWebhookServiceTest.java` içine, `process_linksCommitToMatchedTask` testinden sonra şu iki testi ekle. Sınıfın başına import ekle (yoksa): `import com.tora.model.enums.TaskStatus;`

```java
    @Test
    void process_smartCommitDone_setsStatusViaMatchedEmailActor() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(true);
        gs.setPushStatus("OPEN"); // genel ayar; komut bunu override etmeli
        when(settings.getActiveSettings()).thenReturn(gs);
        when(settings.getDecryptedSecret()).thenReturn("s");

        GitWebhookParser parser = mock(GitWebhookParser.class);
        when(parser.platform()).thenReturn("github");
        when(parser.verify(any(), any(), eq("s"))).thenReturn(true);
        GitRef ref = new GitRef("COMMIT", "abc", "http://x", "TORA-12 #done",
            null, "feat", "Ada", "ada@firma.com", "TORA-12 #done bitti");
        when(parser.parse(any(), any())).thenReturn(Optional.of(
            new GitEvent("github", GitEventType.PUSH, List.of("TORA-12 #done bitti"), List.of(ref))));

        Task task = new Task();
        task.setId(5L);
        task.setCode("TORA-12"); // applySmartCommits gorevleri koda gore indeksler
        TaskRepository taskRepo = mock(TaskRepository.class);
        when(taskRepo.findByCode("TORA-12")).thenReturn(Optional.of(task));

        TaskGitLinkRepository linkRepo = mock(TaskGitLinkRepository.class);
        when(linkRepo.findByTask_IdAndPlatformAndLinkTypeAndExternalId(5L, "github", "COMMIT", "abc"))
            .thenReturn(Optional.empty());

        User actor = new User();
        actor.setId(3L);
        UserRepository userRepo = mock(UserRepository.class);
        when(userRepo.findByEmailIgnoreCase("ada@firma.com")).thenReturn(Optional.of(actor));

        TaskService taskService = mock(TaskService.class);
        SmartCommitParser smart = new SmartCommitParser();
        TaskCommentService commentService = mock(TaskCommentService.class);

        GitWebhookService svc = new GitWebhookService(
            settings, List.of(parser), taskRepo, linkRepo, userRepo, taskService, smart, commentService);

        var result = svc.process("github", Map.of(), "{}".getBytes());

        assertEquals(GitWebhookService.WebhookOutcome.PROCESSED, result.outcome());
        // komut COMPLETED uygulanir; genel push ayari OPEN uygulanmaz (override)
        verify(taskService).updateTaskStatusAsSystem(5L, TaskStatus.COMPLETED, actor);
        verify(taskService, never()).updateTaskStatusAsSystem(5L, TaskStatus.OPEN, actor);
    }

    @Test
    void process_smartCommitComment_addsSystemComment() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(true);
        when(settings.getActiveSettings()).thenReturn(gs);
        when(settings.getDecryptedSecret()).thenReturn("s");

        GitWebhookParser parser = mock(GitWebhookParser.class);
        when(parser.platform()).thenReturn("github");
        when(parser.verify(any(), any(), eq("s"))).thenReturn(true);
        GitRef ref = new GitRef("COMMIT", "abc", "http://x", "TORA-12",
            null, "feat", "Ada", "yok@firma.com", "TORA-12 #comment ilgileniyorum");
        when(parser.parse(any(), any())).thenReturn(Optional.of(
            new GitEvent("github", GitEventType.PUSH, List.of("TORA-12 #comment ilgileniyorum"), List.of(ref))));

        Task task = new Task();
        task.setId(5L);
        task.setCode("TORA-12"); // applySmartCommits gorevleri koda gore indeksler
        TaskRepository taskRepo = mock(TaskRepository.class);
        when(taskRepo.findByCode("TORA-12")).thenReturn(Optional.of(task));

        TaskGitLinkRepository linkRepo = mock(TaskGitLinkRepository.class);
        when(linkRepo.findByTask_IdAndPlatformAndLinkTypeAndExternalId(5L, "github", "COMMIT", "abc"))
            .thenReturn(Optional.empty());

        User system = new User();
        system.setId(1L);
        UserRepository userRepo = mock(UserRepository.class);
        when(userRepo.findByEmailIgnoreCase("yok@firma.com")).thenReturn(Optional.empty());
        when(userRepo.findByUsername("git-otomasyonu")).thenReturn(Optional.of(system));

        TaskService taskService = mock(TaskService.class);
        SmartCommitParser smart = new SmartCommitParser();
        TaskCommentService commentService = mock(TaskCommentService.class);

        GitWebhookService svc = new GitWebhookService(
            settings, List.of(parser), taskRepo, linkRepo, userRepo, taskService, smart, commentService);

        var result = svc.process("github", Map.of(), "{}".getBytes());

        assertEquals(GitWebhookService.WebhookOutcome.PROCESSED, result.outcome());
        verify(commentService).createSystemComment(task, "ilgileniyorum", system);
    }
```

- [ ] **Step 2: Test'i çalıştır, kırmızı doğrula**

Run: `cd Backend && mvn -q -Dtest=GitWebhookServiceTest test`
Expected: FAIL — `GitWebhookService` constructor 6 parametre alıyor (8 verildi), `SmartCommitParser`/`TaskCommentService` enjekte değil.

- [ ] **Step 3: `GitWebhookService` — bağımlılık ekle + komut işleme**

`GitWebhookService.java` import bloğuna ekle:

```java
import com.tora.git.SmartCommand;
import com.tora.git.SmartCommitParser;
```

Alanlara ekle (mevcut `private final TaskService taskService;` satırından sonra):

```java
    private final SmartCommitParser smartCommitParser;
    private final TaskCommentService taskCommentService;
```

Constructor imzasını ve gövdesini güncelle — yeni iki parametreyi sona ekle:

```java
    public GitWebhookService(GitSettingsService gitSettingsService,
                             List<GitWebhookParser> parserList,
                             TaskRepository taskRepository,
                             TaskGitLinkRepository linkRepository,
                             UserRepository userRepository,
                             TaskService taskService,
                             SmartCommitParser smartCommitParser,
                             TaskCommentService taskCommentService) {
        this.gitSettingsService = gitSettingsService;
        this.taskRepository = taskRepository;
        this.linkRepository = linkRepository;
        this.userRepository = userRepository;
        this.taskService = taskService;
        this.smartCommitParser = smartCommitParser;
        this.taskCommentService = taskCommentService;
        for (GitWebhookParser p : parserList) {
            this.parsers.put(p.platform(), p);
        }
    }
```

- [ ] **Step 4: `process()` — smart-commit geçişi + override set**

`process()` içindeki linking + status sync bölümünü (mevcut `int linked = 0;` bloğundan `applyStatusSync(...)` çağrısına kadar) şununla değiştir:

```java
        int linked = 0;
        for (Task task : matchedTasks) {
            for (GitRef ref : event.refs()) {
                upsertLink(task, event.platform(), ref);
                linked++;
            }
        }

        // Smart-commit: her ref kendi metnindeki kodlara komut uygular; STATUS uygulanan gorevler
        // genel durum senkronundan muaf tutulur (komut > ayar).
        Set<Long> statusOverridden = applySmartCommits(event, matchedTasks);
        applyStatusSync(event, settings, matchedTasks, statusOverridden);
        return new WebhookResult(WebhookOutcome.PROCESSED, linked);
```

- [ ] **Step 5: `applySmartCommits` metodunu ekle**

`upsertLink(...)` metodundan sonra ekle:

```java
    private Set<Long> applySmartCommits(GitEvent event, List<Task> matchedTasks) {
        Set<Long> statusOverridden = new HashSet<>();
        Map<String, Task> byCode = new HashMap<>();
        for (Task t : matchedTasks) {
            if (t.getCode() != null) byCode.put(t.getCode().toUpperCase(), t);
        }
        for (GitRef ref : event.refs()) {
            String text = ref.message();
            if (text == null || text.isBlank()) continue;
            List<SmartCommand> commands = smartCommitParser.parse(text);
            if (commands.isEmpty()) continue;
            List<String> refCodes = extractCodes(List.of(text));
            if (refCodes.isEmpty()) continue;

            User actor = resolveGitActor(ref);
            for (String code : refCodes) {
                Task task = byCode.get(code);
                if (task == null) continue;
                for (SmartCommand cmd : commands) {
                    applyCommand(task, cmd, actor, statusOverridden);
                }
            }
        }
        return statusOverridden;
    }

    private void applyCommand(Task task, SmartCommand cmd, User actor, Set<Long> statusOverridden) {
        if (actor == null) {
            log.warn("Git smart-commit: aktor cozulemedi, gorev {} komut atlandi", task.getId());
            return;
        }
        try {
            switch (cmd.kind()) {
                case STATUS -> {
                    if (task.getStatus() != cmd.status()) {
                        taskService.updateTaskStatusAsSystem(task.getId(), cmd.status(), actor);
                    }
                    statusOverridden.add(task.getId());
                }
                case COMMENT -> taskCommentService.createSystemComment(task, cmd.text(), actor);
            }
        } catch (Exception ex) {
            log.warn("Git smart-commit: gorev {} komut uygulamasi basarisiz: {}", task.getId(), ex.getMessage());
        }
    }
```

> **Not:** `STATUS` komutunda durum zaten hedefse `updateTaskStatusAsSystem` çağrılmaz ama görev yine de `statusOverridden`'a eklenir — genel ayar bu görevde uygulanmasın.

- [ ] **Step 6: `applyStatusSync` imzasına `overridden` ekle + `resolveGitActor` ref bazlı yap**

Mevcut `applyStatusSync(GitEvent event, GitSettings settings, List<Task> tasks)` imzasını ve döngüsünü değiştir:

```java
    private void applyStatusSync(GitEvent event, GitSettings settings, List<Task> tasks, Set<Long> overridden) {
        String target = switch (event.type()) {
            case MR_OPENED -> settings.getMrOpenedStatus();
            case MR_MERGED -> settings.getMrMergedStatus();
            case PUSH -> settings.getPushStatus();
            case MR_CLOSED -> null;
        };
        if (target == null || target.isBlank()) return;

        TaskStatus newStatus;
        try {
            newStatus = TaskStatus.valueOf(target);
        } catch (IllegalArgumentException e) {
            log.warn("Git webhook: gecersiz durum ayari '{}'", target);
            return;
        }
        User actor = event.refs().isEmpty() ? resolveGitActor(null) : resolveGitActor(event.refs().get(0));
        if (actor == null) {
            log.warn("Git webhook: sistem kullanicisi '{}' bulunamadi, durum senkronu atlandi", SYSTEM_USERNAME);
            return;
        }
        for (Task task : tasks) {
            if (overridden.contains(task.getId())) continue;
            if (task.getStatus() == newStatus) continue;
            try {
                taskService.updateTaskStatusAsSystem(task.getId(), newStatus, actor);
            } catch (Exception ex) {
                log.warn("Git webhook: gorev {} durum senkronu basarisiz: {}", task.getId(), ex.getMessage());
            }
        }
    }

    // Email-esleme: ref yazarinin emaili -> User; bulunamazsa sistem kullanicisi.
    private User resolveGitActor(GitRef ref) {
        if (ref != null && ref.authorEmail() != null && !ref.authorEmail().isBlank()) {
            Optional<User> matched = userRepository.findByEmailIgnoreCase(ref.authorEmail());
            if (matched.isPresent()) return matched.get();
        }
        return userRepository.findByUsername(SYSTEM_USERNAME).orElse(null);
    }
```

> Eski `resolveGitActor(GitEvent event)` metodunu **sil** (yeni ref bazlı sürüm onun yerine geçer).

- [ ] **Step 7: Test'i çalıştır, yeşil doğrula**

Run: `cd Backend && mvn -q -Dtest=GitWebhookServiceTest test`
Expected: PASS — eski 4 + yeni 2 = 6 test geçer.

- [ ] **Step 8: Tüm git + servis testlerini birlikte çalıştır (regresyon)**

Run: `cd Backend && mvn -q -Dtest=GithubWebhookParserTest,GitlabWebhookParserTest,GiteaWebhookParserTest,GitWebhookServiceTest,SmartCommitParserTest,TaskCommentServiceSystemTest,HmacUtilTest test`
Expected: PASS — hepsi yeşil.

- [ ] **Step 9: Commit**

```bash
git add Backend/src/main/java/com/tora/service/GitWebhookService.java Backend/src/test/java/com/tora/service/GitWebhookServiceTest.java
git commit -m "feat(git): smart-commit komut uygulamasi + ref bazli email-esleme aktor"
```

---

### Task 5: Dokümantasyon + todo güncelle

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/api-reference.md`
- Modify: `docs/frontend.md` (veya git entegrasyon dokümanı — smart-commit sözdizimi kullanıcı notu)
- Modify: `todo/todo.md`

**Interfaces:** yok (dokümantasyon).

- [ ] **Step 1: `architecture.md` — smart-commit akışını ekle**

Git entegrasyonu bölümüne, `GitWebhookService` akış açıklamasına şu cümleyi ekle:

```markdown
- **Smart-commit:** Commit/MR mesajında iş kodundan sonra gelen komutlar (`#done`, `#progress`, `#test`, `#cancel`, `#reopen`, `#comment <metin>` ve Türkçe takma adları) `SmartCommitParser` ile ayrıştırılır. Durum komutu görevi o duruma taşır ve genel push/MR durum senkronunu o görev için override eder; `#comment` göreve sistem yorumu ekler. Aktör, commit yazarının email'i `User.email` ile eşlenerek bulunur (yoksa `git-otomasyonu`).
```

- [ ] **Step 2: `api-reference.md` — smart-commit notu**

Git webhook endpoint bölümüne ekle:

```markdown
**Smart-commit komutları:** Webhook gövdesindeki commit/MR mesajı iş kodu (`TORA-\d+`) içeriyorsa, koddan sonra gelen komutlar işlenir:
`#done`/`#close`/`#tamam`/`#kapat` → COMPLETED, `#progress`/`#wip`/`#basla` → IN_PROGRESS, `#test`/`#testing` → TESTING, `#cancel`/`#iptal` → CANCELLED, `#reopen`/`#open`/`#ac` → OPEN, `#comment <metin>`/`#yorum <metin>` → göreve yorum. Durum komutu admin durum-senkron ayarını override eder.
```

- [ ] **Step 3: `frontend.md` — kullanıcı notu**

Git entegrasyonu bölümüne kısa kullanıcı notu ekle (frontend değişmedi, ama kullanım yönergesi burada):

```markdown
> **Smart-commit kullanımı:** Commit mesajına `TORA-42 #done` yazarak görevi tamamlandı işaretleyebilir, `TORA-42 #comment metin` ile göreve yorum bırakabilirsiniz. Commit yazarınızın git email'i TORA hesabınızdaki email ile aynıysa işlem sizin adınıza kaydedilir.
```

- [ ] **Step 4: `todo.md` — Git Entegrasyonu bölümünü güncelle**

`#### ✅ Git Entegrasyonu (Inbound / Webhook)` bölümündeki "Sonraki sub-project" satırından önce şu maddeyi ekle:

```markdown
- [x] Smart-commit komutları + aktör email-eşleme (2026-06-28): `SmartCommitParser` (durum geçişi + `#comment`, TR/EN alias); commit yazarı email → `User` (yoksa sistem); komut, genel durum senkronunu override eder. Tasarım: `docs/superpowers/specs/2026-06-28-smart-commit-email-esleme-design.md`
```

Ve "Sonraki sub-project (backlog)" satırından `smart-commit komutları (TORA-42 #done)` ifadesini çıkar (artık tamamlandı), `aktör email-eşleme` ifadesini de çıkar; yalnızca outbound kalsın:

```markdown
- **Sonraki sub-project (backlog):** outbound (iş içinden "Branch/MR oluştur", repo token + git API yazma)
```

- [ ] **Step 5: Commit**

```bash
git add docs/architecture.md docs/api-reference.md docs/frontend.md todo/todo.md
git commit -m "docs(git): smart-commit + email-esleme dokumantasyonu ve todo guncellemesi"
```

---

## Self-Review Notları

- **Spec kapsamı:** §2 komut sözdizimi → Task 2 (parser) + Task 4 (uygulama). §3 bileşenler → Task 2. §4 entegrasyon/override → Task 4. §5 email-eşleme → Task 1 (authorEmail) + Task 3 (repo) + Task 4 (resolveGitActor). §6 sistem yorumu → Task 3. §8 testler → her task. §9 kapsam dışı → korunuyor (migration/frontend yok).
- **Tip tutarlılığı:** `GitRef(...,authorEmail,message)` 9 alan — tüm çağrılar Task 1'de güncellenir. `SmartCommand.Kind {STATUS,COMMENT}`, `createSystemComment(Task,String,User)`, `findByEmailIgnoreCase`, `resolveGitActor(GitRef)` Task 4'te tutarlı kullanılır. `GitWebhookService` constructor 8 parametre — test ve Spring DI uyumlu.
- **Migration/Frontend yok:** Global Constraints'e uygun.

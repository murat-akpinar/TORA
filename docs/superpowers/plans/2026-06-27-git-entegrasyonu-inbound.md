# Git Entegrasyonu (Inbound / Webhook) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Git platformlarından (GitHub/GitLab/Gitea) gelen webhook'ları alıp `TORA-\d+` iş koduyla görevleri eşle, commit/MR referanslarını göreve bağla ve admin-ayarlı durum senkronu uygula (COMPLETED'e geçişte mevcut zincir tetikleyici event'i yayınla).

**Architecture:** Platform-bağımsız çekirdek (`GitWebhookService`) + platform başına `GitWebhookParser` (imza doğrulama + ortak `GitEvent`'e çevirme). Controller ham gövdeyi (`byte[]`) alır → parser imzayı doğrular → çekirdek kodları çıkarır, `task_git_links`'e idempotent upsert eder, sistem kullanıcısı adına durumu senkronlar. Ayarlar `ldap_settings` desenini izler (secret `EncryptionService` ile şifreli).

**Tech Stack:** Java 17, Spring Boot 3.2, JPA/Hibernate, PostgreSQL 15, Liquibase, Spring Security 6, `javax.crypto.Mac` (HMAC-SHA256 — yeni bağımlılık yok), React 18 + TypeScript, Nginx.

## Global Constraints

- Liquibase migration ID'lerini yeniden sıralama veya çakıştırma. Yeni dosya: `V33__create_git_integration.xml`, master'a en sona ekle.
- JWT secret ve şifreler env'den gelir; webhook secret DB'de **`EncryptionService` ile şifreli** saklanır, asla düz metin loglanmaz.
- Role hiyerarşisi `ADMIN > BIRIM_AMIRI > USER` bozulmaz. Admin git ayar endpoint'leri `@PreAuthorize("hasAnyRole('ADMIN')")`.
- Kod yorumları: yalnızca banner başlıkları + gerektiğinde tek satırlık "neden" notu. Satır satır açıklama yok.
- Yeni bağımlılık ekleme — HMAC için `javax.crypto.Mac` kullan.
- Webhook endpoint'i JWT'siz (`permitAll`); güvenlik **imza** ile. İmza geçersiz → 401. Entegrasyon kapalı → 200 no-op.
- Unique constraint `(task_id, platform, link_type, external_id)` → tekrar teslimat idempotent.
- Maven test komutları PowerShell üzerinden Windows yolu + `.m2` mount ile docker içinde çalıştırılır (Git Bash `-w /app` yolunu bozar).
- Her structural değişiklikte `docs/` ve `todo/todo.md` aynı commit'te güncellenir (CLAUDE.md zorunlu kuralı).

**Test çalıştırma referansı (PowerShell tool):**
```powershell
docker run --rm -v "C:\Users\shyuuhei\GIT\TORA\Backend:C:\app" -v "$env:USERPROFILE\.m2:C:\root\.m2" -w C:\app maven:3.9-eclipse-temurin-17 mvn -q -Dtest=<TestClass> test
```
> Eğer projede bunun yerine `docker compose exec` ile çalışan bir backend varsa, mevcut çalışan kalıbı kullan. Birim testleri (Mockito) DB gerektirmez.

---

### Task 1: V33 migration — git_settings, task_git_links, sistem kullanıcısı seed

**Files:**
- Create: `Backend/src/main/resources/db/changelog/changes/V33__create_git_integration.xml`
- Modify: `Backend/src/main/resources/db/changelog/db.changelog-master.xml:38` (V32 satırından sonra include ekle)

**Interfaces:**
- Produces: `git_settings` tablosu (tek satır), `task_git_links` tablosu (unique `(task_id,platform,link_type,external_id)`, index `task_id`), `git-otomasyonu` kullanıcısı (`is_active=false`).

- [ ] **Step 1: Migration dosyasını yaz**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
    http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.20.xsd">

    <changeSet id="v33_create_git_settings" author="tora">
        <createTable tableName="git_settings">
            <column name="id" type="BIGSERIAL" autoIncrement="true">
                <constraints primaryKey="true" nullable="false"/>
            </column>
            <column name="is_enabled" type="BOOLEAN" defaultValueBoolean="false">
                <constraints nullable="false"/>
            </column>
            <column name="webhook_secret_encrypted" type="VARCHAR(500)"/>
            <column name="mr_opened_status" type="VARCHAR(20)"/>
            <column name="mr_merged_status" type="VARCHAR(20)"/>
            <column name="push_status" type="VARCHAR(20)"/>
            <column name="created_at" type="TIMESTAMP" defaultValueComputed="CURRENT_TIMESTAMP">
                <constraints nullable="false"/>
            </column>
            <column name="updated_at" type="TIMESTAMP" defaultValueComputed="CURRENT_TIMESTAMP">
                <constraints nullable="false"/>
            </column>
        </createTable>
        <sql>
            INSERT INTO git_settings (is_enabled, created_at, updated_at)
            SELECT false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            WHERE NOT EXISTS (SELECT 1 FROM git_settings);
        </sql>
    </changeSet>

    <changeSet id="v33_create_task_git_links" author="tora">
        <createTable tableName="task_git_links">
            <column name="id" type="BIGSERIAL" autoIncrement="true">
                <constraints primaryKey="true" nullable="false"/>
            </column>
            <column name="task_id" type="BIGINT">
                <constraints nullable="false"
                    foreignKeyName="fk_git_link_task"
                    references="tasks(id)" deleteCascade="true"/>
            </column>
            <column name="platform" type="VARCHAR(20)">
                <constraints nullable="false"/>
            </column>
            <column name="link_type" type="VARCHAR(20)">
                <constraints nullable="false"/>
            </column>
            <column name="external_id" type="VARCHAR(255)">
                <constraints nullable="false"/>
            </column>
            <column name="url" type="VARCHAR(1000)"/>
            <column name="title" type="VARCHAR(500)"/>
            <column name="status" type="VARCHAR(30)"/>
            <column name="branch" type="VARCHAR(255)"/>
            <column name="author" type="VARCHAR(255)"/>
            <column name="created_at" type="TIMESTAMP" defaultValueComputed="CURRENT_TIMESTAMP">
                <constraints nullable="false"/>
            </column>
            <column name="updated_at" type="TIMESTAMP" defaultValueComputed="CURRENT_TIMESTAMP">
                <constraints nullable="false"/>
            </column>
        </createTable>
        <addUniqueConstraint tableName="task_git_links"
            columnNames="task_id, platform, link_type, external_id"
            constraintName="uq_task_git_link"/>
        <createIndex tableName="task_git_links" indexName="idx_git_link_task">
            <column name="task_id"/>
        </createIndex>
    </changeSet>

    <changeSet id="v33_seed_git_system_user" author="tora">
        <preConditions onFail="MARK_RAN">
            <tableExists tableName="users"/>
        </preConditions>
        <comment>Git Otomasyonu sistem kullanıcısı — created_by/changed_by referansı; listelerde çıkmaz (is_active=false)</comment>
        <sql>
            INSERT INTO users (username, email, full_name, password, is_active, ldap_dn, created_at, updated_at)
            VALUES ('git-otomasyonu', 'git-otomasyonu@tora.local', 'Git Otomasyonu',
                    '!disabled-login!', false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (username) DO NOTHING;
        </sql>
        <sql>
            INSERT INTO user_roles (user_id, role_id)
            SELECT u.id, r.id FROM users u, roles r
            WHERE u.username = 'git-otomasyonu' AND r.name = 'USER'
            AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);
        </sql>
    </changeSet>

</databaseChangeLog>
```

- [ ] **Step 2: Master changelog'a include ekle**

`Backend/src/main/resources/db/changelog/db.changelog-master.xml` içinde `V32__task_code.xml` include satırından hemen sonra:

```xml
    <include file="db/changelog/changes/V33__create_git_integration.xml"/>
```

- [ ] **Step 3: Doğrula (uygulama ayağa kalkınca migration uygulanır)**

Run: `docker compose up -d --build backend` ardından logda Liquibase hatası olmadığını doğrula.
Expected: `git_settings`, `task_git_links` tabloları oluşur; `git-otomasyonu` kullanıcısı eklenir.

- [ ] **Step 4: Commit**

```bash
git add Backend/src/main/resources/db/changelog/
git commit -m "feat(git): V33 migration — git_settings, task_git_links, system user seed"
```

---

### Task 2: GitSettings entity + repository

**Files:**
- Create: `Backend/src/main/java/com/tora/model/GitSettings.java`
- Create: `Backend/src/main/java/com/tora/repository/GitSettingsRepository.java`

**Interfaces:**
- Produces: `GitSettings` (getters/setters via Lombok `@Data`): `Boolean isEnabled`, `String webhookSecretEncrypted`, `String mrOpenedStatus`, `String mrMergedStatus`, `String pushStatus`. `GitSettingsRepository extends JpaRepository<GitSettings, Long>` with `Optional<GitSettings> findTopByOrderByIdAsc()`.

- [ ] **Step 1: Entity yaz**

```java
package com.tora.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "git_settings")
@Data
public class GitSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "is_enabled", nullable = false)
    private Boolean isEnabled = false;

    @Column(name = "webhook_secret_encrypted", length = 500)
    private String webhookSecretEncrypted;

    @Column(name = "mr_opened_status", length = 20)
    private String mrOpenedStatus;

    @Column(name = "mr_merged_status", length = 20)
    private String mrMergedStatus;

    @Column(name = "push_status", length = 20)
    private String pushStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 2: Repository yaz**

```java
package com.tora.repository;

import com.tora.model.GitSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface GitSettingsRepository extends JpaRepository<GitSettings, Long> {
    Optional<GitSettings> findTopByOrderByIdAsc();
}
```

- [ ] **Step 3: Derle**

Run: backend derlemesi (`mvn -q compile` veya `docker compose up -d --build backend`)
Expected: derleme başarılı.

- [ ] **Step 4: Commit**

```bash
git add Backend/src/main/java/com/tora/model/GitSettings.java Backend/src/main/java/com/tora/repository/GitSettingsRepository.java
git commit -m "feat(git): GitSettings entity + repository"
```

---

### Task 3: GitSettings DTO'ları + GitSettingsService

**Files:**
- Create: `Backend/src/main/java/com/tora/dto/GitSettingsDTO.java`
- Create: `Backend/src/main/java/com/tora/dto/UpdateGitSettingsRequest.java`
- Create: `Backend/src/main/java/com/tora/service/GitSettingsService.java`

**Interfaces:**
- Consumes: `GitSettingsRepository` (Task 2), `EncryptionService.encrypt(String)/decrypt(String)`.
- Produces:
  - `GitSettingsDTO`: `boolean enabled`, `boolean secretConfigured`, `String mrOpenedStatus`, `String mrMergedStatus`, `String pushStatus` (secret düz metni **asla** dönmez).
  - `UpdateGitSettingsRequest`: `Boolean enabled`, `String webhookSecret` (null/boş → değiştirme), `String mrOpenedStatus`, `String mrMergedStatus`, `String pushStatus`.
  - `GitSettingsService`:
    - `GitSettingsDTO getSettings()`
    - `GitSettingsDTO updateSettings(UpdateGitSettingsRequest req)`
    - `GitSettings getActiveSettings()` (entity; çekirdek servis kullanır)
    - `String getDecryptedSecret()` (null döndürebilir)

- [ ] **Step 1: DTO'ları yaz**

`GitSettingsDTO.java`:
```java
package com.tora.dto;

import lombok.Data;

@Data
public class GitSettingsDTO {
    private boolean enabled;
    private boolean secretConfigured;
    private String mrOpenedStatus;
    private String mrMergedStatus;
    private String pushStatus;
}
```

`UpdateGitSettingsRequest.java`:
```java
package com.tora.dto;

import lombok.Data;

@Data
public class UpdateGitSettingsRequest {
    private Boolean enabled;
    private String webhookSecret;
    private String mrOpenedStatus;
    private String mrMergedStatus;
    private String pushStatus;
}
```

- [ ] **Step 2: Service yaz**

```java
package com.tora.service;

import com.tora.dto.GitSettingsDTO;
import com.tora.dto.UpdateGitSettingsRequest;
import com.tora.model.GitSettings;
import com.tora.repository.GitSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GitSettingsService {

    private final GitSettingsRepository repository;
    private final EncryptionService encryptionService;

    public GitSettingsService(GitSettingsRepository repository, EncryptionService encryptionService) {
        this.repository = repository;
        this.encryptionService = encryptionService;
    }

    @Transactional(readOnly = true)
    public GitSettingsDTO getSettings() {
        return toDTO(getActiveSettings());
    }

    @Transactional
    public GitSettingsDTO updateSettings(UpdateGitSettingsRequest req) {
        GitSettings s = getActiveSettings();
        if (req.getEnabled() != null) s.setIsEnabled(req.getEnabled());
        // boş gönderim → mevcut secret korunur
        if (req.getWebhookSecret() != null && !req.getWebhookSecret().isBlank()) {
            s.setWebhookSecretEncrypted(encryptionService.encrypt(req.getWebhookSecret().trim()));
        }
        s.setMrOpenedStatus(normalize(req.getMrOpenedStatus()));
        s.setMrMergedStatus(normalize(req.getMrMergedStatus()));
        s.setPushStatus(normalize(req.getPushStatus()));
        return toDTO(repository.save(s));
    }

    @Transactional(readOnly = true)
    public GitSettings getActiveSettings() {
        return repository.findTopByOrderByIdAsc().orElseGet(() -> {
            GitSettings s = new GitSettings();
            s.setIsEnabled(false);
            return repository.save(s);
        });
    }

    public String getDecryptedSecret() {
        String enc = getActiveSettings().getWebhookSecretEncrypted();
        return (enc == null || enc.isBlank()) ? null : encryptionService.decrypt(enc);
    }

    private String normalize(String v) {
        return (v == null || v.isBlank()) ? null : v.trim();
    }

    private GitSettingsDTO toDTO(GitSettings s) {
        GitSettingsDTO dto = new GitSettingsDTO();
        dto.setEnabled(Boolean.TRUE.equals(s.getIsEnabled()));
        dto.setSecretConfigured(s.getWebhookSecretEncrypted() != null && !s.getWebhookSecretEncrypted().isBlank());
        dto.setMrOpenedStatus(s.getMrOpenedStatus());
        dto.setMrMergedStatus(s.getMrMergedStatus());
        dto.setPushStatus(s.getPushStatus());
        return dto;
    }
}
```

- [ ] **Step 3: Derle ve commit**

```bash
git add Backend/src/main/java/com/tora/dto/GitSettingsDTO.java Backend/src/main/java/com/tora/dto/UpdateGitSettingsRequest.java Backend/src/main/java/com/tora/service/GitSettingsService.java
git commit -m "feat(git): GitSettings DTOs + service (encrypted secret)"
```

---

### Task 4: GitSettingsController (admin CRUD)

**Files:**
- Create: `Backend/src/main/java/com/tora/controller/GitSettingsController.java`

**Interfaces:**
- Consumes: `GitSettingsService` (Task 3).
- Produces: `GET /api/admin/git/settings`, `PUT /api/admin/git/settings` — her ikisi `ADMIN`.

- [ ] **Step 1: Controller yaz**

```java
package com.tora.controller;

import com.tora.dto.GitSettingsDTO;
import com.tora.dto.UpdateGitSettingsRequest;
import com.tora.service.GitSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/git/settings")
@PreAuthorize("hasAnyRole('ADMIN')")
public class GitSettingsController {

    private final GitSettingsService service;

    public GitSettingsController(GitSettingsService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<GitSettingsDTO> get() {
        return ResponseEntity.ok(service.getSettings());
    }

    @PutMapping
    public ResponseEntity<GitSettingsDTO> update(@RequestBody UpdateGitSettingsRequest request) {
        return ResponseEntity.ok(service.updateSettings(request));
    }
}
```

- [ ] **Step 2: Derle ve commit**

```bash
git add Backend/src/main/java/com/tora/controller/GitSettingsController.java
git commit -m "feat(git): admin git settings controller"
```

---

### Task 5: GitEvent ortak model + enum'lar

**Files:**
- Create: `Backend/src/main/java/com/tora/git/GitEventType.java`
- Create: `Backend/src/main/java/com/tora/git/GitRef.java`
- Create: `Backend/src/main/java/com/tora/git/GitEvent.java`

**Interfaces:**
- Produces:
  - `enum GitEventType { PUSH, MR_OPENED, MR_MERGED, MR_CLOSED }`
  - `GitRef` (record): `String linkType` ("COMMIT"|"MR"), `String externalId`, `String url`, `String title`, `String status` (MR: OPENED/MERGED/CLOSED; commit: null), `String branch`, `String author`.
  - `GitEvent` (record): `String platform`, `GitEventType type`, `List<String> codeTexts`, `List<GitRef> refs`.

- [ ] **Step 1: Enum + record'ları yaz**

`GitEventType.java`:
```java
package com.tora.git;

public enum GitEventType {
    PUSH, MR_OPENED, MR_MERGED, MR_CLOSED
}
```

`GitRef.java`:
```java
package com.tora.git;

public record GitRef(
    String linkType,
    String externalId,
    String url,
    String title,
    String status,
    String branch,
    String author
) {}
```

`GitEvent.java`:
```java
package com.tora.git;

import java.util.List;

public record GitEvent(
    String platform,
    GitEventType type,
    List<String> codeTexts,
    List<GitRef> refs
) {}
```

- [ ] **Step 2: Derle ve commit**

```bash
git add Backend/src/main/java/com/tora/git/
git commit -m "feat(git): GitEvent common model + enums"
```

---

### Task 6: GitWebhookParser arayüzü + HMAC yardımcısı

**Files:**
- Create: `Backend/src/main/java/com/tora/git/GitWebhookParser.java`
- Create: `Backend/src/main/java/com/tora/git/HmacUtil.java`
- Create: `Backend/src/test/java/com/tora/git/HmacUtilTest.java`

**Interfaces:**
- Produces:
  - `interface GitWebhookParser`: `String platform()`, `boolean verify(Map<String,String> headers, byte[] rawBody, String secret)`, `Optional<GitEvent> parse(Map<String,String> headers, String body)`.
  - `HmacUtil.hmacSha256Hex(byte[] data, String secret)` → lowercase hex string; `HmacUtil.constantTimeEquals(String a, String b)` → boolean.

> **Not:** Header'lar controller'da **lowercase key** ile map'lenecek (Task 12). Parser'lar header'ları lowercase okur.

- [ ] **Step 1: HmacUtil testini yaz (önce başarısız olacak)**

`HmacUtilTest.java`:
```java
package com.tora.git;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HmacUtilTest {

    @Test
    void hmacSha256_knownVector() {
        // RFC-bilinmeyen ama deterministik: aynı girdi aynı çıktı
        String h1 = HmacUtil.hmacSha256Hex("hello".getBytes(), "secret");
        String h2 = HmacUtil.hmacSha256Hex("hello".getBytes(), "secret");
        assertEquals(h1, h2);
        assertEquals(64, h1.length());
        assertNotEquals(h1, HmacUtil.hmacSha256Hex("hello".getBytes(), "other"));
    }

    @Test
    void constantTimeEquals_works() {
        assertTrue(HmacUtil.constantTimeEquals("abc", "abc"));
        assertFalse(HmacUtil.constantTimeEquals("abc", "abd"));
        assertFalse(HmacUtil.constantTimeEquals("abc", null));
        assertFalse(HmacUtil.constantTimeEquals(null, "abc"));
    }
}
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `mvn -Dtest=HmacUtilTest test`
Expected: FAIL (HmacUtil yok / derlenmiyor).

- [ ] **Step 3: HmacUtil + arayüzü yaz**

`HmacUtil.java`:
```java
package com.tora.git;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

public final class HmacUtil {

    private HmacUtil() {}

    public static String hmacSha256Hex(byte[] data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(data);
            StringBuilder sb = new StringBuilder(raw.length * 2);
            for (byte b : raw) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC hesaplanamadı", e);
        }
    }

    public static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] x = a.getBytes(StandardCharsets.UTF_8);
        byte[] y = b.getBytes(StandardCharsets.UTF_8);
        if (x.length != y.length) return false;
        int r = 0;
        for (int i = 0; i < x.length; i++) r |= x[i] ^ y[i];
        return r == 0;
    }
}
```

`GitWebhookParser.java`:
```java
package com.tora.git;

import java.util.Map;
import java.util.Optional;

public interface GitWebhookParser {
    String platform();
    boolean verify(Map<String, String> headers, byte[] rawBody, String secret);
    Optional<GitEvent> parse(Map<String, String> headers, String body);
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `mvn -Dtest=HmacUtilTest test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/main/java/com/tora/git/GitWebhookParser.java Backend/src/main/java/com/tora/git/HmacUtil.java Backend/src/test/java/com/tora/git/HmacUtilTest.java
git commit -m "feat(git): parser interface + HMAC util (tested)"
```

---

### Task 7: GithubWebhookParser (+ test)

**Files:**
- Create: `Backend/src/main/java/com/tora/git/GithubWebhookParser.java`
- Create: `Backend/src/test/java/com/tora/git/GithubWebhookParserTest.java`

**Interfaces:**
- Consumes: `GitWebhookParser`, `GitEvent`, `GitRef`, `GitEventType`, `HmacUtil`, Jackson `ObjectMapper`.
- Produces: `@Component GithubWebhookParser implements GitWebhookParser` — `platform()="github"`.
  - `verify`: header `x-hub-signature-256` = `"sha256=" + HmacUtil.hmacSha256Hex(rawBody, secret)`.
  - `parse`: `x-github-event` header → `push` veya `pull_request`. Push: commit'ler → COMMIT ref'ler, codeTexts = commit mesajları + `ref` (branch). PR: action `opened`→MR_OPENED, `closed`+`merged=true`→MR_MERGED, `closed`+`merged=false`→MR_CLOSED; ref = MR (externalId=`number`), codeTexts = title + body + head.ref (branch).

- [ ] **Step 1: Test yaz (önce başarısız)**

`GithubWebhookParserTest.java`:
```java
package com.tora.git;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;

class GithubWebhookParserTest {

    private final GithubWebhookParser parser = new GithubWebhookParser(new ObjectMapper());

    @Test
    void verify_validSignature() {
        byte[] body = "{\"a\":1}".getBytes();
        String sig = "sha256=" + HmacUtil.hmacSha256Hex(body, "s3cr3t");
        assertTrue(parser.verify(Map.of("x-hub-signature-256", sig), body, "s3cr3t"));
        assertFalse(parser.verify(Map.of("x-hub-signature-256", "sha256=deadbeef"), body, "s3cr3t"));
        assertFalse(parser.verify(Map.of(), body, "s3cr3t"));
    }

    @Test
    void parse_push_extractsCommitsAndMessages() {
        String body = """
            {"ref":"refs/heads/feature/TORA-12",
             "commits":[
               {"id":"abc123","message":"TORA-12 fix login","url":"http://gh/c/abc123","author":{"name":"Ada"}}
             ]}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-github-event", "push"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.PUSH, ev.get().type());
        assertEquals("github", ev.get().platform());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-12")));
        assertEquals(1, ev.get().refs().size());
        GitRef ref = ev.get().refs().get(0);
        assertEquals("COMMIT", ref.linkType());
        assertEquals("abc123", ref.externalId());
        assertEquals("Ada", ref.author());
    }

    @Test
    void parse_pullRequestMerged() {
        String body = """
            {"action":"closed",
             "pull_request":{"number":7,"title":"TORA-99 add panel","body":"closes TORA-99",
               "html_url":"http://gh/pr/7","merged":true,
               "head":{"ref":"feature/x"},"user":{"login":"bob"}}}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-github-event", "pull_request"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.MR_MERGED, ev.get().type());
        GitRef ref = ev.get().refs().get(0);
        assertEquals("MR", ref.linkType());
        assertEquals("7", ref.externalId());
        assertEquals("MERGED", ref.status());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-99")));
    }

    @Test
    void parse_unknownEvent_empty() {
        assertTrue(parser.parse(Map.of("x-github-event", "issues"), "{}").isEmpty());
    }
}
```

- [ ] **Step 2: Testi çalıştır, başarısız gör**

Run: `mvn -Dtest=GithubWebhookParserTest test`
Expected: FAIL (parser yok).

- [ ] **Step 3: Parser yaz**

```java
package com.tora.git;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class GithubWebhookParser implements GitWebhookParser {

    private final ObjectMapper mapper;

    public GithubWebhookParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public String platform() {
        return "github";
    }

    @Override
    public boolean verify(Map<String, String> headers, byte[] rawBody, String secret) {
        String header = headers.get("x-hub-signature-256");
        if (header == null) return false;
        String expected = "sha256=" + HmacUtil.hmacSha256Hex(rawBody, secret);
        return HmacUtil.constantTimeEquals(header, expected);
    }

    @Override
    public Optional<GitEvent> parse(Map<String, String> headers, String body) {
        try {
            String event = headers.getOrDefault("x-github-event", "");
            JsonNode root = mapper.readTree(body);
            if ("push".equals(event)) return parsePush(root);
            if ("pull_request".equals(event)) return parsePullRequest(root);
            return Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<GitEvent> parsePush(JsonNode root) {
        List<String> texts = new ArrayList<>();
        List<GitRef> refs = new ArrayList<>();
        String branch = stripRef(root.path("ref").asText(""));
        if (!branch.isBlank()) texts.add(branch);
        for (JsonNode c : root.path("commits")) {
            String msg = c.path("message").asText("");
            texts.add(msg);
            refs.add(new GitRef("COMMIT",
                c.path("id").asText(""),
                c.path("url").asText(""),
                firstLine(msg),
                null, branch,
                c.path("author").path("name").asText("")));
        }
        return Optional.of(new GitEvent("github", GitEventType.PUSH, texts, refs));
    }

    private Optional<GitEvent> parsePullRequest(JsonNode root) {
        String action = root.path("action").asText("");
        JsonNode pr = root.path("pull_request");
        GitEventType type;
        String status;
        if ("opened".equals(action) || "reopened".equals(action)) {
            type = GitEventType.MR_OPENED; status = "OPENED";
        } else if ("closed".equals(action) && pr.path("merged").asBoolean(false)) {
            type = GitEventType.MR_MERGED; status = "MERGED";
        } else if ("closed".equals(action)) {
            type = GitEventType.MR_CLOSED; status = "CLOSED";
        } else {
            return Optional.empty();
        }
        String branch = pr.path("head").path("ref").asText("");
        List<String> texts = List.of(
            pr.path("title").asText(""),
            pr.path("body").asText(""),
            branch);
        GitRef ref = new GitRef("MR",
            pr.path("number").asText(""),
            pr.path("html_url").asText(""),
            pr.path("title").asText(""),
            status, branch,
            pr.path("user").path("login").asText(""));
        return Optional.of(new GitEvent("github", type, texts, List.of(ref)));
    }

    private String stripRef(String ref) {
        return ref.startsWith("refs/heads/") ? ref.substring("refs/heads/".length()) : ref;
    }

    private String firstLine(String s) {
        int nl = s.indexOf('\n');
        return nl >= 0 ? s.substring(0, nl) : s;
    }
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `mvn -Dtest=GithubWebhookParserTest test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/main/java/com/tora/git/GithubWebhookParser.java Backend/src/test/java/com/tora/git/GithubWebhookParserTest.java
git commit -m "feat(git): GitHub webhook parser (tested)"
```

---

### Task 8: GitlabWebhookParser (+ test)

**Files:**
- Create: `Backend/src/main/java/com/tora/git/GitlabWebhookParser.java`
- Create: `Backend/src/test/java/com/tora/git/GitlabWebhookParserTest.java`

**Interfaces:**
- Produces: `@Component GitlabWebhookParser` — `platform()="gitlab"`.
  - `verify`: header `x-gitlab-token` eşitliği (`HmacUtil.constantTimeEquals(token, secret)`).
  - `parse`: `x-gitlab-event` → `Push Hook` veya `Merge Request Hook`. Push: `commits[]`, branch = `ref` strip. MR: `object_attributes.action` (`open`/`reopen`→MR_OPENED, `merge`→MR_MERGED, `close`→MR_CLOSED), externalId = `object_attributes.iid`, codeTexts = title+description+source_branch.

- [ ] **Step 1: Test yaz**

`GitlabWebhookParserTest.java`:
```java
package com.tora.git;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;

class GitlabWebhookParserTest {

    private final GitlabWebhookParser parser = new GitlabWebhookParser(new ObjectMapper());

    @Test
    void verify_tokenEquality() {
        assertTrue(parser.verify(Map.of("x-gitlab-token", "tok"), new byte[0], "tok"));
        assertFalse(parser.verify(Map.of("x-gitlab-token", "nope"), new byte[0], "tok"));
        assertFalse(parser.verify(Map.of(), new byte[0], "tok"));
    }

    @Test
    void parse_push() {
        String body = """
            {"ref":"refs/heads/TORA-5",
             "commits":[{"id":"sha1","message":"TORA-5 wip","url":"http://gl/c/sha1","author":{"name":"Lia"}}]}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitlab-event", "Push Hook"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.PUSH, ev.get().type());
        assertEquals("sha1", ev.get().refs().get(0).externalId());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-5")));
    }

    @Test
    void parse_mergeRequestMerged() {
        String body = """
            {"object_attributes":{"iid":42,"action":"merge","title":"TORA-7 done",
              "description":"x","url":"http://gl/mr/42","source_branch":"feat","state":"merged"},
             "user":{"username":"lia"}}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitlab-event", "Merge Request Hook"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.MR_MERGED, ev.get().type());
        GitRef ref = ev.get().refs().get(0);
        assertEquals("MR", ref.linkType());
        assertEquals("42", ref.externalId());
        assertEquals("MERGED", ref.status());
    }

    @Test
    void parse_unknown_empty() {
        assertTrue(parser.parse(Map.of("x-gitlab-event", "Note Hook"), "{}").isEmpty());
    }
}
```

- [ ] **Step 2: Testi çalıştır, başarısız gör**

Run: `mvn -Dtest=GitlabWebhookParserTest test`
Expected: FAIL.

- [ ] **Step 3: Parser yaz**

```java
package com.tora.git;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class GitlabWebhookParser implements GitWebhookParser {

    private final ObjectMapper mapper;

    public GitlabWebhookParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public String platform() {
        return "gitlab";
    }

    @Override
    public boolean verify(Map<String, String> headers, byte[] rawBody, String secret) {
        return HmacUtil.constantTimeEquals(headers.get("x-gitlab-token"), secret);
    }

    @Override
    public Optional<GitEvent> parse(Map<String, String> headers, String body) {
        try {
            String event = headers.getOrDefault("x-gitlab-event", "");
            JsonNode root = mapper.readTree(body);
            if ("Push Hook".equals(event)) return parsePush(root);
            if ("Merge Request Hook".equals(event)) return parseMr(root);
            return Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<GitEvent> parsePush(JsonNode root) {
        List<String> texts = new ArrayList<>();
        List<GitRef> refs = new ArrayList<>();
        String branch = stripRef(root.path("ref").asText(""));
        if (!branch.isBlank()) texts.add(branch);
        for (JsonNode c : root.path("commits")) {
            String msg = c.path("message").asText("");
            texts.add(msg);
            refs.add(new GitRef("COMMIT",
                c.path("id").asText(""),
                c.path("url").asText(""),
                firstLine(msg),
                null, branch,
                c.path("author").path("name").asText("")));
        }
        return Optional.of(new GitEvent("gitlab", GitEventType.PUSH, texts, refs));
    }

    private Optional<GitEvent> parseMr(JsonNode root) {
        JsonNode oa = root.path("object_attributes");
        String action = oa.path("action").asText("");
        GitEventType type;
        String status;
        switch (action) {
            case "open", "reopen" -> { type = GitEventType.MR_OPENED; status = "OPENED"; }
            case "merge" -> { type = GitEventType.MR_MERGED; status = "MERGED"; }
            case "close" -> { type = GitEventType.MR_CLOSED; status = "CLOSED"; }
            default -> { return Optional.empty(); }
        }
        String branch = oa.path("source_branch").asText("");
        List<String> texts = List.of(
            oa.path("title").asText(""),
            oa.path("description").asText(""),
            branch);
        GitRef ref = new GitRef("MR",
            oa.path("iid").asText(""),
            oa.path("url").asText(""),
            oa.path("title").asText(""),
            status, branch,
            root.path("user").path("username").asText(""));
        return Optional.of(new GitEvent("gitlab", type, texts, List.of(ref)));
    }

    private String stripRef(String ref) {
        return ref.startsWith("refs/heads/") ? ref.substring("refs/heads/".length()) : ref;
    }

    private String firstLine(String s) {
        int nl = s.indexOf('\n');
        return nl >= 0 ? s.substring(0, nl) : s;
    }
}
```

- [ ] **Step 4: Testi çalıştır, geç**

Run: `mvn -Dtest=GitlabWebhookParserTest test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/main/java/com/tora/git/GitlabWebhookParser.java Backend/src/test/java/com/tora/git/GitlabWebhookParserTest.java
git commit -m "feat(git): GitLab webhook parser (tested)"
```

---

### Task 9: GiteaWebhookParser (+ test)

**Files:**
- Create: `Backend/src/main/java/com/tora/git/GiteaWebhookParser.java`
- Create: `Backend/src/test/java/com/tora/git/GiteaWebhookParserTest.java`

**Interfaces:**
- Produces: `@Component GiteaWebhookParser` — `platform()="gitea"`.
  - `verify`: header `x-gitea-signature` = `HmacUtil.hmacSha256Hex(rawBody, secret)` (prefix yok, sadece hex).
  - `parse`: `x-gitea-event` → `push` (GitHub'a benzer payload: `commits[]`, `ref`) veya `pull_request` (`action`: `opened`→MR_OPENED, `closed`+`pull_request.merged=true`→MR_MERGED, `closed`→MR_CLOSED; externalId = `number`).

- [ ] **Step 1: Test yaz**

`GiteaWebhookParserTest.java`:
```java
package com.tora.git;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;

class GiteaWebhookParserTest {

    private final GiteaWebhookParser parser = new GiteaWebhookParser(new ObjectMapper());

    @Test
    void verify_hexSignature() {
        byte[] body = "{\"a\":1}".getBytes();
        String sig = HmacUtil.hmacSha256Hex(body, "k");
        assertTrue(parser.verify(Map.of("x-gitea-signature", sig), body, "k"));
        assertFalse(parser.verify(Map.of("x-gitea-signature", "00"), body, "k"));
    }

    @Test
    void parse_push() {
        String body = """
            {"ref":"refs/heads/TORA-3",
             "commits":[{"id":"c1","message":"TORA-3 init","url":"http://gt/c1","author":{"name":"Mo"}}]}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitea-event", "push"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.PUSH, ev.get().type());
        assertEquals("c1", ev.get().refs().get(0).externalId());
    }

    @Test
    void parse_pullRequestOpened() {
        String body = """
            {"action":"opened",
             "number":3,
             "pull_request":{"title":"TORA-8 x","body":"b","html_url":"http://gt/pr/3",
               "merged":false,"head":{"ref":"feat"},"user":{"login":"mo"}}}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitea-event", "pull_request"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.MR_OPENED, ev.get().type());
        assertEquals("3", ev.get().refs().get(0).externalId());
        assertEquals("OPENED", ev.get().refs().get(0).status());
    }
}
```

- [ ] **Step 2: Testi çalıştır, başarısız gör**

Run: `mvn -Dtest=GiteaWebhookParserTest test`
Expected: FAIL.

- [ ] **Step 3: Parser yaz**

```java
package com.tora.git;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class GiteaWebhookParser implements GitWebhookParser {

    private final ObjectMapper mapper;

    public GiteaWebhookParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public String platform() {
        return "gitea";
    }

    @Override
    public boolean verify(Map<String, String> headers, byte[] rawBody, String secret) {
        String header = headers.get("x-gitea-signature");
        if (header == null) return false;
        return HmacUtil.constantTimeEquals(header, HmacUtil.hmacSha256Hex(rawBody, secret));
    }

    @Override
    public Optional<GitEvent> parse(Map<String, String> headers, String body) {
        try {
            String event = headers.getOrDefault("x-gitea-event", "");
            JsonNode root = mapper.readTree(body);
            if ("push".equals(event)) return parsePush(root);
            if ("pull_request".equals(event)) return parsePullRequest(root);
            return Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<GitEvent> parsePush(JsonNode root) {
        List<String> texts = new ArrayList<>();
        List<GitRef> refs = new ArrayList<>();
        String branch = stripRef(root.path("ref").asText(""));
        if (!branch.isBlank()) texts.add(branch);
        for (JsonNode c : root.path("commits")) {
            String msg = c.path("message").asText("");
            texts.add(msg);
            refs.add(new GitRef("COMMIT",
                c.path("id").asText(""),
                c.path("url").asText(""),
                firstLine(msg),
                null, branch,
                c.path("author").path("name").asText("")));
        }
        return Optional.of(new GitEvent("gitea", GitEventType.PUSH, texts, refs));
    }

    private Optional<GitEvent> parsePullRequest(JsonNode root) {
        String action = root.path("action").asText("");
        JsonNode pr = root.path("pull_request");
        GitEventType type;
        String status;
        if ("opened".equals(action) || "reopened".equals(action)) {
            type = GitEventType.MR_OPENED; status = "OPENED";
        } else if ("closed".equals(action) && pr.path("merged").asBoolean(false)) {
            type = GitEventType.MR_MERGED; status = "MERGED";
        } else if ("closed".equals(action)) {
            type = GitEventType.MR_CLOSED; status = "CLOSED";
        } else {
            return Optional.empty();
        }
        String branch = pr.path("head").path("ref").asText("");
        List<String> texts = List.of(
            pr.path("title").asText(""),
            pr.path("body").asText(""),
            branch);
        GitRef ref = new GitRef("MR",
            root.path("number").asText(pr.path("number").asText("")),
            pr.path("html_url").asText(""),
            pr.path("title").asText(""),
            status, branch,
            pr.path("user").path("login").asText(""));
        return Optional.of(new GitEvent("gitea", type, texts, List.of(ref)));
    }

    private String stripRef(String ref) {
        return ref.startsWith("refs/heads/") ? ref.substring("refs/heads/".length()) : ref;
    }

    private String firstLine(String s) {
        int nl = s.indexOf('\n');
        return nl >= 0 ? s.substring(0, nl) : s;
    }
}
```

- [ ] **Step 4: Testi çalıştır, geç**

Run: `mvn -Dtest=GiteaWebhookParserTest test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/main/java/com/tora/git/GiteaWebhookParser.java Backend/src/test/java/com/tora/git/GiteaWebhookParserTest.java
git commit -m "feat(git): Gitea webhook parser (tested)"
```

---

### Task 10: TaskGitLink entity + repository + DTO

**Files:**
- Create: `Backend/src/main/java/com/tora/model/TaskGitLink.java`
- Create: `Backend/src/main/java/com/tora/repository/TaskGitLinkRepository.java`
- Create: `Backend/src/main/java/com/tora/dto/TaskGitLinkDTO.java`

**Interfaces:**
- Consumes: `Task` model.
- Produces:
  - `TaskGitLink` (`@Data`): `Task task`, `String platform`, `String linkType`, `String externalId`, `String url`, `String title`, `String status`, `String branch`, `String author`.
  - `TaskGitLinkRepository`: `Optional<TaskGitLink> findByTask_IdAndPlatformAndLinkTypeAndExternalId(Long taskId, String platform, String linkType, String externalId)`, `List<TaskGitLink> findByTask_IdOrderByCreatedAtDesc(Long taskId)`.
  - `TaskGitLinkDTO` (`@Data`): `Long id`, `String platform`, `String linkType`, `String externalId`, `String url`, `String title`, `String status`, `String branch`, `String author`.

- [ ] **Step 1: Entity yaz**

```java
package com.tora.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "task_git_links")
@Data
public class TaskGitLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @Column(nullable = false, length = 20)
    private String platform;

    @Column(name = "link_type", nullable = false, length = 20)
    private String linkType;

    @Column(name = "external_id", nullable = false, length = 255)
    private String externalId;

    @Column(length = 1000)
    private String url;

    @Column(length = 500)
    private String title;

    @Column(length = 30)
    private String status;

    @Column(length = 255)
    private String branch;

    @Column(length = 255)
    private String author;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 2: Repository yaz**

```java
package com.tora.repository;

import com.tora.model.TaskGitLink;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TaskGitLinkRepository extends JpaRepository<TaskGitLink, Long> {
    Optional<TaskGitLink> findByTask_IdAndPlatformAndLinkTypeAndExternalId(
        Long taskId, String platform, String linkType, String externalId);
    List<TaskGitLink> findByTask_IdOrderByCreatedAtDesc(Long taskId);
}
```

- [ ] **Step 3: DTO yaz**

```java
package com.tora.dto;

import lombok.Data;

@Data
public class TaskGitLinkDTO {
    private Long id;
    private String platform;
    private String linkType;
    private String externalId;
    private String url;
    private String title;
    private String status;
    private String branch;
    private String author;
}
```

- [ ] **Step 4: Derle ve commit**

```bash
git add Backend/src/main/java/com/tora/model/TaskGitLink.java Backend/src/main/java/com/tora/repository/TaskGitLinkRepository.java Backend/src/main/java/com/tora/dto/TaskGitLinkDTO.java
git commit -m "feat(git): TaskGitLink entity + repository + DTO"
```

---

### Task 11: GitWebhookService — çekirdek (kod çıkarma + linkleme + durum senkronu) + test

**Files:**
- Create: `Backend/src/main/java/com/tora/service/GitWebhookService.java`
- Create: `Backend/src/test/java/com/tora/service/GitWebhookServiceTest.java`

**Interfaces:**
- Consumes: `GitSettingsService` (`getActiveSettings`, `getDecryptedSecret`), `List<GitWebhookParser>` (Spring otomatik enjekte eder — platform→parser map'i kurar), `TaskRepository` (`Optional<Task> findByCode(String)` — **Task 11a'da eklenir**), `TaskGitLinkRepository`, `UserRepository` (`Optional<User> findByUsername(String)`), `TaskService.updateTaskStatusAsSystem(Long taskId, TaskStatus status, User actor)` — **bu metot Task 11b'de TaskService'e eklenir** (mevcut `updateTaskStatus` SecurityContext'ten `getCurrentUser()` çeker + ekip erişim kontrolü yapar → webhook'ta SecurityContext yok, sistem kullanıcısının ekip erişimi yok; bu yüzden erişim kontrolünü atlayan, aktörü explicit alan ayrı metot gerekir).
- `TaskStatus` enum'ı: `com.tora.model.enums.TaskStatus` — değerler **OPEN, IN_PROGRESS, COMPLETED, CANCELLED**.
- Produces:
  - `WebhookResult process(String platform, Map<String,String> headers, byte[] rawBody)` →
    `enum WebhookOutcome { DISABLED, UNKNOWN_PLATFORM, INVALID_SIGNATURE, IGNORED, PROCESSED }`; `record WebhookResult(WebhookOutcome outcome, int linkedCount)`.
  - `static List<String> extractCodes(Collection<String> texts)` — `TORA-\d+` (case-insensitive), normalize uppercase, distinct.

> **Durum senkronu kararı:** `GitEventType` → ayardaki status string'i: MR_OPENED→`mrOpenedStatus`, MR_MERGED→`mrMergedStatus`, MR_CLOSED→değiştirme yok, PUSH→`pushStatus`. String boş/null → no-op. String'i `TaskStatus.valueOf` ile çevir; geçersizse no-op (uyarı log). Durum değişimi **sistem kullanıcısı** (`git-otomasyonu`) adına `taskService.updateTaskStatusAsSystem(...)` ile yapılır — bu metot COMPLETED'e geçişte `publishIfCompleted` ile `TaskCompletedEvent` yayınladığından zincir tetikleyici otomatik çalışır (servis ayrıca event publish ETMEZ — çift tetikleme olur).

- [ ] **Step 1: Test yaz (Mockito, DB'siz)**

`GitWebhookServiceTest.java`:
```java
package com.tora.service;

import com.tora.git.*;
import com.tora.model.Task;
import com.tora.model.TaskGitLink;
import com.tora.model.User;
import com.tora.model.GitSettings;
import com.tora.repository.TaskGitLinkRepository;
import com.tora.repository.TaskRepository;
import com.tora.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GitWebhookServiceTest {

    @Test
    void extractCodes_findsMultipleCaseInsensitiveDistinct() {
        List<String> codes = GitWebhookService.extractCodes(List.of(
            "fix TORA-12 and tora-12", "ref TORA-99", "no code here"));
        assertTrue(codes.contains("TORA-12"));
        assertTrue(codes.contains("TORA-99"));
        assertEquals(2, codes.size());
    }

    @Test
    void process_disabled_returnsDisabled() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(false);
        when(settings.getActiveSettings()).thenReturn(gs);

        GitWebhookService svc = new GitWebhookService(
            settings, List.of(), mock(TaskRepository.class),
            mock(TaskGitLinkRepository.class), mock(UserRepository.class),
            mock(TaskService.class));

        var result = svc.process("github", Map.of(), new byte[0]);
        assertEquals(GitWebhookService.WebhookOutcome.DISABLED, result.outcome());
    }

    @Test
    void process_invalidSignature_returns401Outcome() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(true);
        when(settings.getActiveSettings()).thenReturn(gs);
        when(settings.getDecryptedSecret()).thenReturn("s");

        GitWebhookParser parser = mock(GitWebhookParser.class);
        when(parser.platform()).thenReturn("github");
        when(parser.verify(any(), any(), eq("s"))).thenReturn(false);

        GitWebhookService svc = new GitWebhookService(
            settings, List.of(parser), mock(TaskRepository.class),
            mock(TaskGitLinkRepository.class), mock(UserRepository.class),
            mock(TaskService.class));

        var result = svc.process("github", Map.of(), new byte[0]);
        assertEquals(GitWebhookService.WebhookOutcome.INVALID_SIGNATURE, result.outcome());
    }

    @Test
    void process_linksCommitToMatchedTask() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(true);
        when(settings.getActiveSettings()).thenReturn(gs);
        when(settings.getDecryptedSecret()).thenReturn("s");

        GitWebhookParser parser = mock(GitWebhookParser.class);
        when(parser.platform()).thenReturn("github");
        when(parser.verify(any(), any(), eq("s"))).thenReturn(true);
        GitRef ref = new GitRef("COMMIT", "abc", "http://x", "TORA-12 fix", null, "feat", "Ada");
        when(parser.parse(any(), any())).thenReturn(Optional.of(
            new GitEvent("github", GitEventType.PUSH, List.of("TORA-12 fix"), List.of(ref))));

        Task task = new Task();
        task.setId(5L);
        TaskRepository taskRepo = mock(TaskRepository.class);
        when(taskRepo.findByCode("TORA-12")).thenReturn(Optional.of(task));

        TaskGitLinkRepository linkRepo = mock(TaskGitLinkRepository.class);
        when(linkRepo.findByTask_IdAndPlatformAndLinkTypeAndExternalId(5L, "github", "COMMIT", "abc"))
            .thenReturn(Optional.empty());

        UserRepository userRepo = mock(UserRepository.class);
        when(userRepo.findByUsername("git-otomasyonu")).thenReturn(Optional.of(new User()));

        GitWebhookService svc = new GitWebhookService(
            settings, List.of(parser), taskRepo, linkRepo, userRepo, mock(TaskService.class));

        var result = svc.process("github", Map.of(), "{}".getBytes());
        assertEquals(GitWebhookService.WebhookOutcome.PROCESSED, result.outcome());
        assertEquals(1, result.linkedCount());
        verify(linkRepo).save(any(TaskGitLink.class));
    }
}
```

- [ ] **Step 2: Testi çalıştır, başarısız gör**

Run: `mvn -Dtest=GitWebhookServiceTest test`
Expected: FAIL (servis yok).

- [ ] **Step 3: TaskRepository.findByCode'u ekle (Task 11a)**

`Backend/src/main/java/com/tora/repository/TaskRepository.java` içine:
```java
java.util.Optional<com.tora.model.Task> findByCode(String code);
```
> `Task.code` alanı zaten mevcut (iş kodu özelliği). Import zaten varsa kısa imza kullan.

- [ ] **Step 3b: TaskService'e sistem-aktörlü durum değişim metodu ekle (Task 11b)**

`Backend/src/main/java/com/tora/service/TaskService.java` içinde, mevcut `updateTaskStatus(...)` metodunun hemen ardına ekle. Bu metot SecurityContext'e dokunmaz, erişim kontrolü yapmaz (aktör explicit) ama loglar/SLA/bildirim/zincir event'ini `updateTaskStatus` ile aynı şekilde işler:

```java
    // Webhook/sistem kaynaklı durum değişimi: SecurityContext yok, erişim kontrolü atlanır (aktör explicit verilir).
    @Transactional
    public void updateTaskStatusAsSystem(Long id, TaskStatus newStatus, User actor) {
        Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));
        TaskStatus oldStatus = task.getStatus();
        if (oldStatus == newStatus) return;

        TaskStatusHistory history = new TaskStatusHistory();
        history.setTask(task);
        history.setOldStatus(oldStatus.name());
        history.setNewStatus(newStatus.name());
        history.setChangedBy(actor);
        history.setChangeReason("Git webhook");

        task.setStatus(newStatus);
        task = taskRepository.save(task);
        statusHistoryRepository.save(history);
        slaService.recalculate(task);
        taskLogService.logTaskAction(task, "STATUS_CHANGED", actor, "Git webhook",
            oldStatus.name(), newStatus.name());
        notificationService.notifyTaskStatusChanged(task, oldStatus.name(), newStatus.name(), actor);
        publishIfCompleted(oldStatus, task, actor);
        evictDashboardCache(task.getTeam().getId());
    }
```
> `publishIfCompleted` ve `evictDashboardCache` aynı sınıfta private — doğrudan erişilir. `statusHistoryRepository`, `slaService`, `taskLogService`, `notificationService` alanları mevcut (updateTaskStatus aynılarını kullanıyor).

- [ ] **Step 4: Servisi yaz**

```java
package com.tora.service;

import com.tora.git.GitEvent;
import com.tora.git.GitEventType;
import com.tora.git.GitRef;
import com.tora.git.GitWebhookParser;
import com.tora.model.GitSettings;
import com.tora.model.Task;
import com.tora.model.TaskGitLink;
import com.tora.model.enums.TaskStatus;
import com.tora.model.User;
import com.tora.repository.TaskGitLinkRepository;
import com.tora.repository.TaskRepository;
import com.tora.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GitWebhookService {

    private static final Logger log = LoggerFactory.getLogger(GitWebhookService.class);
    private static final Pattern CODE_PATTERN = Pattern.compile("TORA-\\d+", Pattern.CASE_INSENSITIVE);
    private static final String SYSTEM_USERNAME = "git-otomasyonu";

    public enum WebhookOutcome { DISABLED, UNKNOWN_PLATFORM, INVALID_SIGNATURE, IGNORED, PROCESSED }
    public record WebhookResult(WebhookOutcome outcome, int linkedCount) {}

    private final GitSettingsService gitSettingsService;
    private final Map<String, GitWebhookParser> parsers = new HashMap<>();
    private final TaskRepository taskRepository;
    private final TaskGitLinkRepository linkRepository;
    private final UserRepository userRepository;
    private final TaskService taskService;

    public GitWebhookService(GitSettingsService gitSettingsService,
                             List<GitWebhookParser> parserList,
                             TaskRepository taskRepository,
                             TaskGitLinkRepository linkRepository,
                             UserRepository userRepository,
                             TaskService taskService) {
        this.gitSettingsService = gitSettingsService;
        this.taskRepository = taskRepository;
        this.linkRepository = linkRepository;
        this.userRepository = userRepository;
        this.taskService = taskService;
        for (GitWebhookParser p : parserList) {
            this.parsers.put(p.platform(), p);
        }
    }

    @Transactional
    public WebhookResult process(String platform, Map<String, String> headers, byte[] rawBody) {
        GitSettings settings = gitSettingsService.getActiveSettings();
        if (!Boolean.TRUE.equals(settings.getIsEnabled())) {
            return new WebhookResult(WebhookOutcome.DISABLED, 0);
        }
        GitWebhookParser parser = parsers.get(platform);
        if (parser == null) {
            return new WebhookResult(WebhookOutcome.UNKNOWN_PLATFORM, 0);
        }
        String secret = gitSettingsService.getDecryptedSecret();
        if (secret == null || !parser.verify(headers, rawBody, secret)) {
            return new WebhookResult(WebhookOutcome.INVALID_SIGNATURE, 0);
        }
        Optional<GitEvent> parsed = parser.parse(headers, new String(rawBody, java.nio.charset.StandardCharsets.UTF_8));
        if (parsed.isEmpty()) {
            return new WebhookResult(WebhookOutcome.IGNORED, 0);
        }
        GitEvent event = parsed.get();
        List<String> codes = extractCodes(event.codeTexts());
        if (codes.isEmpty()) {
            return new WebhookResult(WebhookOutcome.IGNORED, 0);
        }

        int linked = 0;
        List<Task> matchedTasks = new ArrayList<>();
        for (String code : codes) {
            Optional<Task> t = taskRepository.findByCode(code);
            if (t.isPresent()) {
                matchedTasks.add(t.get());
            } else {
                log.debug("Git webhook: eşleşen görev yok, kod={}", code);
            }
        }
        if (matchedTasks.isEmpty()) {
            return new WebhookResult(WebhookOutcome.IGNORED, 0);
        }

        for (Task task : matchedTasks) {
            for (GitRef ref : event.refs()) {
                upsertLink(task, event.platform(), ref);
                linked++;
            }
        }
        applyStatusSync(event, settings, matchedTasks);
        return new WebhookResult(WebhookOutcome.PROCESSED, linked);
    }

    private void upsertLink(Task task, String platform, GitRef ref) {
        TaskGitLink link = linkRepository
            .findByTask_IdAndPlatformAndLinkTypeAndExternalId(
                task.getId(), platform, ref.linkType(), ref.externalId())
            .orElseGet(TaskGitLink::new);
        link.setTask(task);
        link.setPlatform(platform);
        link.setLinkType(ref.linkType());
        link.setExternalId(ref.externalId());
        link.setUrl(ref.url());
        link.setTitle(ref.title());
        link.setStatus(ref.status());
        link.setBranch(ref.branch());
        link.setAuthor(ref.author());
        linkRepository.save(link);
    }

    private void applyStatusSync(GitEvent event, GitSettings settings, List<Task> tasks) {
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
            log.warn("Git webhook: geçersiz durum ayarı '{}'", target);
            return;
        }
        User actor = resolveGitActor(event);
        if (actor == null) {
            log.warn("Git webhook: sistem kullanıcısı '{}' bulunamadı, durum senkronu atlandı", SYSTEM_USERNAME);
            return;
        }
        for (Task task : tasks) {
            if (task.getStatus() == newStatus) continue;
            try {
                taskService.updateTaskStatusAsSystem(task.getId(), newStatus, actor);
            } catch (Exception ex) {
                log.warn("Git webhook: görev {} durum senkronu başarısız: {}", task.getId(), ex.getMessage());
            }
        }
    }

    // İleride email-eşleme buraya: event.refs()[].author → User. Şimdilik sistem kullanıcısı.
    private User resolveGitActor(GitEvent event) {
        return userRepository.findByUsername(SYSTEM_USERNAME).orElse(null);
    }

    public static List<String> extractCodes(Collection<String> texts) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (texts == null) return new ArrayList<>();
        for (String t : texts) {
            if (t == null) continue;
            Matcher m = CODE_PATTERN.matcher(t);
            while (m.find()) {
                out.add(m.group().toUpperCase());
            }
        }
        return new ArrayList<>(out);
    }
}
```

> **Doğrulama notu:** `updateTaskStatusAsSystem` Step 3b'de eklendi; bu servis onu çağırır. `TaskStatus` değerleri: **OPEN, IN_PROGRESS, COMPLETED, CANCELLED** (`com.tora.model.enums.TaskStatus`). Admin dropdown'u (Task 17) bu değerleri gösterir.

- [ ] **Step 5: Testi çalıştır, geç**

Run: `mvn -Dtest=GitWebhookServiceTest test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/main/java/com/tora/service/GitWebhookService.java Backend/src/main/java/com/tora/repository/TaskRepository.java Backend/src/test/java/com/tora/service/GitWebhookServiceTest.java
git commit -m "feat(git): webhook service — code extraction, linking, status sync (tested)"
```

---

### Task 12: GitWebhookController (ham gövde)

**Files:**
- Create: `Backend/src/main/java/com/tora/controller/GitWebhookController.java`

**Interfaces:**
- Consumes: `GitWebhookService.process(String, Map<String,String>, byte[])`, `WebhookOutcome`.
- Produces: `POST /api/webhooks/git/{platform}` — `@RequestBody byte[] rawBody` + `HttpServletRequest` (header'ları lowercase map'le). İmza geçersiz → 401, bilinmeyen platform → 404, aksi → 200.

- [ ] **Step 1: Controller yaz**

```java
package com.tora.controller;

import com.tora.service.GitWebhookService;
import com.tora.service.GitWebhookService.WebhookResult;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/webhooks/git")
public class GitWebhookController {

    private final GitWebhookService service;

    public GitWebhookController(GitWebhookService service) {
        this.service = service;
    }

    @PostMapping("/{platform}")
    public ResponseEntity<Map<String, Object>> receive(
            @PathVariable String platform,
            @RequestBody(required = false) byte[] rawBody,
            HttpServletRequest request) {

        Map<String, String> headers = new HashMap<>();
        var names = request.getHeaderNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            headers.put(name.toLowerCase(), request.getHeader(name));
        }

        WebhookResult result = service.process(
            platform, headers, rawBody == null ? new byte[0] : rawBody);

        return switch (result.outcome()) {
            case INVALID_SIGNATURE -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("status", "invalid_signature"));
            case UNKNOWN_PLATFORM -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("status", "unknown_platform"));
            case DISABLED -> ResponseEntity.ok(Map.of("status", "disabled"));
            case IGNORED -> ResponseEntity.ok(Map.of("status", "ignored"));
            case PROCESSED -> ResponseEntity.ok(Map.of(
                "status", "processed", "linked", result.linkedCount()));
        };
    }
}
```

- [ ] **Step 2: Derle ve commit**

```bash
git add Backend/src/main/java/com/tora/controller/GitWebhookController.java
git commit -m "feat(git): webhook controller (raw body, lowercase headers)"
```

---

### Task 13: SecurityConfig — webhook permitAll

**Files:**
- Modify: `Backend/src/main/java/com/tora/config/SecurityConfig.java:82-87`

**Interfaces:**
- Consumes: yok. Produces: `/api/webhooks/git/**` JWT'siz erişilebilir (imza ile korunur).

- [ ] **Step 1: permitAll matcher ekle**

`SecurityConfig.java` içinde `.requestMatchers("/actuator/health").permitAll()` satırından sonra:

```java
                // Git webhook: dış git sunucusundan JWT gelmez; imza ile doğrulanır
                .requestMatchers("/api/webhooks/git/**").permitAll()
```

- [ ] **Step 2: Derle, doğrula, commit**

Run: backend derle + ayağa kaldır; `curl -X POST http://localhost:8081/api/webhooks/git/github -A "Mozilla/5.0"` 401/200 dönmeli (403/redirect değil).
Expected: 401 (imza yok) veya 200 (kapalıysa `disabled`) — JWT redirect/403 değil.

```bash
git add Backend/src/main/java/com/tora/config/SecurityConfig.java
git commit -m "feat(git): permitAll for /api/webhooks/git/**"
```

---

### Task 14: Nginx — webhook UA filtre baypası + location

**Files:**
- Modify: `Frontend/nginx.conf` (UA map sonrası yeni map'ler; server `if` değişimi; webhook location)

**Interfaces:**
- Produces: git sunucu UA'sı (`GitHub-Hookshot`, `GitLab/*`, Go-http-client) 8G UA filtresine takılmadan `/api/webhooks/git/*` → backend'e proxy'lenir.

> **Neden map-seviyesi:** server bloğundaki `if ($8g_ua_bad) { return 403; }` location seçiminden ÖNCE (rewrite fazında) çalışır; bu yüzden tek başına bir `location` UA filtresinden kaçamaz. Çözüm: webhook yolunu UA kararına dahil eden bir guard map.

- [ ] **Step 1: `$8g_ua_bad` map'inden sonra (satır ~94) iki map ekle**

```nginx
# ─── WEBHOOK YOLU GUARD ──────────────────────────────────────────────────────
# Git sunucusu webhook'ları UA filtresinden muaf (imza ile korunur).
map $request_uri $tora_is_webhook {
    default 0;
    ~^/api/webhooks/git/ 1;
}

# Webhook ise UA-bad kararını sıfırla.
map "$tora_is_webhook$8g_ua_bad" $8g_ua_block {
    default 0;
    "01" 1;   # webhook değil + UA kötü → blokla
    # "11" = webhook + UA kötü → izin ver (0)
}
```

- [ ] **Step 2: Server bloğundaki UA `if`'ini değiştir (satır ~149)**

Eski:
```nginx
    if ($8g_ua_bad)       { return 403; }
```
Yeni:
```nginx
    if ($8g_ua_block)     { return 403; }
```

- [ ] **Step 3: `location /api` bloğundan ÖNCE webhook location ekle (satır ~186 öncesi)**

```nginx
    # Git webhook'ları — UA filtresinden muaf (guard map); ham gövde imza için korunur.
    location ~ ^/api/webhooks/git/ {
        limit_req zone=req_limit burst=20 nodelay;
        client_max_body_size 5m;

        proxy_pass            http://backend:8080;
        proxy_http_version    1.1;
        proxy_set_header      Host              $host;
        proxy_set_header      X-Real-IP         $remote_addr;
        proxy_set_header      X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header      X-Forwarded-Proto $scheme;
        proxy_request_buffering on;
        proxy_connect_timeout 10s;
        proxy_read_timeout    30s;
    }
```

- [ ] **Step 4: Nginx config testi + doğrula**

Run: `docker compose up -d --build frontend` ve logda `nginx: configuration file ... test is successful` benzeri hata olmadığını doğrula. `curl -X POST http://localhost:8081/api/webhooks/git/github -H "User-Agent: GitHub-Hookshot/abc"` → 401/200 (403 değil).
Expected: UA bloğu yok; backend yanıtı geçer.

- [ ] **Step 5: Commit**

```bash
git add Frontend/nginx.conf
git commit -m "feat(git): nginx webhook UA-filter bypass + proxy location"
```

---

### Task 15: TaskDTO.gitLinks + convertToDTO doldurma

**Files:**
- Modify: `Backend/src/main/java/com/tora/dto/TaskDTO.java` (alan ekle)
- Modify: `Backend/src/main/java/com/tora/service/TaskService.java:578-638` (convertToDTO + repo enjeksiyonu)

**Interfaces:**
- Consumes: `TaskGitLinkRepository`, `TaskGitLinkDTO`.
- Produces: `TaskDTO.gitLinks: List<TaskGitLinkDTO>` — görev detay yanıtında dolu gelir.

- [ ] **Step 1: TaskDTO'ya alan ekle**

`TaskDTO.java` içine (diğer alanların yanına):
```java
    private java.util.List<TaskGitLinkDTO> gitLinks;
```
(import gerekiyorsa `import com.tora.dto.TaskGitLinkDTO;` aynı paket olduğundan import gerekmez.)

- [ ] **Step 2: TaskService'e repo enjekte et**

`TaskService` alanlarına (mevcut `@Autowired` alanların yanına):
```java
    @Autowired
    private com.tora.repository.TaskGitLinkRepository taskGitLinkRepository;
```

- [ ] **Step 3: convertToDTO sonuna linkleri doldur**

`convertToDTO` içinde `return dto;` öncesine:
```java
        var gitLinks = taskGitLinkRepository.findByTask_IdOrderByCreatedAtDesc(task.getId());
        dto.setGitLinks(gitLinks.stream().map(l -> {
            com.tora.dto.TaskGitLinkDTO gl = new com.tora.dto.TaskGitLinkDTO();
            gl.setId(l.getId());
            gl.setPlatform(l.getPlatform());
            gl.setLinkType(l.getLinkType());
            gl.setExternalId(l.getExternalId());
            gl.setUrl(l.getUrl());
            gl.setTitle(l.getTitle());
            gl.setStatus(l.getStatus());
            gl.setBranch(l.getBranch());
            gl.setAuthor(l.getAuthor());
            return gl;
        }).collect(java.util.stream.Collectors.toList()));
```
> `task.getId()` null ise (henüz kaydedilmemiş) sorgu boş döner — sorun yok. Performans: liste endpoint'lerinde N+1 olmaması için yeni görevlerde genelde link yoktur; gerekirse ileride toplu fetch'e çevrilebilir (tech-debt notu).

- [ ] **Step 4: Derle ve commit**

```bash
git add Backend/src/main/java/com/tora/dto/TaskDTO.java Backend/src/main/java/com/tora/service/TaskService.java
git commit -m "feat(git): expose gitLinks in TaskDTO"
```

---

### Task 16: Frontend — tipler + TaskModal "Bağlı commit/MR" paneli

**Files:**
- Modify: `Frontend/src/types/Task.ts` (TaskGitLink interface + `gitLinks?`)
- Modify: `Frontend/src/components/task/TaskModal.tsx` (panel)

**Interfaces:**
- Consumes: `task.gitLinks`.
- Produces: görev detayında commit/MR listesi (platform etiketi, başlık, MR durum rozeti, tıklanır URL). Boşsa render edilmez.

- [ ] **Step 1: Tip ekle**

`Frontend/src/types/Task.ts` içine:
```typescript
export interface TaskGitLink {
  id: number;
  platform: string;
  linkType: 'COMMIT' | 'MR';
  externalId: string;
  url?: string;
  title?: string;
  status?: 'OPENED' | 'MERGED' | 'CLOSED' | null;
  branch?: string;
  author?: string;
}
```
Ve `Task` interface'ine:
```typescript
  gitLinks?: TaskGitLink[];
```

- [ ] **Step 2: TaskModal'a panel ekle**

`TaskModal.tsx` içinde, mevcut "Bağlı işler"/alt görev panellerine yakın bir yere (görev mevcut/`task?.id` olduğunda), şu bloğu ekle:
```tsx
{task?.gitLinks && task.gitLinks.length > 0 && (
  <div className="form-section git-links-section">
    <label>Bağlı commit / MR</label>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {task.gitLinks.map((l) => (
        <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.7 }}>
            {l.platform}/{l.linkType === 'MR' ? `!${l.externalId}` : l.externalId.substring(0, 8)}
          </span>
          {l.status && (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 4,
              background: l.status === 'MERGED' ? '#a6e3a1' : l.status === 'CLOSED' ? '#f38ba8' : '#89b4fa',
              color: '#11111b',
            }}>{l.status}</span>
          )}
          {l.url ? (
            <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title || l.externalId}</a>
          ) : (
            <span>{l.title || l.externalId}</span>
          )}
          {l.author && <span style={{ fontSize: 11, opacity: 0.6 }}>· {l.author}</span>}
        </li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 3: Frontend derle/build doğrula + commit**

Run: `docker compose up -d --build frontend` (veya `npm run build`) — TS hatası olmamalı.

```bash
git add Frontend/src/types/Task.ts Frontend/src/components/task/TaskModal.tsx
git commit -m "feat(git): task modal linked commit/MR panel"
```

---

### Task 17: Frontend — Admin Git Entegrasyonu ayar sayfası

**Files:**
- Create: `Frontend/src/components/admin/GitSettings.tsx`
- Modify: Admin sayfa/menü kayıt noktası (mevcut LDAP ayar sayfasının kayıtlı olduğu yer — `Frontend/src/components/admin/` altındaki LDAP ayar bileşenini ve onu render eden admin sekme/route dosyasını referans al).

**Interfaces:**
- Consumes: `GET/PUT /api/admin/git/settings` (Task 4); `GitSettingsDTO` alanları.
- Produces: aç/kapa toggle, webhook secret input (boş = değiştirme; `secretConfigured` rozetli), 3 durum-senkron dropdown (boş = "değiştirme"), 3 webhook URL gösterimi.

> **Status seçenekleri:** `TaskStatus` değerleri (koddan doğrulandı): `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. Dropdown ilk seçeneği `""` → "Değiştirme".

- [ ] **Step 1: Bileşeni yaz**

```tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface GitSettingsDTO {
  enabled: boolean;
  secretConfigured: boolean;
  mrOpenedStatus: string | null;
  mrMergedStatus: string | null;
  pushStatus: string | null;
}

// Backend TaskStatus enum değerleriyle eşleşmeli (com.tora.model.enums.TaskStatus).
const STATUS_OPTIONS = ['', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const PLATFORMS = ['github', 'gitlab', 'gitea'];

const GitSettings: React.FC = () => {
  const [s, setS] = useState<GitSettingsDTO | null>(null);
  const [secret, setSecret] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get<GitSettingsDTO>('/api/admin/git/settings').then((r) => setS(r.data));
  }, []);

  if (!s) return <div>Yükleniyor…</div>;

  const save = async () => {
    const r = await axios.put<GitSettingsDTO>('/api/admin/git/settings', {
      enabled: s.enabled,
      webhookSecret: secret || null,
      mrOpenedStatus: s.mrOpenedStatus || null,
      mrMergedStatus: s.mrMergedStatus || null,
      pushStatus: s.pushStatus || null,
    });
    setS(r.data);
    setSecret('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const base = `${window.location.origin}/api/webhooks/git`;

  return (
    <div className="admin-section">
      <h3>Git Entegrasyonu</h3>

      <label>
        <input type="checkbox" checked={s.enabled}
          onChange={(e) => setS({ ...s, enabled: e.target.checked })} /> Etkin
      </label>

      <div>
        <label>Webhook Secret {s.secretConfigured && <em>(tanımlı)</em>}</label>
        <input type="password" value={secret} placeholder={s.secretConfigured ? '••••• (değiştirmek için yaz)' : 'secret'}
          onChange={(e) => setSecret(e.target.value)} />
      </div>

      <div>
        <label>MR/PR açılınca → durum</label>
        <select value={s.mrOpenedStatus || ''} onChange={(e) => setS({ ...s, mrOpenedStatus: e.target.value })}>
          {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o || 'Değiştirme'}</option>)}
        </select>
      </div>
      <div>
        <label>MR/PR merge olunca → durum</label>
        <select value={s.mrMergedStatus || ''} onChange={(e) => setS({ ...s, mrMergedStatus: e.target.value })}>
          {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o || 'Değiştirme'}</option>)}
        </select>
      </div>
      <div>
        <label>Push/commit gelince → durum</label>
        <select value={s.pushStatus || ''} onChange={(e) => setS({ ...s, pushStatus: e.target.value })}>
          {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o || 'Değiştirme'}</option>)}
        </select>
      </div>

      <button onClick={save}>Kaydet</button>
      {saved && <span> ✓ Kaydedildi</span>}

      <div style={{ marginTop: 16 }}>
        <label>Webhook URL'leri (git platformuna girin)</label>
        <ul>
          {PLATFORMS.map((p) => (
            <li key={p}><code>{base}/{p}</code> — secret + JSON content-type</li>
          ))}
        </ul>
        <small>GitHub/Gitea: secret HMAC imzasıdır. GitLab: secret "Secret token" alanına girilir.</small>
      </div>
    </div>
  );
};

export default GitSettings;
```

- [ ] **Step 2: Admin menü/route'a bağla**

LDAP ayar bileşeninin admin panelde nasıl kayıtlı olduğunu bul (sekme listesi/route tanımı) ve aynı desende `GitSettings`'i "Git Entegrasyonu" sekmesi olarak ekle.

- [ ] **Step 3: Build doğrula + commit**

Run: `docker compose up -d --build frontend` — TS hatası yok; admin panelde sekme görünür.

```bash
git add Frontend/src/components/admin/GitSettings.tsx Frontend/src/<admin-route-dosyası>
git commit -m "feat(git): admin Git integration settings page"
```

---

### Task 18: Dokümantasyon + todo güncelleme (ZORUNLU — aynı seri içinde)

**Files:**
- Modify: `docs/database-schema.md` (git_settings, task_git_links tabloları + git-otomasyonu seed)
- Modify: `docs/architecture.md` (Git webhook akışı: controller → parser → service → linkleme/durum senkronu → TaskCompletedEvent → zincir)
- Modify: `docs/api-reference.md` (`POST /api/webhooks/git/{platform}`, `GET/PUT /api/admin/git/settings`)
- Modify: `docs/frontend.md` (TaskModal git paneli, Admin Git ayar sayfası)
- Modify: `todo/todo.md` (inbound git entegrasyonu `[x]` + sonuç notu; outbound/email-eşleme/smart-commit backlog'da kalır)

**Interfaces:** yok (dokümantasyon).

- [ ] **Step 1: docs/database-schema.md** — yeni iki tabloyu ve sistem kullanıcısı seed'ini, unique constraint `(task_id,platform,link_type,external_id)` ve `task_id` index'ini ekle.

- [ ] **Step 2: docs/architecture.md** — "Git Entegrasyonu (Inbound)" başlığı: ham webhook → imza doğrulama (HMAC-SHA256 GitHub/Gitea, token GitLab) → `GitEvent` → `TORA-\d+` kod eşleme → `task_git_links` idempotent upsert → ayarlı durum senkronu (sistem kullanıcısı) → COMPLETED'te `TaskCompletedEvent` → zincir tetikleme. `resolveGitActor` izole (email-eşleme için ileride).

- [ ] **Step 3: docs/api-reference.md** — webhook endpoint (permitAll, imza ile korunur, 401/404/200 sonuçları) + admin ayar endpoint'leri (ADMIN).

- [ ] **Step 4: docs/frontend.md** — TaskModal "Bağlı commit/MR" paneli ve Admin → Git Entegrasyonu ayar sayfası.

- [ ] **Step 5: todo/todo.md** — git entegrasyonu (inbound) maddesini `[x]` işaretle, **Sonuç:** notu ekle (ne yapıldı). Outbound (branch/MR oluşturma), aktör email-eşleme, smart-commit komutlarını "sonraki sub-project" olarak backlog'da bırak/ekle.

- [ ] **Step 6: Commit**

```bash
git add docs/ todo/todo.md
git commit -m "docs(git): inbound git integration — schema, architecture, API, frontend, todo"
```

---

### Task 19: Uçtan uca doğrulama

**Files:** yok (manuel/curl doğrulama).

- [ ] **Step 1: Tüm birim testleri çalıştır**

Run: `mvn -Dtest=HmacUtilTest,GithubWebhookParserTest,GitlabWebhookParserTest,GiteaWebhookParserTest,GitWebhookServiceTest test`
Expected: hepsi PASS.

- [ ] **Step 2: Stack'i ayağa kaldır**

Run: `docker compose up -d --build`
Expected: backend + frontend sağlıklı; Liquibase V33 uygulanmış.

- [ ] **Step 3: Ayarları admin ile aç**

Admin panel → Git Entegrasyonu: etkinleştir, secret = `testsecret`, MR merge → `COMPLETED`, kaydet.

- [ ] **Step 4: Sahte GitHub push webhook'u gönder (geçerli imza)**

Var olan bir görevin kodunu kullan (ör. `TORA-1`). PowerShell ile imzalı istek:
```powershell
$body = '{"ref":"refs/heads/feature/TORA-1","commits":[{"id":"deadbeef","message":"TORA-1 fix","url":"http://x/deadbeef","author":{"name":"Test"}}]}'
$secret = "testsecret"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$sig = "sha256=" + (($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString("x2") }) -join "")
Invoke-RestMethod -Uri "http://localhost:8081/api/webhooks/git/github" -Method Post -Body $body `
  -Headers @{ "X-GitHub-Event"="push"; "X-Hub-Signature-256"=$sig; "User-Agent"="GitHub-Hookshot/x"; "Content-Type"="application/json" }
```
Expected: `{ status = processed, linked = 1 }`. Görev detayında "Bağlı commit/MR" paneli `deadbeef` commit'ini gösterir.

- [ ] **Step 5: Geçersiz imza → 401**

Aynı isteği yanlış imzayla gönder → HTTP 401 / `invalid_signature`.

- [ ] **Step 6: MR merged + zincir tetikleme (varsa zincirli görev)**

Zinciri tanımlı bir göreve `pull_request` `closed`+`merged=true` webhook'u gönder (kodu içeren title) → görev `COMPLETED` olur, zincir görevleri açılır. Doğrula.

- [ ] **Step 7: Son commit (varsa kalan doğrulama düzeltmeleri)**

Doğrulamada bir sorun çıkarsa düzelt + ilgili task'a dön. Temizse bitir.

---

## Self-Review Notları (plan yazarından)

- **Spec kapsamı:** §2 mimari → Task 5-12; §3 veri modeli → Task 1,2,10; §4 güvenlik → Task 13,14 + imza Task 6-9; §5 frontend → Task 16,17; §6 edge/test → parser testleri (7-9) + servis testi (11) + E2E (19). Tümü kapsandı.
- **Aktör izolasyonu:** `resolveGitActor` tek metotta (Task 11) — email-eşleme buraya eklenecek (spec §7).
- **Çift tetikleme guard:** durum senkronu `taskService.updateTaskStatusAsSystem` (Task 11b, yeni) üzerinden gider; bu metot `publishIfCompleted` ile `TaskCompletedEvent` yayınladığından servis ayrıca event publish ETMEZ. Zincir once-guard (`triggeredAt`) çift üretimi engeller.
- **Neden ayrı sistem metodu:** mevcut `updateTaskStatus(Long, UpdateTaskStatusRequest)` `getCurrentUser()` (SecurityContext) + ekip erişim kontrolü kullanır; webhook'ta ikisi de yok → erişim kontrolünü atlayan, aktörü explicit alan `updateTaskStatusAsSystem` eklendi.
- **İmza/ham gövde:** controller `byte[]` alır, parser ham gövde üzerinden HMAC hesaplar — Jackson yeniden serileştirmesi imzayı bozmaz.
- **Koddan doğrulanan imzalar:** `TaskStatus` = `com.tora.model.enums.{OPEN,IN_PROGRESS,COMPLETED,CANCELLED}`; `userRepository.findByUsername(String)` mevcut; `EncryptionService.encrypt/decrypt(String)` mevcut; `taskRepository.findByCode` Task 11a'da eklenir.

# Zincir Görevler (Chain Tasks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bir görev COMPLETED olduğunda, üzerinde tanımlı bir veya birden çok "takip görevi" otomatik olarak (farklı birimlere de) oluşturulur.

**Architecture:** Inline tanımlar `task_chains` tablosunda kaynak göreve bağlı tutulur. `TaskChainService` tanımları yönetir (`upsertChains`) ve tamamlanmada tetikler (`fireIfDefined`). Tek entegrasyon noktası `TaskService.updateTaskStatus`'tur; best-effort (hatalar tamamlamayı bozmaz). Üretilen görev `spawned_from_task_id` ile kaynağına bağlanır.

**Tech Stack:** Java 17, Spring Boot 3.2, JPA/Hibernate, PostgreSQL 15, Liquibase, JUnit 5 + Mockito (mevcut `spring-boot-starter-test`), React 18 + TypeScript + Vite.

## Global Constraints

- Liquibase migration'larını yeniden sıralama/çakıştırma — yeni dosya **V31** olarak sona eklenir (`Backend/src/main/resources/db/changelog/`).
- Spring Security rol hiyerarşisi (`ADMIN > BIRIM_AMIRI > USER`) korunur; endpoint koruması baypas edilmez. (Zincir üretimi servis-içi `repository` ile yapılır, controller seviyesinde yeni açık uç yoktur.)
- Kod yorumları: satır satır açıklama yok; sadece banner başlıkları ve gerekli tek satırlık "neden" notları (CLAUDE.md "Kod Yorumları").
- Yapısal değişiklik (yeni tablo/servis): `docs/` **ve** `todo.md` aynı değişiklikte güncellenir.
- Build & doğrulama: `docker compose up -d --build` (Maven PATH'te yok; derleme container içinde).
- JWT/LDAP secret env'den; kaynağa hardcode yok.

---

### Task 1: V31 migration — task_chains, task_chain_assignees, tasks.spawned_from_task_id

**Files:**
- Create: `Backend/src/main/resources/db/changelog/changes/V31__create_task_chains.xml`
- Modify: `Backend/src/main/resources/db/changelog/db.changelog-master.xml` (V30 include'undan sonra ekle)

**Interfaces:**
- Produces: `task_chains` (id, source_task_id, title, content, target_team_id, target_project_id, priority, duration_days, triggered_at, created_at, updated_at), `task_chain_assignees` (chain_id, user_id), `tasks.spawned_from_task_id` kolonu.

- [ ] **Step 1: Migration dosyasını oluştur**

`V31__create_task_chains.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
        xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.20.xsd">

    <changeSet id="31-1-create-task-chains" author="tora">
        <createTable tableName="task_chains">
            <column name="id" type="BIGINT" autoIncrement="true">
                <constraints primaryKey="true" nullable="false"/>
            </column>
            <column name="source_task_id" type="BIGINT"><constraints nullable="false"/></column>
            <column name="title" type="VARCHAR(255)"><constraints nullable="false"/></column>
            <column name="content" type="TEXT"/>
            <column name="target_team_id" type="BIGINT"><constraints nullable="false"/></column>
            <column name="target_project_id" type="BIGINT"/>
            <column name="priority" type="VARCHAR(20)"/>
            <column name="duration_days" type="INT"><constraints nullable="false"/></column>
            <column name="triggered_at" type="TIMESTAMP"/>
            <column name="created_at" type="TIMESTAMP"><constraints nullable="false"/></column>
            <column name="updated_at" type="TIMESTAMP"><constraints nullable="false"/></column>
        </createTable>
        <addForeignKeyConstraint baseTableName="task_chains" baseColumnNames="source_task_id"
            constraintName="fk_task_chains_source" referencedTableName="tasks"
            referencedColumnNames="id" onDelete="CASCADE"/>
        <addForeignKeyConstraint baseTableName="task_chains" baseColumnNames="target_team_id"
            constraintName="fk_task_chains_team" referencedTableName="teams"
            referencedColumnNames="id"/>
        <addForeignKeyConstraint baseTableName="task_chains" baseColumnNames="target_project_id"
            constraintName="fk_task_chains_project" referencedTableName="projects"
            referencedColumnNames="id" onDelete="SET NULL"/>
        <createIndex tableName="task_chains" indexName="idx_task_chains_source">
            <column name="source_task_id"/>
        </createIndex>
    </changeSet>

    <changeSet id="31-2-create-task-chain-assignees" author="tora">
        <createTable tableName="task_chain_assignees">
            <column name="chain_id" type="BIGINT"><constraints nullable="false"/></column>
            <column name="user_id" type="BIGINT"><constraints nullable="false"/></column>
        </createTable>
        <addPrimaryKey tableName="task_chain_assignees" columnNames="chain_id, user_id"
            constraintName="pk_task_chain_assignees"/>
        <addForeignKeyConstraint baseTableName="task_chain_assignees" baseColumnNames="chain_id"
            constraintName="fk_tca_chain" referencedTableName="task_chains"
            referencedColumnNames="id" onDelete="CASCADE"/>
        <addForeignKeyConstraint baseTableName="task_chain_assignees" baseColumnNames="user_id"
            constraintName="fk_tca_user" referencedTableName="users"
            referencedColumnNames="id" onDelete="CASCADE"/>
    </changeSet>

    <changeSet id="31-3-add-spawned-from-to-tasks" author="tora">
        <addColumn tableName="tasks">
            <column name="spawned_from_task_id" type="BIGINT"/>
        </addColumn>
        <addForeignKeyConstraint baseTableName="tasks" baseColumnNames="spawned_from_task_id"
            constraintName="fk_tasks_spawned_from" referencedTableName="tasks"
            referencedColumnNames="id" onDelete="SET NULL"/>
        <createIndex tableName="tasks" indexName="idx_tasks_spawned_from">
            <column name="spawned_from_task_id"/>
        </createIndex>
    </changeSet>

</databaseChangeLog>
```

- [ ] **Step 2: Master changelog'a include ekle**

`db.changelog-master.xml` içinde V30 satırından hemen sonra:

```xml
    <include file="db/changelog/changes/V31__create_task_chains.xml"/>
```

- [ ] **Step 3: Migration'ı uygula ve doğrula**

Run: `docker compose up -d --build backend`
Run: `docker exec tora-db psql -U postgres -d tora -c "\d task_chains" -c "\d task_chain_assignees" -c "\d tasks" | grep -E "task_chains|spawned_from|chain_id"`
Expected: Üç tablo/kolon listelenir; backend healthy (liquibase hatası yok → `docker logs tora-backend | grep -i liquibase`).

- [ ] **Step 4: Commit**

```bash
git add Backend/src/main/resources/db/changelog/
git commit -m "feat(db): V31 task_chains + task_chain_assignees + tasks.spawned_from_task_id"
```

---

### Task 2: TaskChain entity + repository + Task entity bağları

**Files:**
- Create: `Backend/src/main/java/com/tora/model/TaskChain.java`
- Create: `Backend/src/main/java/com/tora/repository/TaskChainRepository.java`
- Modify: `Backend/src/main/java/com/tora/model/Task.java` (spawnedFrom + chains)

**Interfaces:**
- Produces: `TaskChain` (getters: getId, getTitle, getContent, getTargetTeam, getTargetProject, getPriority, getDurationDays, getTriggeredAt, getAssignees, getSource; setters dahil), `Task.getChains()/setChains(Set<TaskChain>)`, `Task.getSpawnedFrom()/setSpawnedFrom(Task)`, `TaskChainRepository extends JpaRepository<TaskChain, Long>` with `List<TaskChain> findBySourceId(Long sourceId)`.

- [ ] **Step 1: TaskChain entity'sini oluştur**

```java
package com.tora.model;

import com.tora.model.enums.Priority;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "task_chains")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
@ToString(exclude = {"source", "targetTeam", "targetProject", "assignees"})
public class TaskChain {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_task_id", nullable = false)
    private Task source;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_team_id", nullable = false)
    private Team targetTeam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_project_id")
    private Project targetProject;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Priority priority;

    @Column(name = "duration_days", nullable = false)
    private Integer durationDays;

    @Column(name = "triggered_at")
    private LocalDateTime triggeredAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "task_chain_assignees",
        joinColumns = @JoinColumn(name = "chain_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    @BatchSize(size = 50)
    private Set<User> assignees = new HashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 2: TaskChainRepository'yi oluştur**

```java
package com.tora.repository;

import com.tora.model.TaskChain;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskChainRepository extends JpaRepository<TaskChain, Long> {
    List<TaskChain> findBySourceId(Long sourceId);
}
```

- [ ] **Step 3: Task entity'sine bağları ekle**

`Task.java` içinde, `subtasks` alanından sonra ekle:

```java
    @OneToMany(mappedBy = "source", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @BatchSize(size = 50)
    private Set<TaskChain> chains = new HashSet<>();

    // Zincirle üretilen görev → kaynağı (geri bağ)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spawned_from_task_id")
    private Task spawnedFrom;
```

`@ToString(exclude = {...})` listesine `"chains"`, `"spawnedFrom"` ekle.

- [ ] **Step 4: Derlenir mi doğrula**

Run: `docker compose up -d --build backend`
Expected: backend healthy; `docker logs tora-backend | grep -iE "error|exception" | head` boş/anlamlı değil.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/main/java/com/tora/model/TaskChain.java Backend/src/main/java/com/tora/repository/TaskChainRepository.java Backend/src/main/java/com/tora/model/Task.java
git commit -m "feat(model): TaskChain entity + repository + Task spawnedFrom/chains"
```

---

### Task 3: DTO'lar — TaskChainRequest, TaskChainDTO, CreateTaskRequest/TaskDTO genişletme

**Files:**
- Create: `Backend/src/main/java/com/tora/dto/TaskChainRequest.java`
- Create: `Backend/src/main/java/com/tora/dto/TaskChainDTO.java`
- Modify: `Backend/src/main/java/com/tora/dto/CreateTaskRequest.java`
- Modify: `Backend/src/main/java/com/tora/dto/TaskDTO.java`

**Interfaces:**
- Produces: `TaskChainRequest` (getTitle, getContent, getTargetTeamId, getTargetProjectId, getPriority, getDurationDays, getAssigneeIds), `TaskChainDTO` (id, title, content, targetTeamId, targetTeamName, targetProjectId, priority, durationDays, assigneeIds, triggeredAt), `CreateTaskRequest.getChains(): List<TaskChainRequest>`, `TaskDTO.getChains(): List<TaskChainDTO>`, `TaskDTO.getSpawnedFromTaskId(): Long`, `TaskDTO.getSpawnedFromTitle(): String`.

- [ ] **Step 1: Mevcut DTO stilini oku**

Run: `sed -n '1,40p' Backend/src/main/java/com/tora/dto/CreateTaskRequest.java`
Amaç: Lombok `@Data`/`@Getter` mi, validation annotation stili ne — yeni DTO'lar aynı stili izlesin.

- [ ] **Step 2: TaskChainRequest oluştur** (mevcut DTO stiline uydur; örnek Lombok `@Data` varsayımı)

```java
package com.tora.dto;

import com.tora.model.enums.Priority;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class TaskChainRequest {
    @NotBlank
    @Size(max = 255)
    private String title;

    private String content;

    @NotNull
    private Long targetTeamId;

    private Long targetProjectId;

    private Priority priority;

    @NotNull
    @Min(0)
    private Integer durationDays;

    private List<Long> assigneeIds;
}
```

- [ ] **Step 3: TaskChainDTO oluştur**

```java
package com.tora.dto;

import com.tora.model.enums.Priority;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskChainDTO {
    private Long id;
    private String title;
    private String content;
    private Long targetTeamId;
    private String targetTeamName;
    private Long targetProjectId;
    private Priority priority;
    private Integer durationDays;
    private List<Long> assigneeIds;
    private LocalDateTime triggeredAt;
}
```

- [ ] **Step 4: CreateTaskRequest'e chains ekle**

`CreateTaskRequest.java` alanlarına ekle (mevcut import/stil korunarak):

```java
    @jakarta.validation.Valid
    private java.util.List<TaskChainRequest> chains;
```

- [ ] **Step 5: TaskDTO'ya alanları ekle**

`TaskDTO.java` alanlarına ekle:

```java
    private java.util.List<TaskChainDTO> chains;
    private Long spawnedFromTaskId;
    private String spawnedFromTitle;
```

- [ ] **Step 6: Derlenir mi doğrula + Commit**

Run: `docker compose up -d --build backend` → backend healthy.

```bash
git add Backend/src/main/java/com/tora/dto/
git commit -m "feat(dto): TaskChainRequest/DTO + CreateTaskRequest.chains + TaskDTO.chains/spawnedFrom"
```

---

### Task 4: TaskChainService.upsertChains + unit testler

**Files:**
- Create: `Backend/src/main/java/com/tora/service/TaskChainService.java`
- Create: `Backend/src/test/java/com/tora/service/TaskChainServiceTest.java`

**Interfaces:**
- Consumes: `TaskChainRepository`, `TeamRepository`, `ProjectRepository`, `UserRepository` (mevcut), `TaskChainRequest`, `TaskChain`, `Task`.
- Produces: `TaskChainService.upsertChains(Task source, List<TaskChainRequest> defs): void`.

- [ ] **Step 1: Failing test yaz**

`TaskChainServiceTest.java`:

```java
package com.tora.service;

import com.tora.dto.TaskChainRequest;
import com.tora.model.*;
import com.tora.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskChainServiceTest {

    @Mock TaskChainRepository taskChainRepository;
    @Mock TeamRepository teamRepository;
    @Mock ProjectRepository projectRepository;
    @Mock UserRepository userRepository;
    @Mock TaskRepository taskRepository;
    @Mock SlaService slaService;
    @Mock TaskLogService taskLogService;
    @Mock NotificationService notificationService;
    @Mock org.springframework.cache.CacheManager cacheManager;

    @InjectMocks TaskChainService service;

    private Task source() {
        Task t = new Task();
        t.setId(1L);
        t.setChains(new HashSet<>());
        return t;
    }

    @Test
    void upsertChains_createsNewDefinition() {
        Task source = source();
        Team team = new Team(); team.setId(5L);
        when(teamRepository.findById(5L)).thenReturn(Optional.of(team));

        TaskChainRequest req = new TaskChainRequest();
        req.setTitle("İzleme kur");
        req.setTargetTeamId(5L);
        req.setDurationDays(3);

        service.upsertChains(source, List.of(req));

        assertThat(source.getChains()).hasSize(1);
        TaskChain c = source.getChains().iterator().next();
        assertThat(c.getTitle()).isEqualTo("İzleme kur");
        assertThat(c.getTargetTeam()).isEqualTo(team);
        assertThat(c.getDurationDays()).isEqualTo(3);
    }

    @Test
    void upsertChains_nullOrEmpty_clearsExisting() {
        Task source = source();
        source.getChains().add(new TaskChain());

        service.upsertChains(source, null);

        assertThat(source.getChains()).isEmpty();
    }
}
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `docker run --rm -v "$PWD/Backend":/app -w /app maven:3.9-eclipse-temurin-17 mvn -q -o test -Dtest=TaskChainServiceTest 2>&1 | tail -20`
(Maven offline cache yoksa `-o` kaldır.)
Expected: FAIL — `TaskChainService` derlenmiyor (henüz yok).

- [ ] **Step 3: TaskChainService.upsertChains'i yaz**

```java
package com.tora.service;

import com.tora.dto.TaskChainRequest;
import com.tora.model.*;
import com.tora.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class TaskChainService {

    @Autowired private TaskChainRepository taskChainRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private SlaService slaService;
    @Autowired private TaskLogService taskLogService;
    @Autowired private NotificationService notificationService;
    @Autowired private org.springframework.cache.CacheManager cacheManager;

    // ───────────────── DEFINITION MGMT ─────────────────
    public void upsertChains(Task source, List<TaskChainRequest> defs) {
        source.getChains().clear(); // orphanRemoval mevcutları siler
        if (defs == null || defs.isEmpty()) return;

        for (TaskChainRequest req : defs) {
            Team team = teamRepository.findById(req.getTargetTeamId())
                .orElseThrow(() -> new RuntimeException("Hedef birim bulunamadı: " + req.getTargetTeamId()));
            TaskChain c = new TaskChain();
            c.setSource(source);
            c.setTitle(req.getTitle());
            c.setContent(req.getContent());
            c.setTargetTeam(team);
            if (req.getTargetProjectId() != null) {
                c.setTargetProject(projectRepository.findById(req.getTargetProjectId()).orElse(null));
            }
            c.setPriority(req.getPriority());
            c.setDurationDays(req.getDurationDays() != null ? req.getDurationDays() : 0);
            if (req.getAssigneeIds() != null && !req.getAssigneeIds().isEmpty()) {
                Set<User> users = req.getAssigneeIds().stream()
                    .map(id -> userRepository.findById(id).orElse(null))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
                c.setAssignees(users);
            }
            source.getChains().add(c);
        }
    }
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `docker run --rm -v "$PWD/Backend":/app -w /app maven:3.9-eclipse-temurin-17 mvn -q test -Dtest=TaskChainServiceTest 2>&1 | tail -20`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add Backend/src/main/java/com/tora/service/TaskChainService.java Backend/src/test/java/com/tora/service/TaskChainServiceTest.java
git commit -m "feat(chain): TaskChainService.upsertChains + unit tests"
```

---

### Task 5: TaskChainService.fireIfDefined + unit testler (çekirdek mantık)

**Files:**
- Modify: `Backend/src/main/java/com/tora/service/TaskChainService.java`
- Modify: `Backend/src/test/java/com/tora/service/TaskChainServiceTest.java`

**Interfaces:**
- Consumes: `slaService.recalculate(Task)`, `taskLogService.logTaskAction(Task, String, User, String, Object, Object)`, `notificationService.notifyTaskAssigned(Task, Set<User>, User)`.
- Produces: `TaskChainService.fireIfDefined(Task source, User completer): void` (çekirdek, unit testli) + `TaskCompletedEvent(Long sourceTaskId, Long completerId)` + `@TransactionalEventListener(AFTER_COMMIT)` dinleyici `onTaskCompleted(TaskCompletedEvent)`.

> **TASARIM DÜZELTMESİ (denetim bulgusu #1):** `TaskService` sınıf düzeyinde `@Transactional`. Zinciri tamamlama transaction'ı İÇİNDE çağırmak, bir spawn hatasında tüm tx'i rollback-only yapıp **tamamlamayı geri alır**. Çözüm: tamamlama **commit olduktan sonra** `@TransactionalEventListener(phase = AFTER_COMMIT)` ile, **`REQUIRES_NEW`** ayrı transaction'da çalıştır. Böylece tamamlama kalıcıdır; zincir patlasa bile dokunamaz. completer `SecurityContext`'ten değil, event'teki `completerId`'den yüklenir (bulgu #4).

- [ ] **Step 1: Failing testleri ekle** (`TaskChainServiceTest.java`'ya)

```java
    @Test
    void fireIfDefined_createsFollowUp_withRelativeDatesAndCompleterAsCreator() {
        Task source = source();
        Team team = new Team(); team.setId(9L);
        User completer = new User(); completer.setId(77L);

        TaskChain c = new TaskChain();
        c.setSource(source); c.setTitle("Network bilgilendir");
        c.setTargetTeam(team); c.setDurationDays(2);
        c.setAssignees(new HashSet<>());
        source.getChains().add(c);

        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        service.fireIfDefined(source, completer);

        ArgumentCaptor<Task> cap = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(cap.capture());
        Task created = cap.getValue();
        assertThat(created.getTitle()).isEqualTo("Network bilgilendir");
        assertThat(created.getTeam()).isEqualTo(team);
        assertThat(created.getCreatedBy()).isEqualTo(completer);
        assertThat(created.getSpawnedFrom()).isEqualTo(source);
        assertThat(created.getStartDate()).isEqualTo(java.time.LocalDate.now());
        assertThat(created.getEndDate()).isEqualTo(java.time.LocalDate.now().plusDays(2));
        assertThat(c.getTriggeredAt()).isNotNull();
    }

    @Test
    void fireIfDefined_alreadyTriggered_doesNothing() {
        Task source = source();
        TaskChain c = new TaskChain();
        c.setSource(source); c.setTriggeredAt(java.time.LocalDateTime.now());
        source.getChains().add(c);

        service.fireIfDefined(source, new User());

        verify(taskRepository, never()).save(any());
    }

    @Test
    void fireIfDefined_oneChainThrows_othersStillCreated() {
        Task source = source();
        Team teamOk = new Team(); teamOk.setId(1L);
        TaskChain bad = new TaskChain(); bad.setSource(source); bad.setTitle("bad");
        bad.setTargetTeam(null); bad.setDurationDays(1); bad.setAssignees(new HashSet<>());
        TaskChain good = new TaskChain(); good.setSource(source); good.setTitle("good");
        good.setTargetTeam(teamOk); good.setDurationDays(1); good.setAssignees(new HashSet<>());
        source.getChains().add(bad); source.getChains().add(good);

        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            if (t.getTeam() == null) throw new RuntimeException("no team");
            return t;
        });

        service.fireIfDefined(source, new User());

        // good yine de üretildi (en az bir başarılı save), tamamlama bozulmadı (exception fırlamadı)
        verify(taskRepository, atLeastOnce()).save(any());
        assertThat(good.getTriggeredAt()).isNotNull();
    }
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `docker run --rm -v "$PWD/Backend":/app -w /app maven:3.9-eclipse-temurin-17 mvn -q test -Dtest=TaskChainServiceTest 2>&1 | tail -20`
Expected: FAIL — `fireIfDefined` metodu yok.

- [ ] **Step 3: fireIfDefined'i yaz** (`TaskChainService.java`'ya ekle)

```java
    // ───────────────── TRIGGER ─────────────────
    /** Kaynak COMPLETED olduğunda çağrılır. Her tanım best-effort; biri patlarsa diğerleri devam. */
    public void fireIfDefined(Task source, User completer) {
        if (source.getChains() == null || source.getChains().isEmpty()) return;
        for (TaskChain c : source.getChains()) {
            if (c.getTriggeredAt() != null) continue; // bir-kez garantisi
            try {
                spawn(source, c, completer);
                c.setTriggeredAt(java.time.LocalDateTime.now());
            } catch (Exception ex) {
                // best-effort: tamamlamayı asla bozma
                org.slf4j.LoggerFactory.getLogger(TaskChainService.class)
                    .warn("Zincir görevi üretilemedi (sourceId={}, chainTitle={}): {}",
                          source.getId(), c.getTitle(), ex.getMessage());
            }
        }
    }

    private void spawn(Task source, TaskChain c, User completer) {
        java.time.LocalDate today = java.time.LocalDate.now();
        Task t = new Task();
        t.setTitle(c.getTitle());
        t.setContent(c.getContent());
        t.setTeam(c.getTargetTeam());            // erişim kontrolü baypas (sistem üretir)
        t.setProject(c.getTargetProject());
        t.setPriority(c.getPriority() != null ? c.getPriority() : com.tora.model.enums.Priority.NORMAL);
        t.setStatus(com.tora.model.enums.TaskStatus.OPEN);
        t.setStartDate(today);
        t.setEndDate(today.plusDays(c.getDurationDays() != null ? c.getDurationDays() : 0));
        t.setCreatedBy(completer);
        t.setSpawnedFrom(source);
        if (c.getAssignees() != null && !c.getAssignees().isEmpty()) {
            t.setAssignees(new java.util.HashSet<>(c.getAssignees()));
        }
        Task saved = taskRepository.save(t);

        slaService.recalculate(saved);
        taskLogService.logTaskAction(source, "CHAIN_TRIGGERED", completer,
            "Zincir tetiklendi → " + c.getTitle(), null, null);
        taskLogService.logTaskAction(saved, "CHAIN_CREATED", completer,
            "Zincirle oluşturuldu (kaynak #" + source.getId() + ")", null, null);
        if (saved.getAssignees() != null && !saved.getAssignees().isEmpty()) {
            notificationService.notifyTaskAssigned(saved, saved.getAssignees(), completer);
        }
        evictDashboardCache(saved.getTeam().getId());
    }

    private void evictDashboardCache(Long teamId) {
        for (String cacheName : java.util.List.of("dashboardStats", "dashboardDetails")) {
            org.springframework.cache.Cache springCache = cacheManager.getCache(cacheName);
            if (springCache instanceof org.springframework.cache.caffeine.CaffeineCache caffeineCache) {
                com.github.benmanes.caffeine.cache.Cache<Object, Object> nativeCache = caffeineCache.getNativeCache();
                String teamPrefix = teamId + ":";
                nativeCache.asMap().keySet().removeIf(key -> {
                    String k = key.toString();
                    return k.startsWith(teamPrefix) || k.startsWith("null:");
                });
            }
        }
    }
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `docker run --rm -v "$PWD/Backend":/app -w /app maven:3.9-eclipse-temurin-17 mvn -q test -Dtest=TaskChainServiceTest 2>&1 | tail -20`
Expected: PASS (5 test).

- [ ] **Step 5: TaskCompletedEvent + AFTER_COMMIT dinleyici ekle**

Create: `Backend/src/main/java/com/tora/event/TaskCompletedEvent.java`

```java
package com.tora.event;

/** Bir görev COMPLETED'e geçtiğinde yayınlanır; zincir tetikleme bunu dinler. */
public record TaskCompletedEvent(Long sourceTaskId, Long completerId) {}
```

`TaskChainService.java`'ya dinleyici ekle (fireIfDefined'i AYRI tx + commit sonrası sarmalar):

```java
    @org.springframework.transaction.event.TransactionalEventListener(
        phase = org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT)
    @org.springframework.transaction.annotation.Transactional(
        propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void onTaskCompleted(com.tora.event.TaskCompletedEvent event) {
        Task source = taskRepository.findById(event.sourceTaskId()).orElse(null);
        User completer = userRepository.findById(event.completerId()).orElse(null);
        if (source == null || completer == null) return;
        fireIfDefined(source, completer); // chains lazy → bu yeni tx içinde yüklenir
    }
```

> Not: `fireIfDefined` içindeki `c.setTriggeredAt(...)` bu yeni tx'te commit edilir. Reopen→recomplete'te guard çalışır.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/main/java/com/tora/service/TaskChainService.java Backend/src/test/java/com/tora/service/TaskChainServiceTest.java Backend/src/main/java/com/tora/event/TaskCompletedEvent.java
git commit -m "feat(chain): fireIfDefined + AFTER_COMMIT/REQUIRES_NEW listener (best-effort, tx-safe) + unit tests"
```

---

### Task 6: TaskService entegrasyonu (upsert + event yayınlama + DTO doldurma)

**Files:**
- Modify: `Backend/src/main/java/com/tora/service/TaskService.java`

**Interfaces:**
- Consumes: `TaskChainService.upsertChains`, `TaskCompletedEvent`, `ApplicationEventPublisher`.

- [ ] **Step 1: TaskChainService + event publisher enjekte et**

`TaskService.java` alanlarına ekle:

```java
    @Autowired
    private TaskChainService taskChainService;

    @Autowired
    private org.springframework.context.ApplicationEventPublisher eventPublisher;
```

- [ ] **Step 2: createTask içinde upsert çağır**

`createTask`'ta `task = taskRepository.save(task);` (satır ~221) sonrasında, subtasks bloğundan sonra ekle:

```java
        // Chain definitions
        if (request.getChains() != null) {
            taskChainService.upsertChains(task, request.getChains());
        }
```

- [ ] **Step 3: updateTask içinde upsert çağır**

`updateTask`'ta etiket/team/project güncellemelerinden sonra (task save edilmeden hemen önce/sonra; mevcut akışa uygun yere) ekle:

```java
        if (request.getChains() != null) {
            taskChainService.upsertChains(task, request.getChains());
        }
```

- [ ] **Step 4: COMPLETED'e geçişte event yayınla — HER İKİ yoldan (denetim bulgusu #2)**

> Durum iki yoldan COMPLETED olabiliyor: `updateTaskStatus` (durum endpoint'i + bulk) **ve** `updateTask` (düzenleme formu). Zincir ikisinden de tetiklenmeli. Tek yardımcı + sadece COMPLETED'e **geçişte** (oldStatus != COMPLETED) yayınla; event commit sonrası dinlenecek.

Önce yardımcı metodu ekle (`TaskService.java`):

```java
    // Yalnızca COMPLETED'e GEÇİŞTE yayınla (zaten COMPLETED olanı tekrar tetikleme)
    private void publishIfCompleted(TaskStatus oldStatus, Task task, User completer) {
        if (task.getStatus() == TaskStatus.COMPLETED && oldStatus != TaskStatus.COMPLETED) {
            eventPublisher.publishEvent(new com.tora.event.TaskCompletedEvent(task.getId(), completer.getId()));
        }
    }
```

`updateTaskStatus`'ta `notifyTaskStatusChanged` çağrısından sonra ekle (`oldStatus` zaten mevcut, satır ~409):

```java
        publishIfCompleted(oldStatus, task, currentUser);
```

`updateTask`'ta status set edilmeden ÖNCE eski durumu yakala ve save'den sonra yayınla:

```java
        TaskStatus oldStatus = task.getStatus();   // task.setStatus(...) ÇAĞRISINDAN ÖNCE
        // ... mevcut güncelleme + taskRepository.save(task) ...
        publishIfCompleted(oldStatus, task, currentUser);
```

> `taskChainService.fireIfDefined`'i TaskService'ten DOĞRUDAN çağırma — sadece event yayınla. Tetikleme `@TransactionalEventListener(AFTER_COMMIT)` ile bu transaction commit olduktan sonra ayrı tx'te çalışır (bulgu #1).

- [ ] **Step 5: convertToDTO içinde chains + spawnedFrom doldur**

`convertToDTO` (satır ~541) içine, mevcut alan map'lemelerinin yanına ekle:

```java
        if (task.getSpawnedFrom() != null) {
            dto.setSpawnedFromTaskId(task.getSpawnedFrom().getId());
            dto.setSpawnedFromTitle(task.getSpawnedFrom().getTitle());
        }
        if (task.getChains() != null && !task.getChains().isEmpty()) {
            dto.setChains(task.getChains().stream().map(c -> {
                com.tora.dto.TaskChainDTO cd = new com.tora.dto.TaskChainDTO();
                cd.setId(c.getId());
                cd.setTitle(c.getTitle());
                cd.setContent(c.getContent());
                cd.setTargetTeamId(c.getTargetTeam() != null ? c.getTargetTeam().getId() : null);
                cd.setTargetTeamName(c.getTargetTeam() != null ? c.getTargetTeam().getName() : null);
                cd.setTargetProjectId(c.getTargetProject() != null ? c.getTargetProject().getId() : null);
                cd.setPriority(c.getPriority());
                cd.setDurationDays(c.getDurationDays());
                cd.setAssigneeIds(c.getAssignees() == null ? java.util.List.of()
                    : c.getAssignees().stream().map(User::getId).collect(java.util.stream.Collectors.toList()));
                cd.setTriggeredAt(c.getTriggeredAt());
                return cd;
            }).collect(java.util.stream.Collectors.toList()));
        }
```

> Not: `Team.getName()` metodunun varlığını doğrula (`grep -n "getName\|name" Backend/src/main/java/com/tora/model/Team.java`); farklıysa uygun getter'ı kullan.

- [ ] **Step 6: Build + manuel uçtan uca doğrulama**

Run: `docker compose up -d --build backend`
Run (token al, sonra chain'li görev oluştur → tamamla → takip görevi oluştu mu kontrol et):
```bash
# 1) login
TOKEN=$(curl -s -X POST http://localhost:8081/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
echo "token alındı: ${TOKEN:0:12}..."
# 2) chain tanımlı görev oluştur (teamId/targetTeamId ortamına göre ayarla)
curl -s -X POST http://localhost:8081/api/tasks -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
 -d '{"title":"Sunucu açma","startDate":"2026-06-27","endDate":"2026-06-28","status":"OPEN","teamId":1,"chains":[{"title":"İzleme kur (Grafana)","targetTeamId":1,"durationDays":2}]}'
```
Expected: 200; dönen görevde `chains` dolu. Ardından o görevi `PUT /api/tasks/{id}/status` ile COMPLETED yap, sonra `GET /api/tasks?...` veya DB'de `SELECT id,title,spawned_from_task_id FROM tasks ORDER BY id DESC LIMIT 3;` ile takip görevinin oluştuğunu + `spawned_from_task_id` dolu olduğunu doğrula.

- [ ] **Step 7: Regresyon kontrolü**

Run: `docker run --rm -v "$PWD/Backend":/app -w /app maven:3.9-eclipse-temurin-17 mvn -q test 2>&1 | tail -15`
Expected: tüm testler PASS.
Run: mevcut bir görevi `chains` GÖNDERMEDEN oluştur/güncelle → bugünküyle aynı davranış (chains null → no-op), hata yok.

- [ ] **Step 8: Commit**

```bash
git add Backend/src/main/java/com/tora/service/TaskService.java
git commit -m "feat(chain): wire upsert into create/update, fire on COMPLETED, populate DTO"
```

---

### Task 7: Frontend — TaskModal zincir tanım listesi

**Files:**
- Modify: `Frontend/src/` içindeki TaskModal bileşeni (önce yerini bul) ve API tip dosyası.

**Interfaces:**
- Consumes: task create/update payload'ına `chains: TaskChainRequest[]`.
- Produces: TaskModal'da zincir tanım listesi düzenleme.

- [ ] **Step 1: İlgili dosyaları bul**

Run: `grep -rl "TaskModal" Frontend/src | head; grep -rln "interface Task\b\|type Task\b\|CreateTaskRequest" Frontend/src | head`
Amaç: TaskModal bileşeni ve TS tip tanımlarının yerini saptamak; mevcut alan/stil kalıbını izlemek.

- [ ] **Step 2: TS tiplerini ekle**

Görev tip dosyasına (Step 1'de bulunan):

```ts
export interface TaskChainRequest {
  id?: number;
  title: string;
  content?: string;
  targetTeamId: number;
  targetProjectId?: number;
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  durationDays: number;
  assigneeIds?: number[];
  triggeredAt?: string;
}
```
Ve `Task`/`CreateTaskRequest` tipine: `chains?: TaskChainRequest[]; spawnedFromTaskId?: number; spawnedFromTitle?: string;`

- [ ] **Step 3: TaskModal'a katlanır "Tamamlanınca açılacak işler" bölümü ekle**

Mevcut form state kalıbına uygun olarak (bu proje React Context + local state kullanıyor):
- `const [chains, setChains] = useState<TaskChainRequest[]>(task?.chains ?? [])`
- `+ İş ekle` butonu → `setChains([...chains, {title:'', targetTeamId: defaultTeamId, durationDays: 1}])`
- Her satır: başlık (input), hedef birim (mevcut team listesi select), atananlar (seçilen birimin kullanıcıları — mevcut user listeleme ile), öncelik (select), süre/gün (number); çöp ikonu → satırı kaldır.
- Submit payload'ına `chains` ekle.

> Tam JSX bu projenin TaskModal yapısına göre yazılır; mevcut alan render kalıbını (label+input sarmalayıcıları, className'ler) birebir izle. Boş `title` satırları submit'te filtrele.

- [ ] **Step 4: Doğrula (UI)**

Run: `docker compose up -d --build frontend`
Tarayıcıda görev oluştururken bölümün açılması, satır ekle/sil, kaydetince payload'da `chains` gitmesi (Network sekmesi) doğrulanır.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src
git commit -m "feat(chain): TaskModal tamamlanınca açılacak işler listesi"
```

---

### Task 8: Frontend — görev detayı/kart zincir & kaynak rozeti

**Files:**
- Modify: TaskModal/detay ve/veya görev kartı bileşenleri.

- [ ] **Step 1: Görev detayında göster**
- `task.chains?.length` > 0 → "Tamamlanınca açılacak işler: N" özeti (başlık → birim listesi).
- `task.spawnedFromTaskId` varsa → "Bu iş #{spawnedFromTaskId} «{spawnedFromTitle}» tamamlanınca oluştu" (mümkünse kaynağa link/scroll).

- [ ] **Step 2: Doğrula + Commit**

Run: `docker compose up -d --build frontend` → tarayıcıda zincirle üretilmiş bir görevde kaynak rozeti, tanımlı bir görevde zincir özeti görünür.

```bash
git add Frontend/src
git commit -m "feat(chain): görev detayında zincir özeti + kaynak rozeti"
```

---

### Task 9: Dokümantasyon + todo + nihai regresyon

**Files:**
- Modify: `docs/database-schema.md`, `docs/api-reference.md`, `docs/architecture.md`, `docs/frontend.md`, `todo/todo.md`

- [ ] **Step 1: database-schema.md** — `task_chains`, `task_chain_assignees` tablo bölümleri (Join Tables ve tablo listesine), `tasks.spawned_from_task_id` notu, Migration History'ye `V31` satırı, ER diyagramına bağ.

- [ ] **Step 2: api-reference.md** — Tasks bölümünde create/update gövdesine `chains[]` alanı (alan tablosu + örnek JSON), `TaskDTO`'ya `chains`, `spawnedFromTaskId`, `spawnedFromTitle`.

- [ ] **Step 3: architecture.md** — Service Layer Summary'ye `TaskChainService` satırı; tetikleme akışı (`updateTaskStatus → fireIfDefined`, COMPLETED, best-effort, cross-birim baypas) kısa not; ER Overview'a TaskChain.

- [ ] **Step 4: frontend.md** — TaskModal'daki "Tamamlanınca açılacak işler" bölümü + zincir/kaynak rozeti notu.

- [ ] **Step 5: todo.md** — üstteki "🔨 Üzerinde Çalışılıyor — Zincir Görevler" bloğundaki kutuları `[x]` yap, kısa **Düzeltme/sonuç** notu ekle; bloğu "Tamamlananlar"a taşı veya tamamlandı olarak işaretle.

- [ ] **Step 6: Nihai regresyon + uçtan uca**

Run: `docker compose up -d --build` (hepsi)
Run: `docker run --rm -v "$PWD/Backend":/app -w /app maven:3.9-eclipse-temurin-17 mvn -q test 2>&1 | tail -15` → tüm testler PASS.
Manuel: senaryo testi — "sunucu açma" görevine 3 chain (izleme/network/some) tanımla → COMPLETED → 3 görev ilgili birimlere oluştu, her biri `spawned_from` dolu, kaynağın task log'unda 3× `CHAIN_TRIGGERED`. Tekrar COMPLETED→OPEN→COMPLETED yap → yeni üretim YOK (bir-kez guard).

- [ ] **Step 7: Commit + push**

```bash
git add docs/ todo/todo.md
git commit -m "docs(chain): database-schema/api-reference/architecture/frontend + todo tamamlandı"
git push origin development
```

---

## Notlar

- **Tekrarlayan görevler** (zaman tetiklemeli) ve **şablon tabanlı zincir** bu planın DIŞINDA — ayrı planlar.
- Maven container imajı (`maven:3.9-eclipse-temurin-17`) testler için kullanılıyor çünkü host'ta `mvn` yok. İlk çalıştırmada bağımlılıkları indirir (internet gerekir). Alternatif: testleri backend Docker build'inin parçası yapmak (Dockerfile'da `mvn test`), ama bu plan ayrık tutuyor.

# Architecture

## Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Java | 17 | Runtime |
| Spring Boot | 3.2.0 | Application framework |
| Spring Security | 6.x | Authentication & authorization |
| Spring Data JPA | 3.x | ORM / Data access |
| Hibernate | 6.x | JPA implementation |
| PostgreSQL | 15 | Relational database |
| HikariCP | 5.x | JDBC connection pool (with keepalive & leak detection) |
| Liquibase | Latest | Database migrations |
| jjwt | 0.12.3 | JWT access + refresh token generation & validation |
| Spring LDAP | 3.x | LDAP integration |
| Lombok | Latest | Boilerplate reduction |
| Spring AOP | 3.x | Cross-cutting concerns (logging) |
| Spring Cache + Caffeine | 3.x | In-memory caching (dashboard stats + user details, 5 min TTL) |
| Apache POI (`poi-ooxml`) | 5.x | Excel (`.xlsx`) report export |
| Maven | 3.x | Build tool & dependency management |

> **Note:** `bucket4j-core` is present in `pom.xml` but rate limiting / account lockout is implemented directly via the database-backed `LoginAttemptService` (see [Authentication](./authentication.md#rate-limiting)), not via Bucket4j buckets.

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| React Router | Client-side routing |
| Axios | HTTP client |
| date-fns | Date utilities |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker & Docker Compose | Containerization |
| Nginx | Reverse proxy / load balancer (optional) |
| PostgreSQL 15 Alpine | Database container |

---

## Project Structure

```
TORA/
├── Backend/
│   ├── src/main/java/com/tora/
│   │   ├── config/              # Configuration classes
│   │   │   ├── SecurityConfig.java      # Spring Security filter chain, CORS, BCrypt
│   │   │   ├── JwtConfig.java           # JWT secret validation on startup
│   │   │   ├── LdapConfig.java          # LdapContextSource wiring from DB-stored settings
│   │   │   ├── SampleDataInitializer.java # Optional sample data seeding (SEED_SAMPLE_DATA)
│   │   │   └── CacheConfig.java         # Caffeine cache manager (dashboardStats/Details + userDetails, 5 min TTL)
│   │   ├── controller/          # REST API controllers
│   │   │   ├── AuthController.java      # Login, refresh, logout, register, current user
│   │   │   ├── AdminController.java     # Admin CRUD (users, teams, roles)
│   │   │   ├── TaskController.java      # Task CRUD and status updates
│   │   │   ├── TaskCommentController.java # Comment CRUD on tasks
│   │   │   ├── TaskLabelController.java # Team-scoped task label search
│   │   │   ├── ProjectController.java   # Project CRUD
│   │   │   ├── TeamController.java      # Team listing
│   │   │   ├── DashboardController.java # Dashboard statistics (Caffeine cached)
│   │   │   ├── CalendarController.java  # Calendar data by year/month
│   │   │   ├── SearchController.java    # Global search (tasks, projects, users)
│   │   │   ├── SavedFilterController.java # Saved search/filter definitions per user
│   │   │   ├── ReportController.java    # Performance/productivity reports + Excel export
│   │   │   ├── NotificationController.java # In-app notifications (list, mark read, delete)
│   │   │   ├── UserProfileController.java  # User profile, password, login history
│   │   │   ├── LdapSettingsController.java # LDAP configuration
│   │   │   ├── LdapImportController.java   # LDAP user search & import
│   │   │   ├── SystemLogController.java    # System log viewing
│   │   │   ├── TaskLogController.java      # Task audit log viewing
│   │   │   ├── HealthController.java       # Basic health check
│   │   │   └── SystemHealthController.java # Detailed system health
│   │   ├── dto/                 # Data Transfer Objects
│   │   │   ├── LoginRequest.java / LoginResponse.java
│   │   │   ├── CreateTaskRequest.java / TaskDTO.java
│   │   │   ├── CreateProjectRequest.java / ProjectDTO.java
│   │   │   ├── CreateUserRequest.java / UserDTO.java
│   │   │   ├── CreateTeamRequest.java / TeamDTO.java
│   │   │   ├── DashboardStatsDTO.java / DashboardDetailsDTO.java
│   │   │   ├── NotificationDTO.java / NotificationPageDTO.java
│   │   │   ├── TaskCommentDTO.java / CreateCommentRequest.java
│   │   │   ├── SystemLogDTO.java / TaskLogDTO.java
│   │   │   ├── LdapSettingsDTO.java / LdapUserDTO.java
│   │   │   └── ... (and more)
│   │   ├── model/               # JPA Entity classes
│   │   │   ├── User.java
│   │   │   ├── Team.java
│   │   │   ├── Task.java
│   │   │   ├── Project.java
│   │   │   ├── Subtask.java
│   │   │   ├── RoleEntity.java
│   │   │   ├── TaskStatusHistory.java
│   │   │   ├── TaskLog.java
│   │   │   ├── TaskComment.java         # Görev yorumları
│   │   │   ├── TaskLabel.java           # Görev etiketleri (task_type'ın yerini aldı)
│   │   │   ├── Notification.java        # Kullanıcı bildirimleri
│   │   │   ├── SavedFilter.java         # Kullanıcı başına kaydedilmiş arama/filtre
│   │   │   ├── RevokedToken.java        # Blacklist'lenen JWT (SHA-256 hash, DB)
│   │   │   ├── RefreshToken.java        # Kalıcı refresh token (SHA-256 hash, DB)
│   │   │   ├── SystemLog.java
│   │   │   ├── LoginAttempt.java
│   │   │   ├── LdapSettings.java
│   │   │   └── enums/
│   │   │       ├── TaskStatus.java      # OPEN, IN_PROGRESS, TESTING, COMPLETED, CANCELLED
│   │   │       ├── TaskType.java        # TASK, FEATURE, BUG, IMPROVEMENT, RESEARCH, DOCUMENTATION, TEST, MAINTENANCE, MEETING
│   │   │       ├── NotificationType.java # TASK_ASSIGNED, TASK_STATUS_CHANGED, TASK_DUE_SOON, COMMENT_MENTION, COMMENT_ON_TASK
│   │   │       ├── Priority.java        # NORMAL, HIGH, URGENT
│   │   │       ├── ProjectStatus.java   # ACTIVE, COMPLETED, ON_HOLD, CANCELLED
│   │   │       └── Role.java            # ADMIN, BIRIM_AMIRI, YAZILIMCI, DEVOPS, IS_ANALISTI, TESTCI
│   │   ├── repository/          # Spring Data JPA repositories
│   │   ├── service/             # Business logic services
│   │   ├── config/              # SecurityConfig, JwtConfig, CacheConfig, LdapConfig, SampleDataInitializer
│   │   ├── security/            # JWT filter, entry point, token hashing
│   │   │   ├── JwtAuthenticationFilter.java
│   │   │   ├── JwtAuthenticationEntryPoint.java
│   │   │   └── TokenHashUtil.java        # SHA-256 hashing for stored tokens
│   │   └── aspect/              # AOP aspects
│   │       └── LoggingAspect.java     # Automatic controller method logging
│   ├── src/main/resources/
│   │   ├── application.yml              # Main configuration
│   │   └── db/changelog/
│   │       ├── db.changelog-master.xml  # Liquibase master changelog
│   │       └── changes/                 # Individual migration files (V1–V27)
│   ├── Dockerfile
│   └── pom.xml
├── Frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── ldap_test/                   # LDAP test environment
│   ├── docker-compose.yml
│   ├── init-users.sh
│   └── README.md
├── docker-compose.yml           # Main Docker Compose
├── docs/                        # This documentation
├── todo/                        # Development planning
└── README.md
```

---

## Design Patterns & Principles

### Layered Architecture
The backend follows a strict layered architecture:

```
Controller (REST API) → Service (Business Logic) → Repository (Data Access) → Database
     ↑                       ↑                          ↑
   DTOs                   Entities                 JPA Queries
```

- **Controllers** handle HTTP requests, input validation, and response formatting
- **Services** contain all business logic, authorization checks, and entity-DTO mapping
- **Repositories** extend `JpaRepository` with custom JPQL/native queries

### Key Design Decisions

1. **Stateless Authentication (JWT)**: No server-side sessions. Each request carries a JWT token, enabling horizontal scaling without sticky sessions.

2. **Soft Delete**: Users and Teams use an `isActive` boolean flag instead of hard delete, preserving referential integrity and audit trails.

3. **Database-Driven LDAP Config**: LDAP settings are stored in the database (not config files), allowing runtime changes without restarting the application.

4. **Hybrid Auth**: LDAP authentication is tried first; if it fails or is disabled, local user authentication is attempted. This allows mixed environments.

5. **AES-256-GCM Encrypted Secrets**: Sensitive data like LDAP bind passwords are encrypted at rest using AES/GCM/NoPadding with a PBKDF2WithHmacSHA256-derived key (random 12-byte IV per value, `GCM:` prefix). Legacy AES/ECB values remain decryptable for backward compatibility and are transparently upgraded on next write. See [Authentication](./authentication.md#encryption-service).

6. **Stateless JWT + Refresh Tokens**: A short-lived access token (24h) is paired with a rotating refresh token (7d). Logout blacklists the access token and invalidates the refresh token; both stores are **database-backed** (`revoked_tokens` / `refresh_tokens`, SHA-256 hashed) so revocation survives restarts and works across instances. The `userDetails` cache (5 min) avoids a DB hit on every authenticated request.

7. **Liquibase Migrations**: All schema changes are version-controlled through Liquibase XML changelogs, ensuring repeatable deployments.

8. **Smart AOP Logging**: The `LoggingAspect` uses a selective logging strategy — only **write operations** (POST/PUT/DELETE) and **errors** are persisted to the database. Read-only requests (GET) are logged to console only at DEBUG level. Health check endpoints are excluded entirely. Logging failures are handled gracefully — if the database is unavailable, log writes fail silently to the console logger without affecting the actual API response. A `LogCleanupService` automatically purges old entries (system logs: 30 days, task logs: 90 days).

9. **Rate Limiting**: IP-based rate limiting and account lockout backed by the `login_attempts` database table via `LoginAttemptService` (configurable thresholds/windows), preventing brute-force attacks.

10. **Connection Pool (HikariCP)**: The database connection pool is configured with keepalive probes, connection validation, and leak detection to ensure resilient database connectivity. Dead connections are automatically evicted and replaced.

11. **Excel Reporting**: `ReportService` aggregates performance, productivity, unit-comparison and process-duration metrics with SQL, and Apache POI generates downloadable `.xlsx` exports.

---

## Entity Relationship Overview

```
User ──M:N── RoleEntity        (user_roles join table)
User ──M:N── Team              (user_teams join table)
Team ──1:N── Task
Team ──1:1── User (leader)
Task ──M:1── User (createdBy)
Task ──M:N── User (assignees)  (task_assignees join table)
Task ──M:N── TaskLabel         (task_label_assignments join table)
Task ──1:N── Subtask
Task ──1:N── TaskStatusHistory
Task ──1:N── TaskComment
Task ──M:1── Project (optional)
Project ──M:N── Team           (project_teams join table)
Project ──M:1── User (createdBy)
Project ──M:1── User (manager, optional)
SavedFilter ──M:1── User (owner)
Subtask ──M:1── User (assignee, optional)
TaskStatusHistory ──M:1── User (changedBy)
TaskComment ──M:1── User (author)
TaskComment ──M:N── User (mentions, task_comment_mentions join table)
TaskLog ──M:1── Task (nullable, preserved on delete)
TaskLog ──M:1── User (changedBy)
SystemLog ──M:1── User (optional)
Notification ──M:1── User (recipient)
Notification ──M:1── User (actor, optional)
Notification ──M:1── Task (optional)
Notification ──M:1── TaskComment (optional)
```

---

## Service Layer Summary

| Service | Responsibility |
|---------|---------------|
| `TaskService` | Task CRUD, filtering by team/year/month/project, status transitions, overdue detection |
| `ProjectService` | Project CRUD, team assignments, task linking |
| `TeamService` | Team retrieval, access control checks |
| `UserService` | User profile updates, password changes |
| `AdminService` | Admin operations: user/team/role CRUD, soft delete |
| `LdapAuthService` | LDAP authentication, hybrid auth (LDAP → Local fallback) |
| `LdapSettingsService` | LDAP config management with AES-256 encryption |
| `LdapImportService` | Search LDAP directory, import users into local DB |
| `JwtService` | JWT access token generation, validation, claims extraction |
| `RefreshTokenService` | Refresh token issue/rotate/invalidate — DB-backed (`refresh_tokens`, SHA-256 hashed, 7-day TTL, rotate-on-use, hourly cleanup) |
| `TokenBlacklistService` | Revoked access tokens on logout — DB-backed (`revoked_tokens`, SHA-256 hashed, hourly cleanup); checked on every request |
| `UserDetailsServiceImpl` | Spring Security `UserDetailsService` implementation — `@Cacheable("userDetails")`, evicted on user update/delete/logout |
| `SearchService` | Global search across tasks, projects, users (PostgreSQL full-text + trigram), access-filtered |
| `SavedFilterService` | Per-user saved search/filter CRUD (max 20 per user, ownership-checked) |
| `TaskLabelService` | Team-scoped task label search/lookup |
| `ReportService` | Performance / productivity / unit-comparison / process-duration aggregation + Apache POI Excel export |
| `DashboardService` | Team statistics, leaderboard data — Caffeine cached (5 min TTL), team-targeted eviction on task mutations |
| `NotificationService` | In-app notification create/query/mark-read/delete; dedup within 60s window |
| `TaskDueSoonNotifier` | Scheduled job (every day 08:00) — produces `TASK_DUE_SOON` notifications |
| `TaskCommentService` | Comment CRUD on tasks; triggers `COMMENT_MENTION` / `COMMENT_ON_TASK` notifications |
| `RoleService` | Role CRUD operations |
| `SystemLogService` | System log recording and querying (backend + frontend) |
| `TaskLogService` | Task operation audit logging |
| `LoginAttemptService` | Rate limiting, account lockout tracking |
| `SystemHealthService` | Health checks for backend, database, and frontend |
| `EncryptionService` | AES-256 encrypt/decrypt for sensitive data |
| `LogCleanupService` | Scheduled job to purge old system_logs (30d) and task_logs (90d) |
| `OverdueTaskService` | Scheduled job to detect and mark overdue tasks |

# Authentication & Security

## Overview

TORA uses a **hybrid authentication system** combining LDAP and local user authentication, secured with **JWT (JSON Web Tokens)** for stateless session management.

---

## Authentication Flow

```
Client                    Backend                     LDAP Server
  │                         │                              │
  ├─ POST /api/auth/login ─►│                              │
  │   {username, password}  │                              │
  │                         │                              │
  │                         ├── Check rate limit ──────────┤
  │                         │   (IP-based, Bucket4j)       │
  │                         │                              │
  │                         ├── Is LDAP enabled? ──────────┤
  │                         │   (check DB settings)        │
  │                         │                              │
  │                    [If LDAP enabled]                    │
  │                         ├── LDAP bind + search ───────►│
  │                         │                              │
  │                    [If LDAP succeeds]                   │
  │                         ├── Sync user to local DB      │
  │                         │                              │
  │                    [If LDAP fails or disabled]          │
  │                         ├── Check local user (BCrypt)  │
  │                         │                              │
  │                         ├── Record login attempt ──────┤
  │                         │                              │
  │                    [If auth succeeds]                   │
  │                         ├── Generate JWT + refresh tok │
  │◄ 200 {token,refreshToken,user} ┤                       │
  │                         │                              │
  │                    [If auth fails]                      │
  │◄── 401 Unauthorized ───┤                              │
```

---

## JWT Token

### Access Token Structure
- **Algorithm**: HMAC-SHA256 (HS256)
- **Expiration**: 24 hours (configurable via `JWT_EXPIRATION`)
- **Claims**: `sub` (username), `roles`, `userId`, `iat`, `exp`

### Token Usage
Include the token in every API request:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIs...
```

### Token Validation
The `JwtAuthenticationFilter` intercepts every request:
1. Extracts token from `Authorization` header
2. Validates signature and expiration
3. Checks the token against the `TokenBlacklistService` (rejects revoked tokens)
4. Loads `UserDetails` (served from the `userDetails` Caffeine cache, 5 min TTL — avoids a DB hit per request)
5. Sets `SecurityContext` for the request

### Refresh Tokens

Login returns both an access token and a **refresh token**:
- Managed by `RefreshTokenService`, persisted in the `refresh_tokens` table (7-day TTL, **rotate-on-use**)
- Only the **SHA-256 hash** of the token is stored (`TokenHashUtil`), never the raw value
- `POST /api/auth/refresh` exchanges a valid refresh token for a new access token **and** a new refresh token (the old one is deleted)
- The frontend refreshes proactively (~5 min before expiry) and reactively on a 401

### Logout / Token Revocation

`POST /api/auth/logout`:
- Adds the current access token (SHA-256 hash + its JWT expiry) to the `revoked_tokens` table via `TokenBlacklistService`, so it cannot be reused before its natural expiry
- Invalidates the supplied refresh token (row deleted)
- Evicts the user from the `userDetails` cache

> **Persistence:** Both the blacklist and refresh-token stores are **database-backed** (migration V28), so revocations survive a backend restart and are shared across multiple instances. Expired rows are purged hourly by scheduled jobs. (A future move to Redis remains optional.)

---

## LDAP Authentication

### How It Works
1. Admin configures LDAP settings via the admin panel (stored in `ldap_settings` table)
2. LDAP password is encrypted with AES-256 before storage
3. When a user logs in, the system:
   - Reads LDAP config from the database (no restart needed)
   - Performs LDAP bind with admin credentials
   - Searches for the user using the configured filter
   - Attempts to bind with the user's credentials
   - If successful, syncs the user to the local `users` table

### LDAP Configuration Fields
| Field | Example | Description |
|-------|---------|-------------|
| URLs | `ldap://ldap-server:389` | LDAP server URL |
| Base | `dc=company,dc=com` | Base DN for searches |
| Username | `cn=admin,dc=company,dc=com` | Admin bind DN |
| Password | `adminpassword` | Admin bind password (AES-256 encrypted) |
| User Search Base | `ou=users` | OU to search within |
| User Search Filter | `(uid={0})` | Filter pattern (`{0}` = username) |
| Is Enabled | `true/false` | Toggle LDAP on/off |

### Security Measures
- LDAP injection prevention: Input sanitization on search filters
- Password never stored for LDAP users (only local users have passwords)
- LDAP admin password encrypted at rest with AES-256

---

## Local User Authentication

- Passwords are hashed with **BCrypt** before storage
- Admin can create local users via the admin panel or `/api/auth/register`
- LDAP users who are imported have `ldapDn` set and `password` as NULL

---

## Role-Based Access Control (RBAC)

### Role Hierarchy

```
ADMIN (Full Access)
  └── BIRIM_AMIRI (Department Head)
       └── Staff Roles (YAZILIMCI, DEVOPS, IS_ANALISTI, TESTCI)
```

### Permission Matrix

| Resource | ADMIN | BIRIM_AMIRI | Staff |
|----------|-------|-------------|-------|
| View all teams | ✅ | Only led teams | Only member teams |
| View all tasks | ✅ | Team tasks only | Assigned tasks only |
| Create tasks | ✅ | Own teams | Own teams |
| Edit any task | ✅ | Own team tasks | Own tasks only |
| Delete tasks | ✅ | Own team tasks | ❌ |
| View dashboards | ✅ All | Own teams | Own teams |
| Admin panel | ✅ | ❌ | ❌ |
| User management | ✅ | ❌ | ❌ |
| Team management | ✅ | ❌ | ❌ |
| LDAP settings | ✅ | ❌ | ❌ |
| View system logs | ✅ | ❌ | ❌ |
| View task logs | ✅ | ❌ | ❌ |
| System health | ✅ | ✅ | ❌ |
| Change own profile | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ |

### Available Roles
| Role | Description |
|------|-------------|
| `ADMIN` | Full system administrator with access to everything |
| `BIRIM_AMIRI` | Department head, can manage their team's tasks and members |
| `YAZILIMCI` | Software developer |
| `DEVOPS` | DevOps engineer |
| `IS_ANALISTI` | Business analyst |
| `TESTCI` | QA / Tester |

Users can have **multiple roles** (many-to-many relationship).

---

## Rate Limiting

### IP-Based Rate Limiting
- **Technology**: `LoginAttemptService` backed by the `login_attempts` database table (counts recent attempts per IP/username within the window). `bucket4j-core` is on the classpath but not used for this.
- **Default limit**: 5 attempts per 15-minute window
- **Scope**: Login endpoint only
- **Configuration**:
  - `RATE_LIMIT_MAX_ATTEMPTS`: Max attempts per IP (default: 5)
  - `RATE_LIMIT_WINDOW_MINUTES`: Time window in minutes (default: 15)

> **Client IP resolution:** `getClientIpAddress()` uses the non-spoofable `X-Real-IP` header (set by the bundled nginx to `$remote_addr`), falling back to the socket address. The client-supplied `X-Forwarded-For` is **not** trusted, because its first element is attacker-controlled and was previously usable to bypass rate limiting / account lockout.

### Account Lockout
- **Default threshold**: 10 failed attempts
- **Lockout duration**: 30 minutes
- **Configuration**:
  - `ACCOUNT_LOCKOUT_MAX_ATTEMPTS`: Max failed attempts (default: 10)
  - `ACCOUNT_LOCKOUT_DURATION_MINUTES`: Lockout duration (default: 30)

### Login Attempt Tracking
Every login attempt (success or failure) is recorded in the `login_attempts` table with:
- Username
- IP address
- Timestamp
- Success/failure flag

---

## Security Configuration

### Spring Security Filter Chain

```
Request
  │
  ├── CORS Filter (configured allowed origins)
  │
  ├── JwtAuthenticationFilter
  │   ├── Extract token from Authorization header
  │   ├── Validate token signature & expiration
  │   └── Set SecurityContext
  │
  ├── Authorization
  │   ├── /api/auth/login, /api/auth/refresh → permitAll
  │   ├── /health, /actuator/health → permitAll
  │   ├── /api/admin/** → hasRole(ADMIN) (method-level @PreAuthorize)
  │   └── /** → authenticated  (incl. /api/auth/logout, /api/auth/me, /api/auth/register)
  │
  └── Session: STATELESS (no server-side sessions)
```

> Method-level `@PreAuthorize` (e.g. `hasRole('ADMIN')` on admin/LDAP endpoints, `register`) provides the fine-grained role checks on top of the URL rules above.

### HTTP Security Headers

Configured in `SecurityConfig`:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (1 year) |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'` |

### CORS Configuration
- Allowed origins configurable via `CORS_ALLOWED_ORIGINS` (mapped to `app.cors.allowed-origins`)
- Default: `*` (uses `allowedOriginPatterns("*")`, **development only**)
- **Production warning:** when `ENFORCE_SECRET_VALIDATION=true` and origins are `*`, the app logs a loud warning at startup recommending an explicit origin list (it still starts — wildcard without credentials is low-risk)
- `allowCredentials(false)` — auth is carried in the `Authorization` header (bearer tokens), not cookies, so credentialed CORS is unnecessary and the unsafe `*`+credentials reflection is avoided
- Methods `GET/POST/PUT/DELETE/OPTIONS`, `Authorization` exposed

### Password Security
- **Local users**: BCrypt (Spring Security default, 10 rounds)
- **LDAP bind password**: AES-256-GCM encryption (stored in `ldap_settings.password_encrypted`)
- **Encryption key**: Configurable via `ENCRYPTION_KEY` + `ENCRYPTION_SALT` env vars (key min 32 characters)

---

## Encryption Service

The `EncryptionService` provides authenticated AES-256 encryption for sensitive data (LDAP bind password):

- **Algorithm**: `AES/GCM/NoPadding` (AES-256-GCM, 128-bit auth tag)
- **Key derivation**: `PBKDF2WithHmacSHA256` — 65 536 iterations, 256-bit key, salt from `ENCRYPTION_SALT`
- **IV**: Random 12-byte IV generated per encryption, prepended to the ciphertext
- **Storage format**: `GCM:` prefix + Base64(`IV || ciphertext+tag`)
- **Backward compatibility**: Values without the `GCM:` prefix are decrypted with the legacy `AES/ECB` scheme and transparently re-encrypted to GCM on the next update
- **Key management**: `ENCRYPTION_KEY` env var (min 32 chars) + `ENCRYPTION_SALT` env var

### Startup Secret Validation

Both `JwtConfig` and `EncryptionService` run a `@PostConstruct` check. When `ENFORCE_SECRET_VALIDATION=true` (the default), the application **refuses to start** if `JWT_SECRET` or `ENCRYPTION_KEY` are left at their known default values. Set `ENFORCE_SECRET_VALIDATION=false` only for local development.

> **Important**: In production, set strong random `JWT_SECRET`, `ENCRYPTION_KEY`, and `ENCRYPTION_SALT` values (e.g. `openssl rand -base64 32` / `openssl rand -base64 16`).

---

## Automatic Logging (AOP)

The `LoggingAspect` uses a **smart logging strategy** that balances audit trail completeness with database performance:

### What Gets Logged to Database

| HTTP Method | Logged to DB? | Reason |
|-------------|---------------|--------|
| `POST` | Yes | Creates new resources — important for audit |
| `PUT` | Yes | Modifies existing resources — important for audit |
| `DELETE` | Yes | Removes resources — critical for audit |
| `GET` | No (console only) | Read-only, high volume, no audit value |
| `HEAD` / `OPTIONS` | No (console only) | Utility requests, no audit value |
| Any method that **fails** | Yes | All errors are logged regardless of HTTP method |

Additional features:
- **Sensitive data masking**: Passwords, tokens, and secrets are automatically masked in logs
- Successful write operations are stored in the `system_logs` table with source `BACKEND` and level `INFO`
- Failed requests (any method) are stored with level `ERROR`
- Read-only requests are logged at `DEBUG` level to the console/file logger only

### Excluded Endpoints

The following controllers are **completely excluded** from AOP logging (both DB and console):

| Controller | Reason |
|------------|--------|
| `HealthController` | Called every 30s by Docker health check |
| `SystemHealthController` | Same as above, detailed health endpoint |
| `SystemLogController` | Logging the log viewer would create infinite loops |
| `TaskLogController` | Logging the audit viewer would create noise |

### Fault Tolerance

Logging is wrapped in a `safeLog()` method that catches all exceptions. If the database is temporarily unavailable:
- The log write silently falls back to the console logger (`slf4j`)
- The original API response is **not affected** — users will not see errors caused by logging failures
- Once the database recovers, subsequent log writes resume automatically

This prevents a common cascading failure pattern where a database outage causes all API endpoints to fail because the AOP logging aspect cannot write to the database.

### Log Retention & Cleanup

The `LogCleanupService` runs automatically every day at 02:30 AM and removes old log entries:

| Table | Retention Period | Configurable Via |
|-------|-----------------|------------------|
| `system_logs` | 30 days (default) | `LOG_RETENTION_SYSTEM_DAYS` |
| `task_logs` | 90 days (default) | `LOG_RETENTION_TASK_DAYS` |
| `login_attempts` | 24 hours | Hardcoded in `LoginAttemptService` |

This ensures the database does not grow indefinitely while keeping recent logs available for troubleshooting and auditing.

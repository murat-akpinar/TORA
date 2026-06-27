# TORA — Claude Instructions

## Stack

- **Backend:** Java 17, Spring Boot 3.2, Spring Security 6, JPA/Hibernate, PostgreSQL 15, Liquibase, jjwt 0.12.3, Bucket4j, LDAP, Maven
- **Frontend:** React 18, TypeScript, Vite, Axios, date-fns
- **Infra:** Docker Compose, Nginx

## Critical Constraints

- Do not reorder or create conflicting IDs in Liquibase migration files (`Backend/src/main/resources/db/changelog/`).
- JWT secret and LDAP password must come from environment variables — never hardcode in source.
- Spring Security role hierarchy: `ADMIN > BIRIM_AMIRI > USER` — endpoint protection must not be bypassed.
- For `OPTIMIZATIONS.md` and security findings: write only, do not apply fixes.

## Custom Rules (Triggers)

| Trigger | Rule File |
|---|---|
| `@optimize` | `.rules/optimization.md` |
| `@security` | `.rules/security.md` |
| `@agents` | `.rules/agents.md` |

When a trigger appears, read the corresponding `.rules/` file and apply its instructions.

## Build & Validation

```bash
docker compose up --force-recreate -d
```

## Ev Sunucusu Deploy (Remote)

Proje, ev sunucusunda SSH üzerinden ayağa kaldırılır.

- **Sunucu:** `ssh vaultscan` (192.168.1.131), kullanıcı `root`, Proxmox host (Docker doğrudan host üzerinde).
- **Deploy dizini:** `/opt/TORA`
- **Portlar:** Frontend `81`, Backend `8081`, PostgreSQL `127.0.0.1:5432`. (Sunucuda ayrıca `dockscan` stack'i 3017/3018'de çalışır — çakışma yok.)
- **`.env` git'te yoktur** (gitignore) — kod taşırken ayrıca gönderilmelidir.

Kodu taşıma (yerel çalışma ağacını, commit edilmemiş değişiklikler dahil, gönderir):

```bash
tar czf - --exclude='./.git' --exclude='./Frontend/node_modules' \
  --exclude='./Backend/target' --exclude='./images' --exclude='./ldap_test' \
  --exclude='./.claude' . \
  | ssh vaultscan 'mkdir -p /opt/TORA && tar xzf - --no-same-owner -C /opt/TORA'
```

Build & başlatma:

```bash
ssh vaultscan 'cd /opt/TORA && docker compose build --no-cache && docker compose up -d'
# Hızlı kod güncellemesi (DB korunur): ssh vaultscan 'cd /opt/TORA && ./build.sh --app'
```

Erişim: `http://192.168.1.131:81` (frontend), `http://192.168.1.131:8081` (backend API).

## Documentation Update Rules

After every completed feature, refactor, bugfix, or architectural change, review and update the relevant files below. Do not skip this step.

**README.md** — update when:
- Setup steps, environment variables, or run commands changed
- New feature added that affects user-facing behavior
- API or architecture changed

**docs/\*.md** — update or create when:
- New module or service added
- Internal architecture, workflow, or deployment changed
- Database schema changed (new Liquibase migration)
- New integration added

**todo/todo.md** — always update when:
- A planned item or security finding is implemented/closed → mark `[x]` and add a short **Düzeltme:**/result note
- A structural change adds new work or makes a listed item obsolete

> **Structural changes (new table/migration, new service/controller, auth/security/config changes, schema or API changes): updating `docs/` AND `todo.md` is mandatory, in the same change — never defer it.**

## Kod Yorumları / Code Comments

- **Kod içine uzun, satır satır açıklayıcı yorum yazma.** "Bu kod şunu yapar" tarzı açıklamalardan kaçın; kod kendini anlatsın.
- Sadece **bölüm/alan başlıklarını banner ile işaretle** — açılışta ve bitişte kapanış koy. Örnek:

  ```
  // ───────────────── FRONTEND ─────────────────
  ... kod ...
  // ───────────────── /FRONTEND ────────────────
  ```

- İstisna: gerçekten gerekli olan **kısa, tek satırlık** "neden/dikkat" notları (bir satırı geçmeyen). Gereksiz "ne yaptığını" anlatan yorumlar yok.

## Development Notes

- State management: React Context + local state (no Redux)
- Auth flow: LDAP attempted first → falls back to local user on failure
- Sidebar state: persisted in `localStorage`
- All API requests use `/api/**` prefix, proxied through Nginx

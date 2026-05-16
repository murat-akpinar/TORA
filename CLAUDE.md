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

## Development Notes

- State management: React Context + local state (no Redux)
- Auth flow: LDAP attempted first → falls back to local user on failure
- Sidebar state: persisted in `localStorage`
- All API requests use `/api/**` prefix, proxied through Nginx

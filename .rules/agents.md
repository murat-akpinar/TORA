---
rule: agents
trigger: "@agents" or any AGENTS.md creation / update task
scope: repository-level agent instruction file
output: write only the final AGENTS.md content — no commentary, no preamble
---

# AGENTS.md Generator

Act as an expert repository workflow editor.
**Primary goal: signal density.** Short and critical. Not long — correct.

## Core Principles

- Be minimal. Shorter > longer if critical constraints are preserved.
- Do not include anything derivable from the codebase, README, or standard tooling.
- Use "must / must not" — not vague recommendations.
- No generic best practices ("write clean code", "handle errors").
- Do not document rules already enforced by tooling (linters, formatters, CI) unless there is a known exception.

## AGENTS.md SHOULD contain (if applicable)

- Critical repo-specific safety constraints (migrations, API contracts, secrets, compatibility)
- Required validation commands before finishing (test/lint/typecheck/build) — only ones actually in use
- Non-obvious workflow constraints (Maven-only build, Liquibase migration order, Docker startup dependency)
- Repo conventions agents routinely miss
- Important file locations (non-obvious only)
- Change-safety expectations (backward compat, breaking change rules)
- Known gotchas that have caused repeated mistakes

## AGENTS.md MUST NOT contain

- README replacement content
- Architecture deep-dives (unless required to avoid breakage)
- Generic coding philosophy
- Long examples (unless capturing a critical non-obvious pattern)
- Duplicated rules
- Aspirational rules not enforced by the team
- Stale, uncertain, or "nice to know" content

## Project-Specific Context (reference when writing AGENTS.md)

**Stack:** Java 17 + Spring Boot 3.2 + Maven / React 18 + TypeScript + Vite / PostgreSQL 15 + Liquibase / Docker Compose

**Critical constraints:**
- Liquibase migration files live in `Backend/src/main/resources/db/changelog/` — ordering and IDs must not conflict
- JWT secret and LDAP password via environment variable only — never commit to source
- `BIRIM_AMIRI` and `ADMIN` endpoints are separately guarded in Spring Security config — role checks must not be skipped
- Frontend build: `npm run build` → `dist/` → served by Nginx
- Backend build: `mvn package -DskipTests` (Docker) or `mvn test` (CI)
- Full stack: `docker-compose up --build`

## Output Requirements

- Output ONLY the AGENTS.md content (no commentary, analysis, or preface).
- Use concise Markdown.
- Keep sections tight and skimmable.
- Prefer bullets over paragraphs.
- If information is missing or uncertain, omit it — do not invent.
- If a section has no high-signal content, omit the section.
- Aim for the shortest document that still prevents major mistakes.

## Preferred Structure

```markdown
# AGENTS.md
## Must-follow constraints
## Validation before finishing
## Repo-specific conventions
## Important locations (only non-obvious)
## Change safety rules
## Known gotchas (optional)
```

## Rewrite Mode

When given an existing AGENTS.md:
- Aggressively remove low-value or generic content
- Deduplicate overlapping rules
- Rewrite vague language into explicit action rules
- Preserve truly critical project-specific constraints
- Shorten relentlessly without losing important meaning

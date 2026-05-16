---
rule: optimization
trigger: "@optimize" or at the start of a performance/optimization task
scope: Backend (Spring Boot 3.2 / JPA / PostgreSQL 15) + Frontend (React 18 / TypeScript / Vite)
output: Write to OPTIMIZATIONS.md only — do not apply fixes
---

# Optimization Auditor

Act as a senior optimization engineer. Find real bottlenecks — do not speculate without evidence.

## Output Format (preserve order)

### 1) Optimization Summary
- Current optimization health
- Top 3 highest-impact improvements
- Biggest risk if no changes are made

### 2) Findings (prioritized)

For each finding:

| Field | Value |
|---|---|
| **Title** | |
| **Category** | CPU / Memory / I/O / DB / Algorithm / Frontend / Caching / Reliability |
| **Severity** | Critical / High / Medium / Low |
| **Impact** | latency / throughput / memory / cost |
| **Evidence** | File:line, query, loop, render path |
| **Why inefficient** | |
| **Recommended fix** | |
| **Tradeoffs** | |
| **Estimated impact** | % or qualitative |
| **Removal safety** | Safe / Likely Safe / Needs Verification |

### 3) Quick Wins — do these first (low effort / high impact)

### 4) Deeper Optimizations — do these next (architectural / large refactors)

### 5) Validation Plan
- Benchmark command / profiling strategy
- Before/after metrics
- Test cases to preserve correctness

### 6) Patch / Snippet (if applicable)

---

## Project-Specific Checklist

### Backend — Spring Boot / JPA / PostgreSQL

- **N+1 queries**: Lazy-loaded `@OneToMany` / `@ManyToMany` triggering per-entity selects; missing `JOIN FETCH` or `@EntityGraph`
- **SELECT \***: Entity returned where DTO projection suffices; missing `new DTO(...)` in `@Query`
- **Unbounded queries**: `findAll()` without `Pageable`; no pagination limit
- **HikariCP config**: `maximumPoolSize`, `connectionTimeout`, `keepaliveTime` — verify production values
- **Liquibase migration**: Adding columns without indexes on large tables; lock risk
- **JWT validation**: Re-parsing and verifying token on every request with no request-scoped cache
- **LDAP queries**: LDAP call on every authentication; are results cached?
- **Bucket4j rate limiting**: In-memory bucket vs. distributed cache — horizontal scaling sync issue
- **@Transactional boundary**: Transaction held open longer than necessary; transaction leaking outside service layer
- **Repeated entity loads**: Same entity fetched multiple times within a single request

### Frontend — React / TypeScript / Vite

- **Unnecessary re-renders**: Context value object recreated on every render; missing `useMemo`
- **useEffect dependencies**: Missing or incorrect dependency array → infinite loop / stale closure
- **Chatty API calls**: Sequential `axios` calls on component mount that could be parallelized
- **Bundle size**: `import * as X` instead of named imports; heavy libraries (e.g. moment.js)
- **date-fns**: `format()` called on every render without memoization
- **Kanban / Gantt render**: No virtualization for large task lists
- **LocalStorage**: Sidebar state re-read and parsed on every mount unnecessarily

### DB / Query

- Missing indexes on: `task.due_date`, `task.team_id`, `task.project_id`, `task.status` — filter/sort columns
- Repeated `COUNT(*)` on dashboard; candidate for materialized view or cache
- Calendar query: does the year/month filter use an index?

### Caching

- LDAP results: Spring Cache (`@Cacheable`) or Redis
- Dashboard aggregates: TTL-based cache for infrequently changing stats
- JWT claims: are parsed claims stored in request scope to avoid re-parsing?

### Reliability

- Retry / timeout: LDAP connection timeout misconfigured → slow auth under failure
- Connection pool exhaustion: HikariCP timeout behavior under heavy load
- Async processing: large exports (if any) running synchronously on request thread

---

## Rules

- If there is no concrete evidence, label it **"likely"** and specify what to measure.
- Do not recommend micro-optimizations with low ROI.
- Never sacrifice correctness; state the tradeoff explicitly if you do.
- Write findings to `OPTIMIZATIONS.md` only — do not fix anything.

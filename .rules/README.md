# .rules

Token-efficient, project-specific instruction files for Claude Code.
Each file covers a single task — only load what the current task requires.

## Files & Usage

| File | Trigger | When to use |
|---|---|---|
| `optimization.md` | `@optimize` | Performance analysis / bottleneck audit |
| `security.md` | `@security` | Pre-commit or PR security review |
| `agents.md` | `@agents` | Creating or updating `AGENTS.md` |

## How to use

Type in the conversation:

```
@optimize  → applies .rules/optimization.md
@security  → applies .rules/security.md
@agents    → applies .rules/agents.md
```

Or just describe the task naturally:

```
"Find performance issues in this service"  → optimization.md
"Review this PR for security issues"       → security.md
"Create an AGENTS.md for the project"      → agents.md
```

## Token savings vs. promt.txt

- `promt.txt`: 300 lines, all rules loaded every session
- Each rule here: ~80-100 lines, project-specific, loaded only when relevant
- No generic advice — only Spring Boot / React / PostgreSQL specific checks

# Working Agreement

How we build Train of Thoughts together — human-led, step-by-step, documented.

**Related docs:** [BUILD_LOG.md](BUILD_LOG.md) · [CHALLENGES.md](CHALLENGES.md) · [PROJECT_BRIEF.md](architecture/PROJECT_BRIEF.md)

---

## Principles

1. **One layer per session** — DB, backend, or frontend; not all three at once unless you explicitly ask.
2. **You steer, agent executes** — You give the next step; the agent proposes commands/files, then runs them after you confirm (especially while learning).
3. **Toolchain is yours** — Python **3.12+** via **pyenv**; Node **20+** via **nvm**. The agent does not install system Python/Node without your say-so.
4. **Plans before code** — Layer plans live in `tot-*/TOT_*.md`. The build log records what we actually did.
5. **Log at the end** — Each session gets one [BUILD_LOG](BUILD_LOG.md) entry; errors worth remembering go in [CHALLENGES](CHALLENGES.md).

---

## Session workflow

```text
You: request (scoped to one layer/phase)
  → Agent: propose steps (files + commands)
  → You: approve or adjust
  → Agent: execute
  → Agent: append BUILD_LOG entry + CHALLENGES if needed
  → You: verify locally
```

---

## Scope boundaries

| Layer | Path | Agent may scaffold | Defer to later phase |
|-------|------|--------------------|----------------------|
| DB | `tot-db/` | migrations, migrate script, Docker Postgres | `002_functions.sql` = Phase 1 |
| Backend | `tot-backend/` | `/health`, pool, config, tests | auth, CRUD routes = Phase 2 |
| Frontend | `tot-frontend/` | Vite hello + `/health` call | Router, TanStack Query = Phase 3 |

---

## Commands — who runs what

| Action | Who |
|--------|-----|
| `pyenv install`, `nvm install` | **You** (one-time toolchain) |
| `docker compose up`, migrations | Agent or you (your preference per session) |
| `python -m venv`, `pip install` | Agent after venv uses **pyenv 3.12** |
| `nvm use`, `npm install` | Agent in `tot-frontend` with nvm loaded |
| `git commit`, `git push` | **You** unless you explicitly ask the agent |

---

## Document conventions

All journal docs use an **index at the top**: each line is `[YYYY-MM-DD — short summary](#anchor-id)` (summary ≤ 50 words). Newest entry first.

### BUILD_LOG entry template

Copy this block to the index and to the body (newest at top of both):

```markdown
<!-- Index line -->
- [YYYY-MM-DD — Short summary under 50 words](#yyyy-mm-dd-short-slug)

<!-- Body -->
<a id="yyyy-mm-dd-short-slug"></a>

## YYYY-MM-DD — Title

**Request:** What you asked for.

**Scope:** tot-db | tot-backend | tot-frontend | root

**Who ran commands:** you | agent | both

**Steps:**
1. `command or action`
2. ...

**Files changed:** `path/a`, `path/b`

**Result:** ✅ | ⚠️ partial | ❌

**Verify:** How to confirm it worked.

**Next:** Suggested follow-up (optional).
```

### CHALLENGES entry template

```markdown
<!-- Index line -->
- [YYYY-MM-DD — Short summary under 50 words](#yyyy-mm-dd-short-slug)

<!-- Body -->
<a id="yyyy-mm-dd-short-slug"></a>

## YYYY-MM-DD — Title

**Symptom:** What you saw.

**Context:** Phase, layer, command.

**Cause:** Root cause.

**Fix:** What resolved it.

**Lesson:** One line to remember.
```

---

## Anchor ID rules

- Format: `yyyy-mm-dd-short-slug` (lowercase, hyphens, no spaces).
- Example: `2026-06-30-port-5432-conflict`
- Place `<a id="..."></a>` immediately before the `##` heading so links work in GitHub and VS Code.

---

## Agent mode reminder

When you switch to Agent mode, say the **scope** explicitly, e.g.:

> “Phase 0, tot-db only: start Docker and run migrations. Update BUILD_LOG when done.”

That keeps sessions small and the log accurate.

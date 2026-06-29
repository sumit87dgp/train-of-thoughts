# Working Agreement

How we build Train of Thoughts together — human-led, step-by-step, documented.

**Related docs:** [BUILD_LOG.md](BUILD_LOG.md) · [CHALLENGES.md](CHALLENGES.md) · [QUESTION_ANSWER.md](QUESTION_ANSWER.md) · [PROJECT_BRIEF.md](architecture/PROJECT_BRIEF.md)

---

## Principles

1. **One layer per session** — DB, backend, or frontend; not all three at once unless you explicitly ask.
2. **You steer, agent executes** — You give the next step; the agent proposes commands/files, then runs them after you confirm (especially while learning).
3. **Toolchain is yours** — Python **3.12+** via **pyenv**; Node **20+** via **nvm**. The agent does not install system Python/Node via `apt` or similar without your say-so.
4. **Plans before code** — Layer plans live in `tot-*/TOT_*.md`. The build log records what we actually did.
5. **Log at the end** — Each session gets one [BUILD_LOG](BUILD_LOG.md) entry; errors worth remembering go in [CHALLENGES](CHALLENGES.md); learning Q&A goes in [QUESTION_ANSWER](QUESTION_ANSWER.md).
6. **Verify before the next step** — Docker healthy → migrate → inspect (DBeaver / `psql`) → then the next layer. Do not stack unverified work.

---

## Current status (update as phases complete)

| Phase | Layer | Status |
|-------|-------|--------|
| 0 | Foundation | ⚠️ partial (DB + frontend scaffold; backend venv pending) |
| 1 | `tot-db` | ✅ complete (migrations `001`–`005`, functions, grants) |
| 2 | `tot-backend` | **Next** — CRUD over functions, JWT |
| 3 | `tot-frontend` | Pending |
| 4–5 | Hardening / Azure | Pending |

---

## Session workflow

```text
You: request (scoped to one layer/phase)
  → Agent: propose steps (files + commands)
  → You: approve or adjust (learning mode)
  → Agent: execute (only in-scope files)
  → Agent: append BUILD_LOG; CHALLENGES / QUESTION_ANSWER if needed
  → You: verify locally (DBeaver, curl, pytest, browser)
```

---

## Scope boundaries

| Layer | Path | In scope now | Out of scope until |
|-------|------|--------------|-------------------|
| DB | `tot-db/` | Forward migrations only; smoke tests as `tot_api` | Re-editing applied migrations; Azure CI migrate = Phase 5 |
| Backend | `tot-backend/` | Phase 2: Pydantic schemas, `app.*` callers, JWT, `/api/thoughts`, tests | Phase 4 logging/App Insights |
| Frontend | `tot-frontend/` | Phase 0 hello + `/health` only unless you ask for Phase 3 | TanStack Query, full CRUD UI = Phase 3 |
| Root | `docker-compose.yml`, `.env.example` | Touch only when the session needs infra | Unrelated refactors |

**Architecture constraints (all layers):** No ORM; backend calls `app.*` functions only with bound parameters; `DATABASE_URL_API` uses `tot_api`.

---

## Lessons from Phase 1 (`tot-db`) — keep doing this

1. **Forward migrations** — Do not change already-applied SQL files (`001`, `003` on existing DBs). Add `00N_*.sql`; `migrate.sh` skips applied versions.
2. **Migration order** — `001` schema → `002` tables → `003` roles → `004` functions → `005` function grants.
3. **Port** — Local Postgres is **5433** on the host (avoids host Postgres on 5432).
4. **Roles** — Migrations as `tot_owner`; running API as `tot_api` (EXECUTE on functions only).
5. **One session, one outcome** — e.g. “tables only”, then “functions only”, with DBeaver verification between.

---

## Which journal doc?

| Doc | Use when |
|-----|----------|
| [BUILD_LOG.md](BUILD_LOG.md) | A work session completed (request, steps, files, verify) |
| [CHALLENGES.md](CHALLENGES.md) | Something failed; root cause and fix worth remembering |
| [QUESTION_ANSWER.md](QUESTION_ANSWER.md) | Conceptual learning (Docker, roles, Postgres tree, etc.) |

Do not duplicate long tutorials in WORKING_AGREEMENT — link to Q&A instead.

---

## Commands — who runs what

| Action | Who |
|--------|-----|
| `pyenv install`, `nvm install` | **You** (one-time toolchain) |
| `docker compose up`, migrations | Agent or you (your preference per session) |
| `python -m venv`, `pip install` | Agent after `source .venv/bin/activate` with **pyenv 3.12** |
| `nvm use`, `npm install` | Agent in `tot-frontend` with nvm loaded |
| `git commit`, `git push` | **You** unless you explicitly ask the agent |

---

## Document conventions

All journal docs use an **index at the top**: each line is `[YYYY-MM-DD — short summary](#anchor-id)` (summary ≤ 50 words). Newest entry first.

### BUILD_LOG entry template

```markdown
- [YYYY-MM-DD — Short summary under 50 words](#yyyy-mm-dd-short-slug)

<a id="yyyy-mm-dd-short-slug"></a>

## YYYY-MM-DD — Title

**Request:**

**Scope:** tot-db | tot-backend | tot-frontend | root

**Who ran commands:** you | agent | both

**Steps:**
1.

**Files changed:**

**Result:** ✅ | ⚠️ | ❌

**Verify:**

**Next:**
```

### CHALLENGES entry template

```markdown
- [YYYY-MM-DD — Short summary under 50 words](#yyyy-mm-dd-short-slug)

<a id="yyyy-mm-dd-short-slug"></a>

## YYYY-MM-DD — Title

**Symptom:**

**Context:**

**Cause:**

**Fix:**

**Lesson:**
```

### QUESTION_ANSWER entry template

```markdown
- [YYYY-MM-DD — Short summary under 50 words](#yyyy-mm-dd-short-slug)

<a id="yyyy-mm-dd-short-slug"></a>

## YYYY-MM-DD — Title

**Question:**

**Answer:**

**Takeaway:**
```

---

## Anchor ID rules

- Format: `yyyy-mm-dd-short-slug` (lowercase, hyphens, no spaces).
- Place `<a id="..."></a>` immediately before the `##` heading.

---

## Cursor rules (local agent enforcement)

A draft Cursor rule derived from this agreement:

| File | In git? | Purpose |
|------|---------|---------|
| [CURSOR_RULES.mdc.example](CURSOR_RULES.mdc.example) | ✅ template | Clone-friendly source |
| `CURSOR_RULES.mdc` | ❌ gitignored | Your local copy (edit freely) |

**Install locally (once per machine):**

```bash
cp docs/CURSOR_RULES.mdc.example docs/CURSOR_RULES.mdc   # optional local copy
mkdir -p .cursor/rules
cp docs/CURSOR_RULES.mdc.example .cursor/rules/train-of-thoughts.mdc
```

Reload Cursor or start a new agent chat. After editing rules, re-copy to `.cursor/rules/`.

---

## Agent mode prompt (copy/paste pattern)

> Phase 2, **tot-backend** only: implement JWT + `GET/POST /api/thoughts` calling `app.*` functions. Propose steps first. Update BUILD_LOG when done. Do not touch tot-frontend or tot-db.

Explicit **scope**, **phase**, **logging**, and **out-of-scope layers** keep sessions small and accurate.

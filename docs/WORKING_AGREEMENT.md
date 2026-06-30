# Working Agreement

How we build Train of Thoughts together — human-led, step-by-step, documented.

**Related docs:** [BUILD_LOG.md](BUILD_LOG.md) · [CHALLENGES.md](CHALLENGES.md) · [QUESTION_ANSWER.md](QUESTION_ANSWER.md) · [PROJECT_BRIEF.md](architecture/PROJECT_BRIEF.md)

---

## Principles

1. **One layer per session** — DB, backend, or frontend; not all three at once unless you explicitly ask.
2. **You steer, agent executes** — You give the next step; the agent proposes commands/files, then runs them after you confirm (especially while learning).
3. **Toolchain is yours** — Python **3.10+** (`python3`); Node **20+** via **nvm**. The agent does not install system Python/Node via `apt` or similar without your say-so.
4. **Plans before code** — Layer plans live in `tot-*/TOT_*.md`. The build log records what we actually did.
5. **Log at the end** — Each session gets one [BUILD_LOG](BUILD_LOG.md) entry; errors worth remembering go in [CHALLENGES](CHALLENGES.md); learning Q&A goes in [QUESTION_ANSWER](QUESTION_ANSWER.md).
6. **Verify before the next step** — Docker healthy → migrate → inspect (DBeaver / `psql`) → then the next layer. Do not stack unverified work.
7. **Secrets stay out of git** — Committed `.env.example` (placeholders only); real values in `.env` (gitignored). See [environment files](#environment-files-and-secrets).

---

## Current status (update as phases complete)

| Project phase | Layer | Status |
|---------------|-------|--------|
| 0 | Foundation | ⚠️ partial — Docker, migrations, CI; **tot-backend 0–1 ✅**; frontend hello scaffold |
| 1 | `tot-db` | ✅ migrations `001`–`005`, functions, grants, smoke-tested as `tot_api` |
| 2 | `tot-backend` | **Next** — [TOT_BACKEND.md](../tot-backend/TOT_BACKEND.md) **Phase 2**: JWT + CRUD routes |
| 3 | `tot-frontend` | Pending (full UI) |
| 4–5 | Hardening / Azure | Pending |

**tot-backend internal phases** (see [TOT_BACKEND.md](../tot-backend/TOT_BACKEND.md)):

| Phase | Done? |
|-------|-------|
| 0 — Foundation (`/health`, pool, CORS) | ✅ verified |
| 1 — `test_db_functions.py` | ✅ 8 pytest (7 db + health) |
| 2 — Thin API (schemas, JWT, routes) | **Next** |
| 4–5 — Hardening / Azure | Pending |

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
| Backend | `tot-backend/` | **Phase 2:** Pydantic schemas, `db/thoughts.py`, JWT, `/api/thoughts`, API tests | Phase 4 logging/App Insights |
| Frontend | `tot-frontend/` | Phase 0 hello + `/health` only unless you ask for Phase 3 | TanStack Query, full CRUD UI = Phase 3 |
| Root | `docker-compose.yml`, `.env.example` | Touch only when the session needs infra | Unrelated refactors |

**Architecture constraints (all layers):** No ORM; backend calls `app.*` functions only with bound parameters; `DATABASE_URL_API` uses `tot_api`. Backend style: **functions** in `api/` / `db/` / `services/`; **classes** for Pydantic schemas and `Settings` — see [OOP Q&A](QUESTION_ANSWER.md#2026-06-30-backend-oop-vs-functions).

---

<a id="environment-files-and-secrets"></a>

## Environment files and secrets

Standard pattern for local development (documented in [QUESTION_ANSWER: env pattern](QUESTION_ANSWER.md#2026-06-30-env-example-pattern)):

| File | Committed? | Role |
|------|------------|------|
| `.env.example` | Yes | Variable names + **placeholder** values |
| `.env` | No | Real local secrets — **you create this** |
| `tot-frontend/.env.example` | Yes | Frontend template (`VITE_API_URL`) |
| `tot-frontend/.env` | No | Real frontend env — **you create this** |

**After clone (required before Docker / API):**

```bash
cp .env.example .env
# edit .env — replace placeholders; keep DATABASE_URL passwords in sync with TOT_*_PASSWORD
```

When working on the frontend:

```bash
cp tot-frontend/.env.example tot-frontend/.env
```

**Rules:**

- Never commit `.env` or put real passwords in `.env.example`, `docker-compose.yml`, or tracked code.
- `docker-compose.yml` uses `${VAR}` substitution from host `.env` — no `${VAR:-password}` defaults in tracked files.
- Do not add `env_file: .env` to Postgres unless you explicitly want every `.env` key inside the container (we avoid this).
- `TOT_API_PASSWORD` in `.env` must match `tot_api` in migration `003` unless a new migration changes the role.

**GitGuardian / scanners:** See [QUESTION_ANSWER: GitGuardian](QUESTION_ANSWER.md#2026-06-30-gitguardian-secrets). Remediation session: [BUILD_LOG](BUILD_LOG.md#2026-06-30-env-security-pattern).

**Dev vs prod:** One local `.env` for now; prod values in Azure at deploy time — not `.env.prod` in git. See [QUESTION_ANSWER: dev vs prod env](QUESTION_ANSWER.md#2026-06-30-dev-vs-prod-env).

---

## Lessons from Phase 1 (`tot-db`) — keep doing this

1. **Forward migrations** — Do not change already-applied SQL files (`001`, `003` on existing DBs). Add `00N_*.sql`; `migrate.sh` skips applied versions.
2. **Migration order** — `001` schema → `002` tables → `003` roles → `004` functions → `005` function grants.
3. **Port** — Local Postgres is **5433** on the host (avoids host Postgres on 5432).
4. **Roles** — Migrations as `tot_owner`; running API as `tot_api` (EXECUTE on functions only).
5. **One session, one outcome** — e.g. “tables only”, then “functions only”, with DBeaver verification between.

---

## Lessons from tot-backend Phase 0–1 — keep doing this

1. **Venv** — `python3 -m venv .venv` (3.10+); not bare `python` if it points at the wrong version. See [Python toolchain Q&A](QUESTION_ANSWER.md#2026-06-30-backend-venv-python310).
2. **One pip install** — `pip install -e ".[dev]"` once per venv; no parallel installs. See [CHALLENGES: pip aborted](CHALLENGES.md#2026-06-30-pip-install-aborted).
3. **Run API** — `fastapi dev app/main.py --port 8000` (not legacy `uvicorn` in docs). Source root `.env` when cwd is `tot-backend`: `set -a && source ../.env && set +a`.
4. **Verify chain** — `docker compose ps` → `pytest -v` → `curl /health`. Phase 1: `test_db_functions.py` before HTTP routes.
5. **Bootstrap mental model** — import `main.py` → lifespan → `create_pool()` → routes. See [bootstrap Q&A](QUESTION_ANSWER.md#2026-06-30-backend-bootstrap-request-flow).
6. **Phase 2 slices** — auth, then one route group at a time; do not stack JWT + full CRUD + frontend in one session.

---

## Key learning index (QUESTION_ANSWER)

Long explanations stay in Q&A — link, do not copy here.

| Topic | Entry |
|-------|--------|
| Phase 2 JWT auth plan | [JWT auth Q&A](QUESTION_ANSWER.md#2026-06-30-jwt-auth-plan) |
| Backend bootstrap & request flow | [bootstrap Q&A](QUESTION_ANSWER.md#2026-06-30-backend-bootstrap-request-flow) |
| OOP vs functions in tot-backend | [OOP Q&A](QUESTION_ANSWER.md#2026-06-30-backend-oop-vs-functions) |
| `.env` / `.env.example` / Docker Compose | [env pattern Q&A](QUESTION_ANSWER.md#2026-06-30-env-example-pattern) |
| Dev vs prod env (no `.env.prod` in git) | [dev vs prod Q&A](QUESTION_ANSWER.md#2026-06-30-dev-vs-prod-env) |
| `pip install -e ".[dev]"` | [pip Q&A](QUESTION_ANSWER.md#2026-06-30-pip-install-editable-dev) |
| Python 3.10+ venv | [toolchain Q&A](QUESTION_ANSWER.md#2026-06-30-backend-venv-python310) |
| Postgres roles (`tot_owner` / `tot_api`) | [roles Q&A](QUESTION_ANSWER.md#2026-06-30-roles-grants) |
| GitGuardian / secrets in git | [GitGuardian Q&A](QUESTION_ANSWER.md#2026-06-30-gitguardian-secrets) |

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
| `python3` / `python3-venv` on PATH (≥ 3.10) | **You** (one-time toolchain) |
| `nvm install` | **You** (one-time toolchain) |
| `python3 -m venv .venv`, `pip install -e ".[dev]"` | Agent or you — **one** venv + **one** pip install after `source .venv/bin/activate` |
| `fastapi dev app/main.py` | Agent or you — with root `.env` sourced if needed |
| `docker compose up`, migrations | Agent or you (your preference per session) |
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

Optional local rules derived from this agreement (`docs/CURSOR_RULES.mdc` — **gitignored**):

```bash
mkdir -p .cursor/rules
cp docs/CURSOR_RULES.mdc .cursor/rules/train-of-thoughts.mdc
```

Edit `docs/CURSOR_RULES.mdc` locally; re-copy to `.cursor/rules/` after changes. Reload Cursor or start a new agent chat.

---

## Agent mode prompt (copy/paste pattern)

> Phase 2, **tot-backend** only: implement JWT + `GET/POST /api/thoughts` calling `app.*` functions. Propose steps first. Update BUILD_LOG when done. Do not touch tot-frontend or tot-db.

**Smaller slices (recommended):** e.g. “Phase 2 step 1 — JWT + login only” or “schemas + `db/thoughts.py` only”.

Explicit **scope**, **phase**, **logging**, and **out-of-scope layers** keep sessions small and accurate.

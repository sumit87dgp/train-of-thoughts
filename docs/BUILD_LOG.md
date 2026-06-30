# Build Log

What was requested, what was done, and how to verify it. Newest entries first.

**Agreement:** [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) · **Issues:** [CHALLENGES.md](CHALLENGES.md)

---

## Index

- [2026-06-30 — Phase 1 tot-backend: test_db_functions.py against app.* functions](#2026-06-30-phase-1-backend-db-tests)
- [2026-06-30 — Phase 0 tot-backend verified: pytest + GET /health against Docker Postgres](#2026-06-30-phase-0-backend-verify)
- [2026-06-30 — Document dev vs prod env strategy in QUESTION_ANSWER](#2026-06-30-dev-vs-prod-env-docs)
- [2026-06-30 — Docs: revert Python 3.12 references; standard is 3.10+](#2026-06-30-python-310-docs)
- [2026-06-30 — Document pip install -e ".[dev]" and backend dependency layout](#2026-06-30-pip-install-docs)
- [2026-06-30 — Backend venv reset: remove incomplete .venv (historical)](#2026-06-30-backend-venv-python312)
- [2026-06-30 — Env security: .env.example placeholders, compose without env_file, local .env](#2026-06-30-env-security-pattern)
- [2026-06-30 — Phase 1 tot-db steps 4–5: functions + EXECUTE grants, smoke-tested](#2026-06-30-phase-1-functions-grants)
- [2026-06-30 — Phase 1 tot-db step 1–2: 002_tables.sql migration applied](#2026-06-30-phase-1-tables-migration)
- [2026-06-30 — Phase 0 scaffolding (partial): Docker, migrations, API skeleton, frontend hello, CI; backend venv not finished](#2026-06-30-phase-0-scaffolding-partial)
- [2026-06-30 — Layer plans written for tot-db, tot-backend, tot-frontend from PROJECT_BRIEF](#2026-06-30-layer-plans)

---

<a id="2026-06-30-phase-1-backend-db-tests"></a>

## 2026-06-30 — Phase 1 tot-backend: `test_db_functions.py` against `app.*` functions

**Request:** tot-backend Phase 1 only — add `test_db_functions.py` calling `app.create_thought` and related functions. Update BUILD_LOG. No Phase 2 HTTP routes.

**Scope:** tot-backend/tests

**Who ran commands:** agent

**Steps:**
1. Added `tests/test_db_functions.py` — parameterized `SELECT * FROM app.<fn>(...)` as `tot_api` via pool
2. Tests: `create_thought`, `get_thought`, `list_thoughts` (tag filter), `update_thought`, `delete_thought`, `search_thoughts`, `list_tags`
3. Refactored `tests/conftest.py` — shared `db_pool` fixture; `client` depends on it
4. `pytest -v` — **8 passed** (7 db + 1 health)

**Files changed:** `tot-backend/tests/test_db_functions.py`, `tot-backend/tests/conftest.py`, `docs/BUILD_LOG.md`, `docs/WORKING_AGREEMENT.md`

**Result:** ✅

**Verify:**
```bash
docker compose ps
cd tot-backend && source .venv/bin/activate
pytest -v
```

**Next:** Phase 2 — Pydantic schemas, `db/thoughts.py`, JWT + `/api/thoughts` routes.

---

<a id="2026-06-30-phase-0-backend-verify"></a>

## 2026-06-30 — Phase 0 tot-backend verified: pytest + `GET /health` against Docker Postgres

**Request:** Phase 0 tot-backend verify only — run pytest and confirm `/health` against Docker. Update BUILD_LOG. No Phase 2 routes.

**Scope:** tot-backend (verify only)

**Who ran commands:** agent

**Steps:**
1. Confirmed `tot-postgres` healthy on `localhost:5433`
2. `pytest -v` in `tot-backend/.venv` (Python 3.10.12) — `test_health` passed
3. `fastapi dev app/main.py --port 8000` with root `.env` sourced (`DATABASE_URL_API`)
4. `curl http://localhost:8000/health` → `200` `{"status":"ok"}` (pool + `SELECT 1` against Docker)

**Files changed:** `docs/BUILD_LOG.md`, `docs/WORKING_AGREEMENT.md`

**Result:** ✅

**Verify (repeat locally):**
```bash
docker compose ps                    # tot-postgres healthy
cd tot-backend && source .venv/bin/activate
pytest -v
set -a && source ../.env && set +a
fastapi dev app/main.py --port 8000
curl http://localhost:8000/health    # {"status":"ok"}
```

**Note:** `app/config.py` loads `.env` from `tot-backend/` cwd; root `.env` is at repo root — source `../.env` when running `fastapi dev`, or symlink/copy (optional follow-up).

**Next:** tot-backend Phase 1 — `test_db_functions.py` (direct `app.*` calls), then Phase 2 JWT + CRUD routes.

---

<a id="2026-06-30-dev-vs-prod-env-docs"></a>

## 2026-06-30 — Document dev vs prod env strategy in QUESTION_ANSWER

**Request:** Document whether to split dev/prod env files now; clarify single local `.env` vs Azure prod settings.

**Scope:** docs

**Who ran commands:** agent

**Steps:**
1. Added [QUESTION_ANSWER: dev vs prod env](QUESTION_ANSWER.md#2026-06-30-dev-vs-prod-env)
2. Linked from [WORKING_AGREEMENT — environment files](WORKING_AGREEMENT.md#environment-files-and-secrets)

**Files changed:** `docs/QUESTION_ANSWER.md`, `docs/BUILD_LOG.md`, `docs/WORKING_AGREEMENT.md`

**Result:** ✅

**Next:** Optional — add “local only” / “differs in prod” comments to `.env.example` when touching env in Phase 2.

---

<a id="2026-06-30-python-310-docs"></a>

## 2026-06-30 — Docs: revert Python 3.12 references; standard is 3.10+

**Request:** Project is not upgrading to Python 3.12. Revert 3.12/pyenv references in docs; align with `requires-python = ">=3.10"` and system `python3` on WSL.

**Scope:** docs, README, CI, layer plans

**Who ran commands:** agent

**Steps:**
1. Updated `README.md`, `WORKING_AGREEMENT.md`, `CURSOR_RULES.mdc` — `python3 -m venv .venv`, Python 3.10+
2. Updated `QUESTION_ANSWER.md` — new [Python 3.10+ toolchain](QUESTION_ANSWER.md#2026-06-30-backend-venv-python310); prior 3.12 entry marked historical
3. Updated `CHALLENGES.md` — 3.10 venv issue reframed as incomplete pip, not wrong version
4. `TOT_BACKEND.md`, `PROJECT_BRIEF.md`, `.github/workflows/ci.yml` — 3.10

**Files changed:** `README.md`, `docs/*`, `tot-backend/TOT_BACKEND.md`, `docs/architecture/PROJECT_BRIEF.md`, `.github/workflows/ci.yml`

**Result:** ✅

**Verify:** `python3 --version` ≥ 3.10; `grep -r "3.12" docs/` should only appear in historical/superseded notes.

---

<a id="2026-06-30-pip-install-docs"></a>

## 2026-06-30 — Document `pip install -e ".[dev]"` and backend dependency layout

**Request:** Document what `pip install -e ".[dev]"` installs (main + dev + transitive deps) after `pyproject.toml` updates (`fastapi[standard]`, `pydantic-settings`, pytest 9).

**Scope:** docs (+ README cross-link)

**Who ran commands:** agent

**Steps:**
1. Added [QUESTION_ANSWER: pip install editable dev](QUESTION_ANSWER.md#2026-06-30-pip-install-editable-dev) — command breakdown, package table, verify steps, `fastapi dev`
2. Linked from `README.md` quick start

**Files changed:** `docs/QUESTION_ANSWER.md`, `docs/BUILD_LOG.md`, `README.md`

**Result:** ✅

**Next:** User runs `pip install -e ".[dev]"` in venv; Phase 0 backend verify.

---

<a id="2026-06-30-backend-venv-python312"></a>

## 2026-06-30 — Backend venv reset: remove incomplete `.venv` (historical)

> **Update:** [Python 3.10+ docs](#2026-06-30-python-310-docs) — project stays on **3.10+** via `python3 -m venv`; 3.12 guidance below was reverted.

**Request:** Remove useless `tot-backend/.venv` (incomplete installs). Stop pyenv workflow; removed `.python-version`.

**Scope:** tot-backend (cleanup) + docs

**Who ran commands:** agent

**Steps:**
1. Deleted `tot-backend/.venv` (Python 3.10.12 — valid version, but deps never installed cleanly)
2. Removed `tot-backend/.python-version` (pyenv-specific)

**Files changed:** removed `tot-backend/.venv`, `tot-backend/.python-version`

**Result:** ✅ (venv recreate + `pip install` pending)

**Verify (current):**
```bash
cd tot-backend
python3 -m venv .venv
source .venv/bin/activate
python --version    # expect 3.10+
pip install -e ".[dev]"
pytest -v
```

**Next:** Phase 0 backend verify (`/health` + pool).

---

<a id="2026-06-30-env-security-pattern"></a>

## 2026-06-30 — Env security: `.env.example` placeholders, compose without `env_file`

**Request:** GitGuardian follow-up — `.env.example` must document variables with placeholders only (not real dev passwords). Align `docker-compose.yml`, `.env.example`, and local `.env`. Document the pattern in project docs.

**Scope:** root (env + compose) + docs

**Who ran commands:** agent

**Steps:**
1. **`.env.example`** — committed template with obvious placeholders (`your-local-tot-owner-password`, etc.); comments for copy workflow and password sync with `DATABASE_URL` / `003_roles_grants.sql`
2. **`.env`** — gitignored local file with real dev values (`tot_owner_dev`, `tot_api_dev`) matching existing Docker volume
3. **`docker-compose.yml`** — `${TOT_OWNER_PASSWORD}` with **no inline default**; removed `env_file: .env` so only `POSTGRES_*` vars enter the container (Compose still reads `.env` on the host for `${VAR}` substitution)
4. **`README.md`** — quick-start env step clarified
5. **Journal docs** — this entry; [QUESTION_ANSWER: env pattern](QUESTION_ANSWER.md#2026-06-30-env-example-pattern); updated [GitGuardian Q&A](QUESTION_ANSWER.md#2026-06-30-gitguardian-secrets); [WORKING_AGREEMENT](WORKING_AGREEMENT.md#environment-files-and-secrets)

**Files changed:** `.env.example`, `.env`, `docker-compose.yml`, `README.md`, `docs/BUILD_LOG.md`, `docs/QUESTION_ANSWER.md`, `docs/WORKING_AGREEMENT.md`, `tot-frontend/.env.example`

**Result:** ✅

**Verify:**
```bash
# Compose loads host .env for substitution; container env is Postgres-only
docker compose config | grep -A6 'environment:'

# After clone, first-time setup
cp .env.example .env
# edit .env with local passwords, then:
docker compose up -d
```

**Next:** Optional — remove hardcoded dev passwords from `migrate.sh`, `config.py`, CI; pre-commit ggshield.

---

<a id="2026-06-30-phase-1-functions-grants"></a>

## 2026-06-30 — Phase 1 tot-db steps 4–5: functions + grants

**Request:** Create `004_functions.sql`, `005_function_grants.sql`, migrate, document. User verified tables in DBeaver earlier.

**Scope:** tot-db

**Who ran commands:** agent

**Steps:**
1. Added `tot-db/migrations/004_functions.sql` — `thought_row` type, `_thought_with_tags` helper, all API functions (`SECURITY DEFINER`)
2. Added `tot-db/migrations/005_function_grants.sql` — `EXECUTE` on API functions for `tot_api`; `REVOKE` on `_thought_with_tags`
3. `./tot-db/scripts/migrate.sh` — applied both migrations
4. Smoke tests as `tot_api`: `create_thought`, `list_thoughts` OK; `SELECT` on `app.thoughts` → permission denied

**Files changed:** `tot-db/migrations/004_functions.sql`, `tot-db/migrations/005_function_grants.sql`, `tot-db/TOT_DB.md`, `docs/BUILD_LOG.md`

**Result:** ✅

**Verify:**
```bash
docker exec tot-postgres psql -U tot_api -d tot \
  -c "SELECT * FROM app.create_thought('Title', 'Body', ARRAY['tag1']);"
docker exec tot-postgres psql -U tot_api -d tot \
  -c "SELECT * FROM app.list_thoughts(10, 0, NULL);"
# expect: permission denied
docker exec tot-postgres psql -U tot_api -d tot \
  -c "SELECT * FROM app.thoughts LIMIT 1;"
```

**Next:** Phase 1 exit — optional full smoke test script; backend `test_db_functions.py`; then Phase 2 FastAPI.

---

<a id="2026-06-30-phase-1-tables-migration"></a>

## 2026-06-30 — Phase 1 tot-db step 1–2: tables migration

**Request:** Phase 1 tot-db only — steps 1–2: add table DDL (forward migration) and run `migrate.sh`. User verifies in DBeaver (step 3).

**Scope:** tot-db

**Who ran commands:** agent

**Steps:**
1. Added `tot-db/migrations/002_tables.sql` — `pgcrypto`, `thoughts`, `tags`, `thought_tags`, indexes, `app.v_tags`
2. `./tot-db/scripts/migrate.sh` — applied `002_tables.sql` (`001` and `003` skipped as already applied)
3. Updated `tot-db/TOT_DB.md` — migration numbering (`002` tables, `004` functions, `005` grants)

**Files changed:** `tot-db/migrations/002_tables.sql`, `tot-db/TOT_DB.md`, `docs/BUILD_LOG.md`

**Result:** ✅ (pending user DBeaver verification)

**Verify (user — step 3):** In DBeaver under `app`: tables `thoughts`, `tags`, `thought_tags`; view `v_tags`.

**Next:** Step 4 — `004_functions.sql`; step 5 — `005_function_grants.sql`.

**Update:** Steps 4–5 completed in [2026-06-30-phase-1-functions-grants](#2026-06-30-phase-1-functions-grants).

---

<a id="2026-06-30-phase-0-scaffolding-partial"></a>

## 2026-06-30 — Phase 0 scaffolding (partial)

**Request:** Implement Phase 0 foundation per layer plans (Docker, DB, FastAPI `/health`, React hello, CI).

**Scope:** root, tot-db, tot-backend, tot-frontend, `.github/workflows`

**Who ran commands:** agent (attempted); user interrupted some installs

**Steps:**
1. `docker compose up -d` — Postgres 16 container `tot-postgres`
2. `./tot-db/scripts/migrate.sh` — applied `001_schema.sql`, `003_roles_grants.sql`
3. Scaffolded `tot-backend/` — FastAPI, asyncpg pool, `GET /health`, pytest stub
4. Scaffolded `tot-frontend/` — Vite + React + TS + Tailwind, `fetchHealth()` hello page
5. `npm install` + `npm run build` — frontend build succeeded
6. Attempted `pip install -e ".[dev]"` — **aborted** (see CHALLENGES)

**Files changed:**
- `docker-compose.yml`, `.env.example`, `.gitignore`, `README.md`
- `tot-db/migrations/001_schema.sql`, `tot-db/migrations/003_roles_grants.sql`, `tot-db/scripts/migrate.sh`
- `tot-backend/pyproject.toml`, `tot-backend/app/**`, `tot-backend/tests/**`, `tot-backend/.python-version`
- `tot-frontend/package.json`, `tot-frontend/src/**`, `tot-frontend/.nvmrc`, `tot-frontend/.env.example`
- `.github/workflows/ci.yml`

**Result:** ⚠️ partial (at time of entry)

**Update:** tot-backend Phase 0 verified in [2026-06-30-phase-0-backend-verify](#2026-06-30-phase-0-backend-verify).

**Verify (original):**
docker compose ps                          # tot-postgres healthy
./tot-db/scripts/migrate.sh                # migrations complete
cd tot-frontend && nvm use && npm run build
curl http://localhost:8000/health          # after backend venv + uvicorn (not done yet)
```

**Next:** User-led Phase 0 retry — backend venv with `python3 -m venv .venv` (see [Python 3.10+ docs](#2026-06-30-python-310-docs)).

---

<a id="2026-06-30-layer-plans"></a>

## 2026-06-30 — Layer plans

**Request:** Create implementation plans from `PROJECT_BRIEF.md` into each layer’s `TOT_*.md`.

**Scope:** tot-db, tot-backend, tot-frontend (documentation only)

**Who ran commands:** agent

**Steps:**
1. Wrote [tot-db/TOT_DB.md](../tot-db/TOT_DB.md) — schema, functions, roles, migrations, phases
2. Wrote [tot-backend/TOT_BACKEND.md](../tot-backend/TOT_BACKEND.md) — FastAPI layout, routes, auth, tests
3. Wrote [tot-frontend/TOT_FRONTEND.md](../tot-frontend/TOT_FRONTEND.md) — Vite, TanStack Query, pages, routing

**Files changed:** `tot-db/TOT_DB.md`, `tot-backend/TOT_BACKEND.md`, `tot-frontend/TOT_FRONTEND.md`

**Result:** ✅

**Verify:** Read each `TOT_*.md`; cross-links to `PROJECT_BRIEF.md` present.

**Next:** Phase 0 scaffolding per plans.

---

## New entry template

Add a line to the [Index](#index) above, then paste here (newest entries stay directly below the Index):

```markdown
<a id="yyyy-mm-dd-short-slug"></a>

## YYYY-MM-DD — Title

**Request:**

**Scope:**

**Who ran commands:**

**Steps:**
1.

**Files changed:**

**Result:** ✅ | ⚠️ | ❌

**Verify:**

**Next:**
```

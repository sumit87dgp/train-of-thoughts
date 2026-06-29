# Build Log

What was requested, what was done, and how to verify it. Newest entries first.

**Agreement:** [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) · **Issues:** [CHALLENGES.md](CHALLENGES.md)

---

## Index

- [2026-06-30 — Env security: .env.example placeholders, compose without env_file, local .env](#2026-06-30-env-security-pattern)
- [2026-06-30 — Phase 1 tot-db steps 4–5: functions + EXECUTE grants, smoke-tested](#2026-06-30-phase-1-functions-grants)
- [2026-06-30 — Phase 1 tot-db step 1–2: 002_tables.sql migration applied](#2026-06-30-phase-1-tables-migration)
- [2026-06-30 — Phase 0 scaffolding (partial): Docker, migrations, API skeleton, frontend hello, CI; backend venv not finished](#2026-06-30-phase-0-scaffolding-partial)
- [2026-06-30 — Layer plans written for tot-db, tot-backend, tot-frontend from PROJECT_BRIEF](#2026-06-30-layer-plans)

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

**Result:** ⚠️ partial

**Verify:**
```bash
docker compose ps                          # tot-postgres healthy
./tot-db/scripts/migrate.sh                # migrations complete
cd tot-frontend && nvm use && npm run build
curl http://localhost:8000/health          # after backend venv + uvicorn (not done yet)
```

**Next:** User-led Phase 0 retry — one layer at a time; backend venv with pyenv 3.12.

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

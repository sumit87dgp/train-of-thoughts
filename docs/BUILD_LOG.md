# Build Log

What was requested, what was done, and how to verify it. Newest entries first.

**Agreement:** [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) · **Issues:** [CHALLENGES.md](CHALLENGES.md)

---

## Index

- [2026-06-30 — Phase 0 scaffolding (partial): Docker, migrations, API skeleton, frontend hello, CI; backend venv not finished](#2026-06-30-phase-0-scaffolding-partial)
- [2026-06-30 — Layer plans written for tot-db, tot-backend, tot-frontend from PROJECT_BRIEF](#2026-06-30-layer-plans)

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

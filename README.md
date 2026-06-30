# Train of Thoughts

Personal web app to capture, organize, and search thoughts. See [PROJECT_BRIEF.md](docs/architecture/PROJECT_BRIEF.md) for architecture and phased delivery.

## Repository layout

| Path | Purpose |
|------|---------|
| `tot-db/` | PostgreSQL migrations and scripts |
| `tot-backend/` | FastAPI REST API |
| `tot-frontend/` | React SPA (Vite + TypeScript) |
| `docs/architecture/` | Architecture brief, NFRs, ADRs |
| `docs/BUILD_LOG.md` | Session log — what was requested and done |
| `docs/CHALLENGES.md` | Errors faced and how they were resolved |
| `docs/WORKING_AGREEMENT.md` | How we work together (scope, toolchain, logging) |
| `docs/QUESTION_ANSWER.md` | Q&A learning notes (date-indexed) |

Copy `docs/CURSOR_RULES.mdc` to `.cursor/rules/train-of-thoughts.mdc` for local agent rules (see [WORKING_AGREEMENT.md](docs/WORKING_AGREEMENT.md)).

## Prerequisites

| Tool | Version | How |
|------|---------|-----|
| [Docker Desktop](https://docs.docker.com/desktop/) | — | WSL integration enabled |
| Python | **3.10+** | System `python3` on WSL/Ubuntu is usually enough (`python3 --version` ≥ 3.10) |
| Node.js | **20+** | [nvm](https://github.com/nvm-sh/nvm) (see `tot-frontend/.nvmrc`) |
| `psql` | — | PostgreSQL client, for migrations |

Backend `pyproject.toml` requires `>=3.10`. Use **`python3 -m venv`** (or `python3.10 -m venv` if you want to be explicit) — not an accidental older `python` if your default `python` is 2.7 or missing.

### One-time toolchain setup

**Python 3.10+**

On Ubuntu/WSL, the distro `python3` package is often 3.10.x and includes venv:

```bash
python3 --version    # must be 3.10 or newer
```

If `python3-venv` is missing:

```bash
sudo apt update
sudo apt install python3-venv
```

**Node 20 (nvm)**

```bash
# nvm: https://github.com/nvm-sh/nvm#installing-and-updating
cd tot-frontend
nvm install    # reads .nvmrc (20)
nvm use
```

## Quick start (Phase 0)

### 0. After cloning — create `.env` from templates

The repo ships **`.env.example`** files, not `.env`. Copy and edit before anything else:

```bash
cp .env.example .env
# Edit .env: replace placeholders with local-only values
```

| Template | Copy to | Used by |
|----------|---------|---------|
| `.env.example` | `.env` | Docker Compose, migrations, backend |
| `tot-frontend/.env.example` | `tot-frontend/.env` | Vite dev server (step 5) |

Details: [QUESTION_ANSWER — env pattern](docs/QUESTION_ANSWER.md#2026-06-30-env-example-pattern) · [WORKING_AGREEMENT — environment files](docs/WORKING_AGREEMENT.md#environment-files-and-secrets)

### 1. Environment

```bash
cp .env.example .env   # skip if you already did step 0
```

Edit `.env`: replace placeholders with **local-only** values. Passwords in `DATABASE_URL` / `DATABASE_URL_API` must match `TOT_OWNER_PASSWORD` / `TOT_API_PASSWORD`. Keep `TOT_API_PASSWORD` aligned with `tot_api` in [`003_roles_grants.sql`](tot-db/migrations/003_roles_grants.sql) unless you change that role via a new migration.

Required before `docker compose up`. `.env` is gitignored; `.env.example` is the committed template (placeholders only — never copy real secrets back into the example file). See [QUESTION_ANSWER: GitGuardian](docs/QUESTION_ANSWER.md#2026-06-30-gitguardian-secrets).

### 2. Start PostgreSQL

```bash
docker compose up -d
```

Postgres listens on **port 5433** locally (avoids conflict with a host PostgreSQL on 5432).

Wait until the container is healthy:

```bash
docker compose ps
```

### 3. Run migrations

```bash
chmod +x tot-db/scripts/migrate.sh
./tot-db/scripts/migrate.sh
```

### 4. Start the API

```bash
cd tot-backend
python3 -m venv .venv
source .venv/bin/activate
python --version          # should show 3.10+ inside the venv
pip install --upgrade pip
pip install -e ".[dev]"    # main + dev deps; see docs/QUESTION_ANSWER.md#2026-06-30-pip-install-editable-dev
fastapi dev app/main.py --port 8000
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok"}`

Backend dependencies and `pip install -e ".[dev]"`: [QUESTION_ANSWER](docs/QUESTION_ANSWER.md#2026-06-30-pip-install-editable-dev).

### 5. Start the frontend

```bash
cd tot-frontend
nvm use                   # Node 20 from .nvmrc
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 — the page should show API health status.

## Running tests

Backend integration tests use **pytest** against Docker Postgres (see [QUESTION_ANSWER — pytest](docs/QUESTION_ANSWER.md#2026-06-30-backend-pytest)).

```bash
docker compose up -d
./tot-db/scripts/migrate.sh

cd tot-backend
source .venv/bin/activate
pytest -v
```

Run one file: `pytest tests/test_auth.py -v`. CI runs the same command from `tot-backend/` on every push/PR to `main`.

## Development phases

| Phase | Focus |
|-------|--------|
| 0 | Foundation (this setup) |
| 1 | Database functions — [TOT_DB.md](tot-db/TOT_DB.md) |
| 2 | FastAPI CRUD + JWT — [TOT_BACKEND.md](tot-backend/TOT_BACKEND.md) |
| 3 | React UI — [TOT_FRONTEND.md](tot-frontend/TOT_FRONTEND.md) |
| 4 | Production hardening |
| 5 | Azure deployment |

## Layer plans

- [tot-db/TOT_DB.md](tot-db/TOT_DB.md)
- [tot-backend/TOT_BACKEND.md](tot-backend/TOT_BACKEND.md)
- [tot-frontend/TOT_FRONTEND.md](tot-frontend/TOT_FRONTEND.md)

## Development journal

- [WORKING_AGREEMENT.md](docs/WORKING_AGREEMENT.md) — how we build (one layer at a time)
- [BUILD_LOG.md](docs/BUILD_LOG.md) — dated index of requests and steps
- [CHALLENGES.md](docs/CHALLENGES.md) — dated index of issues and fixes
- [QUESTION_ANSWER.md](docs/QUESTION_ANSWER.md) — dated Q&A learning notes

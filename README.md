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

## Prerequisites

| Tool | Version | How |
|------|---------|-----|
| [Docker Desktop](https://docs.docker.com/desktop/) | — | WSL integration enabled |
| Python | **3.12+** | [pyenv](https://github.com/pyenv/pyenv) (see `tot-backend/.python-version`) |
| Node.js | **20+** | [nvm](https://github.com/nvm-sh/nvm) (see `tot-frontend/.nvmrc`) |
| `psql` | — | PostgreSQL client, for migrations |

The system Python on your OS may be older (e.g. 3.10). **Do not use it directly.** Create the backend venv with Python 3.12 from pyenv (or another 3.12 install).

### One-time toolchain setup

**Python 3.12 (pyenv)**

```bash
# Install pyenv if needed: https://github.com/pyenv/pyenv#installation
pyenv install 3.12   # reads tot-backend/.python-version when in that directory
```

On Ubuntu without pyenv, you can use the [deadsnakes PPA](https://launchpad.net/~deadsnakes/+archive/ubuntu/ppa):

```bash
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update
sudo apt install python3.12 python3.12-venv
```

**Node 20 (nvm)**

```bash
# nvm: https://github.com/nvm-sh/nvm#installing-and-updating
cd tot-frontend
nvm install    # reads .nvmrc (20)
nvm use
```

## Quick start (Phase 0)

### 1. Environment

```bash
cp .env.example .env
```

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
pyenv local 3.12          # or: python3.12 -m venv .venv
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok"}`

### 5. Start the frontend

```bash
cd tot-frontend
nvm use                   # Node 20 from .nvmrc
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 — the page should show API health status.

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

# Gunicorn on Azure App Service

Production process model for **tot-backend** — FastAPI behind **Gunicorn** with **Uvicorn workers**.

**Related:** [TOT_BACKEND.md](../../tot-backend/TOT_BACKEND.md) · [Gunicorn Q&A](../QUESTION_ANSWER.md#2026-07-03-gunicorn-runbook) · [PROJECT_BRIEF](../architecture/PROJECT_BRIEF.md)

---

## Purpose

- Run the API with **multiple worker processes** and **supervision** (restart crashed workers, graceful shutdown).
- Match **NFR-04** (≤ 10 concurrent users) with a small, documented footprint.
- Give Phase 5 Azure App Service a **single startup command** source of truth.

**Local development** stays on Uvicorn with reload — do not use this runbook for day-to-day coding.

---

## Local dev vs production

| | Local dev | Production |
|---|-----------|------------|
| Command | `uvicorn app.main:app --reload` | `tot-backend/scripts/start-prod.sh` or Gunicorn command below |
| Processes | 1 | 2 (default) |
| Code reload | Yes | No — deploy new build |
| Binding | `127.0.0.1:8000` typical | `0.0.0.0:$PORT` (App Service sets `PORT`) |

---

## Start command

From `tot-backend/` with venv active and env loaded:

```bash
source .venv/bin/activate
set -a && source ../.env && set +a
./scripts/start-prod.sh
```

Equivalent manual command:

```bash
gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  -b 0.0.0.0:8000 \
  --workers 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

| Flag | Value | Why |
|------|-------|-----|
| `app.main:app` | FastAPI instance | Same object as dev (`main.py`) |
| `-k uvicorn.workers.UvicornWorker` | ASGI worker | Async FastAPI + asyncpg |
| `-b 0.0.0.0:8000` | Bind address | App Service routes to container port |
| `--workers 2` | Worker count | Enough for personal scale (NFR-04) |
| `--timeout 120` | Seconds | Slow search/DB calls unlikely to hit; avoids premature worker kill |
| `--access-logfile -` / `--error-logfile -` | stdout | App Service log stream + Application Insights |

### Environment overrides

| Variable | Default | Use |
|----------|---------|-----|
| `GUNICORN_WORKERS` | `2` | Worker count (`start-prod.sh`) |
| `PORT` or `API_PORT` | `8000` | Listen port; **App Service sets `PORT`** in production |
| `LOG_FORMAT` | `text` | Set `json` in prod for structured logs |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | unset locally | Required in prod for telemetry |

All other API settings (`DATABASE_URL_API`, `JWT_SECRET`, `CORS_ORIGINS`, etc.) are unchanged — see root `.env.example`.

---

## Azure App Service (Phase 5)

**Startup command** (Linux, Python):

```bash
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT --workers 2 --timeout 120 --access-logfile - --error-logfile -
```

Or, if deploy layout places `scripts/` on `PATH`:

```bash
./scripts/start-prod.sh
```

**Health check:** configure App Service to probe `GET /health` (expects 200). Unhealthy instances are recycled.

**Dependencies:** `gunicorn` is in `tot-backend/pyproject.toml`; deploy pipeline must `pip install` the package (not rely on platform-only Gunicorn).

---

## Verify locally (prod smoke)

Prerequisites: Docker Postgres up, migrations applied, `.env` loaded.

```bash
docker compose up -d && ./tot-db/scripts/migrate.sh
cd tot-backend && source .venv/bin/activate && pip install -e ".[dev]"
set -a && source ../.env && set +a
./scripts/start-prod.sh
```

In another terminal:

```bash
curl -s http://127.0.0.1:8000/health
# → {"status":"ok",...}
curl -s -D - http://127.0.0.1:8000/health -o /dev/null | grep -i x-request-id
```

Stop with `Ctrl+C` in the Gunicorn terminal.

---

## Logs and monitoring

- Gunicorn access/error logs → **stdout** → App Service log stream.
- Application logs (`request_started`, `api_error`, etc.) → same stream; with `APPLICATIONINSIGHTS_CONNECTION_STRING`, exported to **Application Insights**.
- Use `X-Request-ID` to correlate a browser request with logs.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| App won’t start | `DATABASE_URL_API` reachable; `pip install -e .` includes `gunicorn` |
| `ModuleNotFoundError: app` | Run from `tot-backend/` or set `PYTHONPATH` |
| 502 / unhealthy | `GET /health` returns 200; DB pool connects on lifespan |
| Workers timing out | Rare at personal scale; increase `--timeout` if needed |
| Port in use | Change `API_PORT` or stop local `uvicorn` |

**Restart (Azure):** App Service → **Restart** in portal, or redeploy via GitHub Actions (Phase 5).

---

## When to change worker count

Default **2** is sufficient for ≤ 10 users (NFR-04). Increase only if you observe sustained CPU saturation or request queuing — unlikely for this app. Each worker holds its own DB pool connections; keep total Postgres connections modest on Azure Flexible Server.

---

## Cross-references

| Doc | Topic |
|-----|--------|
| [QUESTION_ANSWER — Gunicorn runbook](../QUESTION_ANSWER.md#2026-07-03-gunicorn-runbook) | Conceptual overview |
| [QUESTION_ANSWER — bootstrap](../QUESTION_ANSWER.md#2026-06-30-backend-bootstrap-request-flow) | `app.main:app` lifespan and pool |
| [BUILD_LOG — App Insights](../BUILD_LOG.md#2026-07-03-phase-4-app-insights) | Telemetry in prod |

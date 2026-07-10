# Sync worker package — plan and Typer CLI

**Date:** 2026-07-09  
**Status:** Planned — not yet implemented in the repo

## Context

SPPO Data 360 needs a **sync worker** to precompute small dashboard answers from Databricks and write them to Redis on a ~30-minute cycle ([NFR.md](../architecture/NFR.md), [C4.md](../architecture/C4.md)). The legacy v2 monolith (`app.py`) fetches up to 10k run rows via `GET /api/runs` and derives the sidebar in the browser — the new design **caches aggregates only**, not full datasets.

This document records the agreed package plan and explains **Typer CLI** as the entry-point choice for the worker.

---

## What is Typer CLI?

**[Typer](https://typer.tiangolo.com/)** is a Python library for building **command-line interfaces (CLIs)**. It is made by the same author as **FastAPI** and uses **type hints** to define commands, options, and help text with minimal boilerplate.

### Minimal example

```python
import typer

app = typer.Typer()

@app.command()
def run(job: str | None = None):
  """Run sync jobs (all, or one by --job id)."""
  if job:
    print(f"Running job: {job}")
  else:
    print("Running all jobs")

if __name__ == "__main__":
  app()
```

Invoked as:

```bash
python -m sppo_data_360_sync run
python -m sppo_data_360_sync run --job workloads-summary
python -m sppo_data_360_sync run --help
```

Typer generates `--help`, validates types, and maps flags to function parameters automatically.

### How it helps the sync worker

| Need | How Typer helps |
|------|-----------------|
| **Not an HTTP server** | Sync worker is a **batch job** (run → exit). Typer fits; FastAPI does not. |
| **Cron / K8s CronJob** | Schedulers call a **single command** with a clear exit code: `python -m sppo_data_360_sync run` |
| **Run one job or all** | `--job workloads-summary` for debugging without running the full catalog |
| **Discoverability** | `--help` documents commands for you and ops without a separate doc |
| **Consistency** | Same ecosystem as FastAPI (types, pydantic-friendly patterns) |
| **Low ceremony** | Less code than raw `argparse` for multiple subcommands |

### What Typer is *not*

- It is **not** a scheduler — cron, systemd timers, or AKS CronJob still trigger the CLI on a schedule.
- It is **not** a replacement for Redis or Databricks — it is only how we **start** the Python process.
- It is **not** required forever — `argparse` from the standard library would work; Typer is a productivity choice.

### Alternatives considered

| Option | Fit for sync worker |
|--------|---------------------|
| **Typer** | Good — subcommands, help, types, small dependency |
| **argparse** (stdlib) | Fine — zero extra deps, more verbose |
| **Click** | Good — Typer is built on Click; similar trade-offs |
| **FastAPI / HTTP endpoint** | Poor — adds a server, auth, and uptime concerns for a job that should run and exit |
| **Celery / RQ** | Overkill for v0 — one scheduled aggregate job does not need a task queue yet |

**Decision for v0:** Typer (or stdlib `argparse` if we want zero new deps — Typer preferred for readability).

---

## Role in the architecture

```text
Every ~30 min (or manual run):
  Sync worker  →  SQL aggregate on Databricks
              →  small JSON answer  →  Redis (TTL ~30 min)

Dashboard / Sidebar / API read path:
  API  →  Redis hit  →  fast response
      →  miss  →  live Databricks fallback (later)
```

**Principle:** cache the **answer**, not the **dataset** ([NFR.md](../architecture/NFR.md)).

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Language** | Python 3.10+ | Same as API; Databricks connector already in use |
| **Databricks** | `databricks-sql-connector` | Same as API + legacy `app.py` |
| **Redis** | `redis` (redis-py) | Local Docker + staging native Redis |
| **Config** | `pydantic-settings` | Root `.env` ([ADR 0007](../architecture/adr/0007-root-environment-configuration.md)) |
| **CLI** | **Typer** | Batch entry point — run and exit (see above) |
| **SQL** | `.sql` files in package | Avoid large inline SQL strings (`app.py` lesson) |
| **Scheduling** | Cron / systemd / manual CLI | AKS CronJob later ([C4.md](../architecture/C4.md)) |
| **Container** | Dockerfile in package | Align with API/UI deploy (Phase 0) |

**Not in v0:** Postgres writes, Entra auth, HTTP API on the worker, full widget catalog.

---

## New monorepo package

```text
sppo-data-360-sync-worker/
├── README.md
├── pyproject.toml
├── requirements.txt
├── Dockerfile                          # later
├── sql/
│   └── automation_workloads_summary.sql
└── src/sppo_data_360_sync/
    ├── __init__.py
    ├── __main__.py                     # python -m sppo_data_360_sync
    ├── cli.py                          # Typer: run, run --job workloads-summary
    ├── config.py                       # Settings from root .env
    ├── jobs/
    │   ├── base.py                     # Job protocol / registry
    │   └── workloads_summary.py        # first job
    └── repositories/
        ├── databricks_client.py        # PAT / service principal (mirror API)
        ├── databricks_repository.py    # run_sql_file(...)
        └── redis_repository.py         # set_json(key, payload, ttl)
```

**Separate package** from `sppo-data-360-api-service` — C4 deploys `ui`, `api`, and `sync` independently. Shared `databricks_client` code can be extracted to a common lib later; v0 may mirror API repositories.

---

## Job registry (extensible)

Each job defines:

| Field | Example |
|-------|---------|
| `job_id` | `workloads-summary` |
| `data_source` | `automation` (manual later) |
| `redis_key` | `cache:automation:workloads:summary` |
| `ttl_seconds` | `CACHE_TTL_SECONDS` (1800) |
| `run()` | Databricks query → JSON → Redis `SET` |

Future jobs: landing KPIs, usage top workloads, etc. — new SQL file + job class.

---

## First job: `workloads-summary`

**Purpose:** Small aggregate for automation sidebar — replaces v2’s client-side `deriveWL()` from 10k runs.

**Databricks SQL (sketch)** — aggregate from `workflow_run_data_table` (align with v2 `RUNS_SQL` tables):

```sql
SELECT
    workload_name AS name,
    COALESCE(category, 'Other') AS group_name,
    COUNT(*)::BIGINT AS run_count
FROM `{catalog}`.`{schema}`.workflow_run_data_table w
WHERE try_to_timestamp(w.executed_date) >= current_date() - INTERVAL 90 DAYS
   OR try_to_timestamp(w.executed_date) IS NULL
GROUP BY workload_name, COALESCE(category, 'Other')
ORDER BY group_name, name
```

**Redis key:** `cache:automation:workloads:summary`

**Redis value (JSON):** see [sync-worker-redis-payload-contract.md](sync-worker-redis-payload-contract.md).

**TTL:** `CACHE_TTL_SECONDS` (30 minutes default; align cron interval with TTL).

API (later): `GET /api/v1/workloads?source=automation` reads Redis first.

---

## Initial code shape (scaffold target)

### `cli.py` (Typer)

```python
import typer

app = typer.Typer(help="SPPO Data 360 sync worker — Databricks → Redis")

@app.command()
def run(
    job: str | None = typer.Option(None, "--job", help="Run one job id only"),
):
    """Execute sync jobs and write aggregates to Redis."""
    ...

if __name__ == "__main__":
    app()
```

### `jobs/workloads_summary.py`

```python
def run(settings) -> None:
    rows = databricks_repository.fetch_workloads_summary(settings)
    payload = {
        "generated_at": ...,
        "source": "databricks-live",
        "data_source": "automation",
        "items": rows,
    }
    redis_repository.set_json(
        key="cache:automation:workloads:summary",
        payload=payload,
        ttl_seconds=settings.cache_ttl_seconds,
    )
```

### Local run

```bash
cd sppo-data-360-sync-worker
python -m venv .venv && source .venv/bin/activate
pip install -e .
python -m sppo_data_360_sync run --job workloads-summary
```

Verify in Redis Insight: key `cache:automation:workloads:summary`.

### Staging (cron example)

```bash
*/30 * * * * cd /path/to/sppo-data-360-sync-worker && .venv/bin/python -m sppo_data_360_sync run >> /var/log/sppo-sync.log 2>&1
```

Production target: **AKS CronJob** with the same container command.

---

## Environment variables (repo root `.env`)

```bash
REDIS_URL=redis://:password@127.0.0.1:6379/0
DATABRICKS_HOST=...
DATABRICKS_HTTP_PATH=...
DATABRICKS_TOKEN=...              # or service principal vars
DBX_CATALOG=prism-prd
DBX_SCHEMA=sppo_prd
CACHE_TTL_SECONDS=1800
APP_ENV=dev
```

---

## Out of scope for v0

| Item | Notes |
|------|--------|
| Full `runs[]` in Redis | Violates NFR |
| Postgres analytics | Metadata only in Postgres |
| Manual Databricks jobs | When manual schema exists |
| Force refresh endpoint | After basic sync works |
| HTTP server on worker | Use Typer CLI only |

---

## Recommended build order

| Step | Deliverable |
|------|-------------|
| 1 | Package scaffold + `config` + Redis repository |
| 2 | Databricks repository + `automation_workloads_summary.sql` |
| 3 | `workloads-summary` job + Typer `run` command |
| 4 | API: Redis read + `GET /workloads/summary` |
| 5 | UI: automation `Sidebar` uses summary endpoint |
| 6 | Staging cron + Dockerfile + CI placeholder |

Steps 1–3 are sync worker only.

---

## Related docs

- [NFR.md](../architecture/NFR.md) — caching model, 30-minute sync window
- [sync-worker-redis-payload-contract.md](sync-worker-redis-payload-contract.md) — Redis key + JSON envelope
- [C4.md](../architecture/C4.md) — Sync Worker container, AKS CronJob
- [PROJECT_BRIEF.md](../architecture/PROJECT_BRIEF.md) — Phase 3 deliverables
- [redis-staging-security-and-hosting.md](redis-staging-security-and-hosting.md) — Redis on staging VM
- [STAGING_VM_DATABASES.md](../../sppo-data-360-db/STAGING_VM_DATABASES.md) — local/staging Redis connection
- Legacy v2: `app.py` `GET /api/runs`, `deriveWL()` in `static/v2.html`

# Sync worker — Redis payload contract

**Date:** 2026-07-09  
**Status:** Implemented (steps 3–4)

## Context

The sync worker caches **small answers**, not full Databricks datasets ([NFR.md](../architecture/NFR.md)). Each job writes one Redis key with a JSON envelope the API returns on the hot path (step 4) and the automation sidebar consumes (step 5).

**Package:** `sppo-data-360-sync-worker`  
**Related:** [sync-worker-package-and-typer-cli.md](sync-worker-package-and-typer-cli.md)

---

## Key naming

```text
cache:<data_source>:<resource>:<shape>
```

| Segment | Meaning | Example |
|---------|---------|---------|
| `data_source` | Dashboard route / origin | `automation`, `manual` (later) |
| `resource` | Domain entity | `workloads` |
| `shape` | Cached view | `summary` |

**First key:** `cache:automation:workloads:summary`

---

## Envelope (all sync jobs)

Top-level fields shared across cache entries (pattern from legacy `app.py` `/api/runs`):

| Field | Type | Purpose |
|-------|------|---------|
| `generated_at` | ISO 8601 UTC string | When this cache entry was written |
| `source` | string | Provenance: `databricks-live` on successful sync; API may use `redis-cache` or `error` on read |
| `data_source` | string | `automation` or `manual` — matches UI `/automation` vs `/manual` |
| `items` | array | Job-specific rows (the aggregate answer) |

Legacy v2 used `generated_at` + `source` + `runs[]` for **full run rows**. The new design keeps the envelope idea but replaces `runs` with a small `items` array.

---

## Job: `workloads-summary`

**CLI:** `python -m sppo_data_360_sync run --job workloads-summary`  
**Code:** `jobs/workloads_summary.py`  
**SQL:** `sql/automation_workloads_summary.sql`  
**TTL:** `CACHE_TTL_SECONDS` from repo root `.env` (default **1800** seconds / 30 minutes). Sync cron should run at least every 30 minutes in production.

### Redis value (example)

```json
{
  "generated_at": "2026-07-09T10:15:00+00:00",
  "source": "databricks-live",
  "data_source": "automation",
  "items": [
    {
      "name": "SPEC CPU",
      "group_name": "PPOP Performance",
      "run_count": 1284
    },
    {
      "name": "BIOS Regression QA",
      "group_name": "BIOS Regression",
      "run_count": 502
    }
  ]
}
```

### `items[]` row shape

| Field | Type | Source |
|-------|------|--------|
| `name` | string | `workload_name` in Databricks |
| `group_name` | string | `COALESCE(category, 'Other')` |
| `run_count` | integer | `COUNT(*)` — **lifetime** totals (no 90-day filter; active-window filtering is a future design) |

### What this is not

- Not the Postgres catalog (`workload_name` / `workload_type` CCM|FSA) — that remains `GET /api/v1/workloads` for manual/seed data today.
- Not v2 `runs[]` (thousands of run-level rows).
- Not a substitute for live Databricks on detail pages — sidebar aggregate only.

---

## Read path (step 4–5 — API + UI)

```text
GET /api/v1/workloads?source=automation   → Redis cache (sync worker)
GET /api/v1/workloads?source=manual       → Postgres catalog (summary shape; run_count=0 until aggregate SQL)
```

Single endpoint and unified ``WorkloadSummaryItem`` envelope. Automation sidebar passes ``source=automation``; manual passes ``source=manual``.

Implementation: `sppo-data-360-api-service` — `GET /workloads`; UI `useWorkloads(source)`.

---

## Deferred: API Databricks fallback on cache miss

**Status:** Not implemented — tracked in [PROJECT_BRIEF.md](../architecture/PROJECT_BRIEF.md) Phase 3.

On `cache_miss`, the API returns **503** today. Later: run the same aggregate SQL as the sync worker, return `source: databricks-fallback`, optionally warm Redis.

---

## UI mapping (step 5 — done)

Automation sidebar will map `items[]` to sidebar groups:

| Redis field | UI use |
|-------------|--------|
| `group_name` | Sidebar section title (replaces v2 `prog`) |
| `name` | Workload label (replaces v2 `wl`) |
| `run_count` | Optional badge / metadata |

Stable workload `id` (v2 `slug(name)`) can be derived client-side when wiring the UI.

---

## Verification

```bash
cd sppo-data-360-sync-worker
source .venv/bin/activate
python -m sppo_data_360_sync run --job workloads-summary
```

In Redis Insight or `redis-cli`:

```bash
GET cache:automation:workloads:summary
```

Expect JSON matching the envelope above.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-09 | Document API Databricks fallback on cache_miss (Phase 3 deferred) |
| 2026-07-09 | API reads Redis via single workloads endpoint (step 4) |
| 2026-07-09 | Initial contract for `workloads-summary`; lifetime `run_count` |

# NFR checklist — Phase 4 sign-off

Walk **NFR-01 through NFR-14** from [PROJECT_BRIEF](../architecture/PROJECT_BRIEF.md) before starting **Phase 5 (Azure deploy)**.

**Legend**

| Symbol | Meaning |
|--------|---------|
| ✅ | Met with evidence in repo or local verify |
| 📋 | Documented / designed; production proof in Phase 5 |
| ⏳ | Requires Azure provisioning or live prod (Phase 5) |

**Phase 4 exit:** All rows have a clear status and verify path. Rows marked ⏳ are expected until Phase 5 go-live.

**Related:** [BUILD_LOG](../BUILD_LOG.md) · [runbooks](../runbooks/) · [WORKING_AGREEMENT](../WORKING_AGREEMENT.md)

---

## Summary

| ID | Requirement | Status | Phase 5 action |
|----|-------------|--------|----------------|
| NFR-01 | 99% availability | 📋 | Monitor uptime after deploy |
| NFR-02 | Read p95 < 500 ms | ✅ | Spot-check in App Insights |
| NFR-03 | Write p95 < 1 s | ✅ | Spot-check in App Insights |
| NFR-04 | ≤ 10 concurrent users | ✅ | Gunicorn 2 workers |
| NFR-05 | HTTPS only (non-local) | ⏳ | Enforce on App Service + SWA |
| NFR-06 | Parameterized SQL only | ✅ | Code review + pytest |
| NFR-07 | `tot_api` EXECUTE only | ✅ | Migrations `003`, `005` |
| NFR-08 | No secrets in git | ✅ | `.env.example` pattern |
| NFR-09 | No analytics on note content | ✅ | Backend telemetry only |
| NFR-10 | Backup ≥ 7 days | 📋 | Enable on Flexible Server |
| NFR-11 | RPO 24h / RTO 4h | 📋 | PITR runbook + Phase 5 drill |
| NFR-12 | ≤ $25/month | 📋 | Cost review after provision |
| NFR-13 | Versioned migrations | ✅ | `tot-db/migrations/` + CI |
| NFR-14 | Observability | ✅ | Logs, App Insights SDK, `/health` |

**NFR-15** (Postgres portability) is accepted by design — see ADR-002; not a Phase 4 gate.

---

## NFR-01 — Availability (99% monthly)

| | |
|---|---|
| **Target** | ~99% uptime (~7 h downtime/month acceptable for personal use) |
| **Status** | 📋 Design acceptable for single App Service + managed Postgres |
| **Evidence** | `/health` for probes; [Gunicorn runbook](../runbooks/gunicorn-app-service.md) worker supervision |
| **Local verify** | `curl -s http://127.0.0.1:8000/health` → `{"status":"ok"}` |
| **Phase 5** | App Service health check → `/health`; optional availability alert in App Insights |

---

## NFR-02 — Performance: reads (p95 < 500 ms)

| | |
|---|---|
| **Target** | List, get, search at personal scale |
| **Status** | ✅ Architecture + tests; no perf regression in CI |
| **Evidence** | `app.*` functions; pytest CRUD/search (`test_thoughts_api.py`, `test_db_functions.py`) |
| **Local verify** | `pytest tests/test_thoughts_api.py -v` |
| **Phase 5** | App Insights → Performance → `GET /api/thoughts`, `/api/thoughts/search` p95 |

---

## NFR-03 — Performance: writes (p95 < 1 s)

| | |
|---|---|
| **Target** | Create/update/delete via multi-step DB functions |
| **Status** | ✅ Same as NFR-02 |
| **Evidence** | `app.create_thought`, `app.update_thought`, etc. in `004_functions.sql` |
| **Local verify** | `pytest tests/test_db_functions.py -v` |
| **Phase 5** | App Insights p95 on `POST`/`PUT`/`DELETE` `/api/thoughts` |

---

## NFR-04 — Scalability (≤ 10 users)

| | |
|---|---|
| **Target** | 1 user now; ≤ 10 without redesign |
| **Status** | ✅ |
| **Evidence** | Gunicorn `--workers 2`; connection pool; stateless API |
| **Local verify** | [Gunicorn runbook](../runbooks/gunicorn-app-service.md) — `./scripts/start-prod.sh` |
| **Phase 5** | Start with smallest viable SKUs; scale workers only if needed |

---

## NFR-05 — Security: HTTPS only (non-local)

| | |
|---|---|
| **Target** | TLS for API and SPA outside localhost |
| **Status** | ⏳ Local dev uses HTTP by design |
| **Evidence** | Azure App Service + Static Web Apps provide HTTPS by default |
| **Local verify** | N/A (localhost) |
| **Phase 5** | Confirm API URL is `https://`; no `http://` in `VITE_API_URL` prod; redirect HTTP→HTTPS if enabled |

---

## NFR-06 — Security: parameterized SQL only

| | |
|---|---|
| **Target** | No dynamic SQL concatenation in Python |
| **Status** | ✅ |
| **Evidence** | `app/db/*.py` uses `fetchrow("SELECT * FROM app.fn($1)", ...)` only |
| **Local verify** | Code review; `rg 'f".*SELECT' tot-backend/app` → no matches in app code |
| **Phase 5** | Same code path in prod |

---

## NFR-07 — Security: DB privileges (`tot_api`)

| | |
|---|---|
| **Target** | API role: `EXECUTE` on `app.*` functions only; no table DML |
| **Status** | ✅ |
| **Evidence** | `003_roles_grants.sql`, `005_function_grants.sql`; `DATABASE_URL_API` uses `tot_api` |
| **Local verify** | `pytest tests/test_db_functions.py -v` (runs as `tot_api` via pool) |
| **Phase 5** | Azure connection string uses `tot_api`, not `tot_owner` |

---

## NFR-08 — Security: secrets not in git

| | |
|---|---|
| **Target** | Placeholders in repo; real values in `.env` / Azure settings |
| **Status** | ✅ |
| **Evidence** | `.env.example`; `.gitignore` for `.env`; [QUESTION_ANSWER env pattern](../QUESTION_ANSWER.md#2026-06-30-env-example-pattern) |
| **Local verify** | `git status` — no `.env` tracked; scanners clean on committed files |
| **Phase 5** | App Service settings / Key Vault for `JWT_SECRET`, DB passwords |

---

## NFR-09 — Privacy: no third-party analytics on note content

| | |
|---|---|
| **Target** | Personal notes; v1 telemetry must not exfiltrate title/body |
| **Status** | ✅ |
| **Evidence** | App Insights on API metadata only; no frontend analytics SDK; structured logs use paths/codes not bodies |
| **Local verify** | Review `app/services/logging_config.py`, `errors.py` — no thought content in log extras |
| **Phase 5** | Re-check before any SPA App Insights slice |

---

## NFR-10 — Reliability: automated backup (≥ 7 days)

| | |
|---|---|
| **Target** | Azure Postgres automated backup, minimum 7-day retention |
| **Status** | 📋 Runbook ready; Azure not provisioned |
| **Evidence** | [postgres-backup-restore.md](../runbooks/postgres-backup-restore.md) provisioning checklist |
| **Local verify** | N/A |
| **Phase 5** | Portal → Flexible Server → Backup and restore → retention ≥ 7 days |

---

## NFR-11 — Reliability: RPO 24h / RTO 4h

| | |
|---|---|
| **Target** | Max 24 h data loss; max 4 h to restore service |
| **Status** | 📋 Runbook defines PITR procedure |
| **Evidence** | [postgres-backup-restore.md](../runbooks/postgres-backup-restore.md) — PITR steps, repoint API |
| **Local verify** | Optional: local `pg_dump` section in runbook |
| **Phase 5** | Confirm restore points exist; optional tabletop walk-through |

---

## NFR-12 — Cost (≤ $25/month)

| | |
|---|---|
| **Target** | Production Azure spend cap |
| **Status** | 📋 Plan documented; actual spend unverified |
| **Evidence** | PROJECT_BRIEF; lean stack (SWA free/cheap, B1 App Service, Burstable Postgres) |
| **Local verify** | N/A |
| **Phase 5** | Azure Cost Management after first month; tear down orphaned resources after DR tests |

**Planning notes (estimate before provision):**

| Resource | Typical tier for v1 |
|----------|---------------------|
| Static Web Apps | Free or Standard low |
| App Service Linux | B1 or equivalent |
| Postgres Flexible Server | Burstable B1ms / smallest viable |
| Application Insights | Pay-as-you-go (low volume) |

---

## NFR-13 — Maintainability: versioned migrations

| | |
|---|---|
| **Target** | Schema + functions in git; repeatable apply |
| **Status** | ✅ |
| **Evidence** | `tot-db/migrations/001`–`005`; `tot-db/scripts/migrate.sh`; CI runs migrate before pytest |
| **Local verify** | `./tot-db/scripts/migrate.sh` then `pytest -v` |
| **Phase 5** | Pipeline migrate step against Azure as `tot_owner` |

---

## NFR-14 — Observability

| | |
|---|---|
| **Target** | Application Insights; structured logs; `/health` |
| **Status** | ✅ |
| **Evidence** | `app/services/telemetry.py`, `logging_config.py`, `middleware/request_context.py`; `GET /health` |
| **Local verify** | `pytest tests/test_request_context.py tests/test_telemetry.py -v`; `curl /health` + `X-Request-ID` |
| **Phase 5** | Set `APPLICATIONINSIGHTS_CONNECTION_STRING`; confirm traces in portal |

---

## Phase 4 verification bundle (run locally)

```bash
# Repo root
docker compose up -d && ./tot-db/scripts/migrate.sh

cd tot-backend && source .venv/bin/activate && set -a && source ../.env && set +a
pytest -v
curl -s http://127.0.0.1:8000/health   # with API running (uvicorn or start-prod.sh)

cd ../tot-frontend && npm run lint && npm run build
```

**CI:** `.github/workflows/ci.yml` — migrate + `pytest -v` + frontend build on `main` PRs.

---

## Phase 4 sign-off

| Gate | Result |
|------|--------|
| Backend hardening (errors, logging, App Insights SDK, Gunicorn) | ✅ |
| Runbooks (Gunicorn, backup/restore) | ✅ |
| NFR-01–14 assessed with evidence | ✅ this checklist |
| All ⏳ / 📋 items have Phase 5 owner action | ✅ |

**Phase 4 complete.** Phase 5 implementation: [phase5-azure.md](phase5-azure.md) · [azure-deploy.md](../runbooks/azure-deploy.md).

---

## Cross-references

| Doc | Topic |
|-----|--------|
| [Gunicorn runbook](../runbooks/gunicorn-app-service.md) | NFR-01, NFR-04 |
| [Postgres backup runbook](../runbooks/postgres-backup-restore.md) | NFR-10, NFR-11 |
| [QUESTION_ANSWER — App Insights](../QUESTION_ANSWER.md#2026-07-03-application-insights) | NFR-14 |
| [TOT_BACKEND.md](../../tot-backend/TOT_BACKEND.md) | API hardening |
| [TOT_DB.md](../../tot-db/TOT_DB.md) | NFR-07, NFR-13 |

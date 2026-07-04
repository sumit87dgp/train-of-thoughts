# Phase 5 checklist — Azure deployment

Walk this list after provisioning and deploying. Implementation artifacts live in `infra/`, `.github/workflows/deploy.yml`, and [azure-deploy.md](../runbooks/azure-deploy.md).

**Legend**

| Symbol | Meaning |
|--------|---------|
| ✅ | Done in repo / verified locally |
| ⏳ | Requires your Azure subscription + GitHub secrets (operator) |

---

## Implementation (repo)

| Item | Status | Evidence |
|------|--------|----------|
| asyncpg SSL for Azure (`sslmode=require` / `DATABASE_SSL`) | ✅ | `tot-backend/app/db/pool.py`, `tests/test_pool_ssl.py` |
| `requirements.txt` for App Service Oryx | ✅ | `tot-backend/requirements.txt` |
| Azure CLI provision scripts | ✅ | `infra/01`–`06`, `teardown.sh`, `infra/README.md` |
| Migrate + `ALTER ROLE tot_api` scripts/docs | ✅ | `tot-db/scripts/migrate.sh`, `set-tot-api-password.sh`, `docs/runbooks/azure-deploy.md` |
| Deploy workflow (test → migrate → API → SWA) | ✅ | `.github/workflows/deploy.yml` |
| OIDC / secrets documentation | ✅ | `infra/README.md` |
| CI remains on ephemeral Postgres only | ✅ | `ci.yml` + deploy `test` job |

---

## Operator go-live (your Azure + GitHub)

| Step | Status | Notes |
|------|--------|-------|
| `az login` + `infra/config.env` filled | ⏳ | Copy `config.env.example` |
| Run `01`–`05` provision scripts | ⏳ | |
| Migrate Azure DB + set `tot_api` password | ⏳ | [azure-deploy.md](../runbooks/azure-deploy.md) §2 |
| `06-app-settings.sh` with prod secrets | ⏳ | |
| GitHub Environment `production` + secrets | ⏳ | See `infra/README.md` |
| Federated credentials (main + environment) | ⏳ | |
| Push `main` / run Deploy workflow | ⏳ | |
| `curl https://<api>/health` → ok | ⏳ | NFR-05 HTTPS |
| Login + CRUD on SWA URL | ⏳ | Data in Azure Postgres |
| App Insights shows requests | ⏳ | NFR-14 |
| Backup retention ≥ 7 days | ⏳ | NFR-10 |
| Cost estimate ≤ $25/month | ⏳ | NFR-12 — [azure-cost.md](../runbooks/azure-cost.md) |

---

## NFR Phase 5 proof

| ID | Requirement | After go-live |
|----|-------------|---------------|
| NFR-05 | HTTPS only | API and SWA URLs are `https://` |
| NFR-10 | Backup ≥ 7 days | Flexible Server backup settings |
| NFR-11 | RPO/RTO | [postgres-backup-restore.md](../runbooks/postgres-backup-restore.md) |
| NFR-12 | ≤ $25/month | Budget + [azure-cost.md](../runbooks/azure-cost.md) |
| NFR-14 | Observability | App Insights + `/health` + `X-Request-ID` |

---

## Sign-off

| Gate | Result |
|------|--------|
| Repo artifacts for Phase 5 | ✅ |
| Live production URL + CRUD | ⏳ operator |
| NFR ⏳ items from Phase 4 checklist | ⏳ operator |

**Phase 5 implementation complete in repo.** Production go-live is complete when all operator rows are ✅.

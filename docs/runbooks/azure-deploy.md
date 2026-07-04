# Azure deploy runbook (Phase 5)

Provision Azure resources, migrate the database, configure secrets, and deploy via GitHub Actions.

**Related:** [infra/README.md](../../infra/README.md) · [gunicorn-app-service.md](gunicorn-app-service.md) · [postgres-backup-restore.md](postgres-backup-restore.md) · [phase5-azure checklist](../checklists/phase5-azure.md)

---

## Prerequisites

- Azure CLI (`az login`), subscription selected
- GitHub repo with `prod` branch (deploy trigger)
- `psql` client (for migrations from your machine)
- Bash (Git Bash, WSL, or Linux)

---

## 1. Provision (Azure CLI scripts)

```bash
cd infra
cp config.env.example config.env
# Edit config.env: RESOURCE_GROUP, LOCATION, NAME_PREFIX, TOT_OWNER_PASSWORD, CLIENT_IP

chmod +x *.sh
./01-resource-group.sh
./02-postgres.sh
./03-app-insights.sh
./04-app-service.sh
./05-static-web-app.sh
```

Save outputs:

| Output | Store as |
|--------|----------|
| Postgres FQDN | Connection strings |
| App Insights connection string | App Service / note |
| SWA URL | `CORS_ORIGINS`, browser |
| SWA deployment token | GitHub secret `AZURE_STATIC_WEB_APPS_API_TOKEN` |
| API URL `https://<webapp>.azurewebsites.net` | GitHub secret `VITE_API_URL` |

Confirm backup retention ≥ 7 days: Portal → Flexible Server → **Backup and restore** ([backup runbook](postgres-backup-restore.md)).

---

## 2. Migrate Azure Postgres (tot_owner)

Migration `003_roles_grants.sql` creates `tot_api` with password `tot_api_dev`. Immediately set a strong production password.

```bash
# From repo root — use your real owner password and FQDN
export DATABASE_URL='postgres://tot_owner:OWNER_PASSWORD@YOUR_SERVER.postgres.database.azure.com:5432/tot?sslmode=require'

chmod +x tot-db/scripts/migrate.sh tot-db/scripts/set-tot-api-password.sh
./tot-db/scripts/migrate.sh

export TOT_API_PASSWORD='strong-random-tot-api-password'
./tot-db/scripts/set-tot-api-password.sh
```

### Smoke checks (NFR-07)

```bash
# As tot_api — function call should work
psql "postgres://tot_api:${TOT_API_PASSWORD}@YOUR_SERVER.postgres.database.azure.com:5432/tot?sslmode=require" \
  -c "SELECT * FROM app.list_thoughts(NULL, 5, 0);"

# Direct table access should fail
psql "postgres://tot_api:${TOT_API_PASSWORD}@YOUR_SERVER.postgres.database.azure.com:5432/tot?sslmode=require" \
  -c "SELECT * FROM app.thoughts LIMIT 1;"
# Expect: permission denied
```

**Never** point CI `pytest` at this database. CI uses ephemeral Postgres only ([pytest DB environments](../QUESTION_ANSWER.md#2026-07-03-pytest-db-environments)).

### If you applied SQL in DBeaver first

`migrate.sh` tracks versions in `public.schema_migrations`. If you ran `001`–`005` by hand and **did not** insert those rows, the next pipeline migrate will try to apply them again.

- Migrations are written to be **idempotent** where possible (`IF NOT EXISTS`, `CREATE OR REPLACE`, type create with duplicate ignore).
- Prefer letting the pipeline migrate, **or** after a manual apply, record versions:

```sql
INSERT INTO public.schema_migrations (version) VALUES
  ('001_schema.sql'),
  ('002_tables.sql'),
  ('003_roles_grants.sql'),
  ('004_functions.sql'),
  ('005_function_grants.sql')
ON CONFLICT (version) DO NOTHING;
```

Only insert versions you fully applied.

---

## 3. App Service settings

```bash
export DATABASE_URL_API="postgres://tot_api:${TOT_API_PASSWORD}@YOUR_SERVER.postgres.database.azure.com:5432/tot?sslmode=require"
export JWT_SECRET="$(openssl rand -hex 32)"
export CORS_ORIGINS="https://YOUR_SWA.azurestaticapps.net"
export TOT_USER=admin
export TOT_PASSWORD='your-login-password'

./infra/06-app-settings.sh
```

`DATABASE_SSL=true` is set by the script so asyncpg uses TLS even if the URL parser differs.

---

## 4. GitHub secrets and OIDC

See [infra/README.md](../../infra/README.md#github-secrets-and-oidc) for the full secret list and federated credential setup.

Minimum secrets:

| Secret | Purpose |
|--------|---------|
| `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` | OIDC login for deploy |
| `AZURE_WEBAPP_NAME` | App Service name |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA deploy |
| `VITE_API_URL` | Frontend build (`https://…azurewebsites.net`) |
| `DATABASE_URL` | Migrate job only (`tot_owner`, `sslmode=require`) |
| `TOT_API_PASSWORD` | Optional post-migrate password step in workflow |

---

## 5. Deploy

Push to `prod` or run **Actions → Deploy → Run workflow** (select branch **`prod`**).

Workflow [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml):

1. **test** — same as CI (ephemeral Postgres; never prod)
2. **migrate** — `tot-db/scripts/migrate.sh` with secret `DATABASE_URL`
3. **deploy-api** — zip `tot-backend` to App Service
4. **deploy-web** — build SPA with `VITE_API_URL`, deploy to Static Web Apps

---

## 6. Verify

| Check | Command / action |
|-------|------------------|
| Health | `curl -sS https://<api>.azurewebsites.net/health` → `{"status":"ok"}` |
| Request ID | Response header `X-Request-ID` |
| HTTPS | Frontend uses `https://` API URL only |
| Login + CRUD | Open SWA URL, sign in, create a thought |
| App Insights | Portal → Application Insights → transaction search |
| Backups | Flexible Server → Backup retention ≥ 7 days |
| Cost | Budget alert + [azure-cost.md](azure-cost.md) (NFR-12 ≤ $25/month) |

Record results in [phase5-azure checklist](../checklists/phase5-azure.md).

---

## Teardown

```bash
./infra/teardown.sh
```

Deletes the entire resource group (stops all charges for those resources).

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| API startup fails, SSL errors | Missing `sslmode=require` or `DATABASE_SSL=true` |
| `password authentication failed for tot_api` | Forgot `set-tot-api-password.sh` after migrate |
| CORS errors in browser | `CORS_ORIGINS` must match SWA origin exactly (https, no trailing slash) |
| 503 on App Service | Check Log stream; confirm startup command and `requirements.txt` |
| Migrate from laptop times out | Add `CLIENT_IP` firewall rule via `02-postgres.sh` or portal |

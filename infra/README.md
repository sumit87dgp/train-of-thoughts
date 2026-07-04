# Azure infrastructure (Phase 5)

Azure CLI scripts to provision Train of Thoughts production resources.

**Runbook:** [docs/runbooks/azure-deploy.md](../docs/runbooks/azure-deploy.md)

## Cost defaults (NFR-12)

| Resource | SKU |
|----------|-----|
| App Service Plan | B1 Linux |
| PostgreSQL Flexible Server | Burstable B1ms, 32 GB, 7-day backup, no geo-redundant backup |
| Static Web Apps | Free |
| Application Insights | Pay-as-you-go (low volume) |

**Full guide:** [docs/runbooks/azure-cost.md](../docs/runbooks/azure-cost.md)

| When | Command |
|------|---------|
| Not using the app for days | `./stop-idle.sh` (stops Postgres + web app) |
| Using the app again | `./start-prod.sh` |
| Pause project for weeks | `./teardown.sh` (deletes RG — all charges for RG stop) |

Set a **$25/month budget alert** on the resource group on day one (portal Cost Management).

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- `az login` and a subscription you can use
- Bash (Git Bash / WSL / Linux)
- `psql` for migrations from your machine

```bash
az login
az account list -o table
```

## Configure

```bash
cd infra
cp config.env.example config.env
```

Edit `config.env` (gitignored):

- `RESOURCE_GROUP`, `LOCATION` (e.g. `centralindia` or `eastus`)
- `NAME_PREFIX` (globally unique suffixes for web app / postgres names)
- `TOT_OWNER_PASSWORD` (strong admin password)
- `CLIENT_IP` (your public IP, for laptop `psql` / migrate)
- `STATIC_WEB_APP_LOCATION` if needed (Free tier: `eastasia`, `eastus2`, `westus2`, `westeurope`, `centralus`)

## Provision order

```bash
chmod +x *.sh
./01-resource-group.sh
./02-postgres.sh
./03-app-insights.sh
./04-app-service.sh
./05-static-web-app.sh
```

Then migrate and set app settings — see [azure-deploy.md](../docs/runbooks/azure-deploy.md).

```bash
# After migrate + ALTER ROLE tot_api:
export DATABASE_URL_API='postgres://tot_api:...@FQDN:5432/tot?sslmode=require'
export JWT_SECRET='...'
export CORS_ORIGINS='https://....azurestaticapps.net'
export TOT_USER=admin
export TOT_PASSWORD='...'
./06-app-settings.sh
```

## Scripts

| Script | Purpose |
|--------|---------|
| `01-resource-group.sh` | Resource group |
| `02-postgres.sh` | Flexible Server, DB `tot`, firewall |
| `03-app-insights.sh` | Log Analytics + Application Insights |
| `04-app-service.sh` | Plan + Python web app, Gunicorn startup, `/health` |
| `05-static-web-app.sh` | Free SWA + deployment token |
| `06-app-settings.sh` | Secrets as App Service settings |
| `stop-idle.sh` | Stop Postgres + web app (save cost) |
| `start-prod.sh` | Start Postgres + web app |
| `teardown.sh` | Delete resource group |

## GitHub secrets and OIDC

Prefer **OIDC federated credentials** (no long-lived client secret in GitHub).

### 1. App registration + federated credential

```bash
# Example — adjust names and your GitHub org/repo
APP_NAME=tot-github-deploy
RG=rg-tot-prod   # or any RG; SP needs rights on the deploy RG
SUB=$(az account show --query id -o tsv)
REPO=YOUR_GITHUB_USER/train-of-thoughts   # owner/repo

az ad app create --display-name "$APP_NAME"
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)

az ad sp create --id "$APP_ID"
az role assignment create \
  --assignee "$APP_ID" \
  --role Contributor \
  --scope "/subscriptions/${SUB}/resourceGroups/${RG}"

# Federated credential for GitHub Actions (prod branch pushes — deploy.yml)
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"tot-github-prod\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${REPO}:ref:refs/heads/prod\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

# Federated credential for jobs that use environment: production (deploy.yml)
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"tot-github-env-production\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${REPO}:environment:production\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"
```

Create a GitHub **Environment** named `production` (Settings → Environments) and add the deploy secrets there (or as repository secrets).

Tenant ID:

```bash
az account show --query tenantId -o tsv
```

### 2. GitHub repository secrets

| Secret | Value |
|--------|--------|
| `AZURE_CLIENT_ID` | App (client) ID |
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID |
| `AZURE_WEBAPP_NAME` | Web app name (e.g. `tot-api`) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | From `05-static-web-app.sh` |
| `VITE_API_URL` | `https://<webapp>.azurewebsites.net` (no trailing slash) |
| `DATABASE_URL` | `postgres://tot_owner:...@FQDN:5432/tot?sslmode=require` (**migrate only**) |
| `TOT_API_PASSWORD` | Production `tot_api` password (workflow sets role after migrate) |

**Do not** add `DATABASE_URL_API` to the CI test job. Tests use ephemeral Postgres in [ci.yml](../.github/workflows/ci.yml).

### 3. Deploy

Push to `prod` or run **Deploy** workflow manually (`.github/workflows/deploy.yml`, select branch **`prod`**).

## Teardown

```bash
./teardown.sh
```

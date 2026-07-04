# Azure cost management (NFR-12)

Keep Train of Thoughts production spend at or under **$25/month**, and avoid surprise bills.

**Related:** [azure-deploy.md](azure-deploy.md) · [infra/README.md](../../infra/README.md) · [phase5-azure checklist](../checklists/phase5-azure.md) · [PROJECT_BRIEF NFR-12](../architecture/PROJECT_BRIEF.md)

---

## What costs money in this stack

| Resource | Default SKU (infra scripts) | Typical share of bill | Idle cost? |
|----------|----------------------------|------------------------|------------|
| **PostgreSQL Flexible Server** | Burstable **B1ms**, 32 GB, 7-day backup | **Largest** (~half or more) | Yes — billed while running |
| **App Service Plan** | **B1** Linux | Second largest | Yes — plan billed even if app idle |
| **Static Web Apps** | **Free** | $0 | No |
| **Application Insights** | Pay-as-you-go | Usually cents at personal traffic | Minimal |
| **Log Analytics** | Pay-as-you-go | Usually cents | Minimal |
| **Bandwidth** | — | Negligible for personal use | — |

**Rule of thumb:** Postgres + App Service Plan drive almost all cost. SWA Free and low App Insights volume are cheap.

Prices vary by **region** and change over time. Always check:

- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
- Portal → **Cost Management + Billing** → **Cost analysis** (filter by resource group `rg-tot-prod` or your `RESOURCE_GROUP`)

---

## Target budget (NFR-12)

| Item | Target |
|------|--------|
| Monthly cap | **≤ $25 USD** |
| Alert threshold | **$15** (warning) and **$25** (hard attention) |
| Scope | Single resource group for this app only |

If you also run other Azure resources in the same subscription, create a **budget filtered to the Train of Thoughts resource group** so other projects do not hide this app’s spend.

---

## One-time setup (do this on day one)

### 1. Tag everything

Scripts already tag the resource group with `project=train-of-thoughts`. In Cost analysis, group by tag or resource group.

### 2. Create a budget + email alert

Portal: **Cost Management + Billing** → **Budgets** → **Add**

| Setting | Value |
|---------|--------|
| Scope | Your subscription (or management group) |
| Filters | Resource group = `rg-tot-prod` (or your name) |
| Amount | **25** USD / month |
| Alerts | 50% ($12.50), 80% ($20), 100% ($25) |
| Recipients | Your email |

Azure CLI example (adjust names and email):

```bash
# Requires: az extension add --name costmanagement  (if prompted)
az consumption budget create \
  --budget-name tot-monthly-25 \
  --amount 25 \
  --time-grain Monthly \
  --start-date "$(date -u +%Y-%m-01T00:00:00Z)" \
  --end-date 2030-12-31T00:00:00Z \
  --resource-group rg-tot-prod
```

Portal budgets with email action groups are usually clearer than CLI for personal accounts — use the portal if the CLI budget command differs by subscription type (MCA vs EA vs Pay-As-You-Go).

### 3. Confirm cheap defaults

After provision, verify:

| Check | Expected |
|-------|----------|
| Postgres SKU | Burstable **B1ms** (not D-series / General Purpose) |
| Geo-redundant backup | **Disabled** |
| Backup retention | **7 days** (not 35) |
| App Service plan | **B1** (or Free **F1** only for experiments — see below) |
| Static Web Apps | **Free** |
| No extra App Service plans | One plan, one web app |

---

## Day-to-day cost controls

### When you are actively using the app

Leave everything running. Personal traffic will not move the needle on App Insights or bandwidth.

### When you will not use it for days/weeks

**Stop the expensive resources** (data is kept; you pay little or nothing for compute while stopped):

```bash
cd infra
# requires config.env
./stop-idle.sh
```

This stops:

1. **PostgreSQL Flexible Server** (largest saver)
2. **App Service** (stops the site; plan may still incur a small charge on B1 — see note below)

Start again before using the app:

```bash
./start-prod.sh
```

| Resource | Stop behavior |
|----------|----------------|
| Postgres Flexible Server | **Stop** supported — no compute charge while stopped; storage still billed (small) |
| App Service (B1) | App can be **stopped**; **B1 plan still bills** unless you delete the plan or scale to Free |
| SWA Free | Leave as-is ($0) |

**Honest B1 note:** Stopping the web app alone does **not** fully stop App Service Plan charges. To save the plan cost when idle for a long time:

- Option A: `./teardown.sh` and re-provision later (full wipe — use only if you have DB backup / accept data loss)
- Option B: Scale plan to **F1 (Free)** while idle (app sleeps; cold start; limited features)
- Option C: Accept B1 plan cost and only stop **Postgres** (still the biggest win)

### Long idle / end of experiment

```bash
./teardown.sh
```

Deletes the **entire resource group** — all charges for those resources stop. Export thoughts first if you care about data (`pg_dump` — see [postgres-backup-restore.md](postgres-backup-restore.md)).

---

## Cheaper SKU options (tradeoffs)

| Change | Saves | Tradeoff |
|--------|-------|----------|
| App Service **F1** instead of B1 | Plan cost | Sleeps after idle; slow cold start; no always-on; limited compute minutes |
| Stop Postgres when not learning | Most of DB compute | App `/health` and UI fail until you start it again |
| Tear down RG between learning sprints | Everything | Re-run provision + migrate |
| Shorter backup retention (min 7) | Slight storage | Already at minimum for NFR-10 |
| Skip App Insights | Tiny | Harder prod debugging (NFR-14) |

**Do not** enable: geo-redundant backup, Premium SWA, General Purpose Postgres, multiple App Service instances.

---

## Monthly checklist (5 minutes)

1. Portal → **Cost Management** → **Cost analysis** → last 30 days → filter resource group.
2. Confirm total **≤ $25** (or understand why not).
3. Check budgets/alerts still active.
4. If spend is high: confirm Postgres is B1ms and not left as a larger SKU; confirm no forgotten resources outside the RG.
5. If you are not using the app this month: `stop-idle.sh` or `teardown.sh`.

Record the monthly figure in [phase5-azure.md](../checklists/phase5-azure.md) when you close NFR-12.

---

## How to read Cost analysis

Useful views:

| Group by | Why |
|----------|-----|
| **Resource** | See Postgres vs App Service vs Insights |
| **Service name** | Azure meter categories |
| **Resource group** | Confirm only `rg-tot-prod` |

Look for:

- Unexpected second App Service plan
- Postgres SKU upgrade
- Large Log Analytics ingestion (unlikely at personal scale)

---

## Free credits and subscriptions

| Situation | Tip |
|-----------|-----|
| Azure free account / trial credits | Use them; still set a **$25 budget alert** so you notice when credits end |
| Visual Studio / student benefits | Apply credits to the same subscription; budgets still recommended |
| Pay-As-You-Go | Budgets + email are essential |

Credits do **not** remove the need for alerts — surprise bills often happen the month credits expire.

---

## Quick reference commands

```bash
# Cost-oriented ops (from infra/, with config.env)
./stop-idle.sh      # stop Postgres (+ stop web app)
./start-prod.sh      # start Postgres + web app
./teardown.sh        # delete entire RG (all charges for RG stop)

# What am I running?
az resource list --resource-group rg-tot-prod -o table

# Postgres state
az postgres flexible-server show -g rg-tot-prod -n tot-pg --query state -o tsv
```

---

## Summary

| Priority | Action |
|----------|--------|
| 1 | Budget + email at **$25** on the app resource group |
| 2 | Keep **B1ms** Postgres, **no geo-backup**, **7-day** retention |
| 3 | **Stop Postgres** (and optionally the web app) when idle |
| 4 | **Tear down** the RG if you pause the project for weeks |
| 5 | Review Cost analysis monthly |

That is enough to practice real cloud cost management without over-engineering.

# PostgreSQL backup and restore (Azure + local)

Disaster recovery runbook for **Train of Thoughts** data — thoughts, tags, and `app.*` functions live in PostgreSQL.

**Related:** [TOT_DB.md](../../tot-db/TOT_DB.md) · [Backup Q&A](../QUESTION_ANSWER.md#2026-07-03-postgres-backup-restore) · [PROJECT_BRIEF NFRs](../architecture/PROJECT_BRIEF.md) · [Gunicorn runbook](gunicorn-app-service.md)

---

## Purpose

| Problem | How this runbook helps |
|---------|-------------------------|
| Accidental delete or bad migration | Restore database to a point before the mistake |
| Azure region / server failure | Recover from platform automated backups |
| “How much data can we lose?” | **RPO 24h** (NFR-11) — documented expectation |
| “How long until we’re back?” | **RTO 4h** (NFR-11) — steps to restore and repoint the API |
| Phase 5 provisioning | Checklist: enable backups, retention ≥ 7 days (NFR-10) |

**This is not application code.** The API does not run backups; **Azure Database for PostgreSQL — Flexible Server** does. This doc is the repeatable procedure when something goes wrong.

**Not covered here:** per-row audit history (see [audit columns Q&A](../QUESTION_ANSWER.md#2026-06-30-audit-columns-rpo-rto)) — DR is **whole-database restore**, not replaying row changelogs.

---

## NFR targets

| NFR | Requirement | How we meet it |
|-----|-------------|----------------|
| **NFR-10** | Automated backup; **≥ 7-day retention** | Azure Flexible Server automated backups (configure at provision) |
| **NFR-11** | **RPO 24h**, **RTO 4h** | PITR within retention window; runbook below for restore + API repoint |

**RPO** (Recovery Point Objective): maximum acceptable data loss. With point-in-time restore (PITR), Azure typically offers finer granularity than 24h; **24h is the worst-case budget** for this personal app.

**RTO** (Recovery Time Objective): maximum acceptable downtime while you restore service. Steps below should complete within **4 hours** for a solo operator.

---

## Architecture context

```text
Production (Phase 5)
  App Service (tot-backend) ──DATABASE_URL_API──► Azure Postgres Flexible Server
                                                         │
                                                         ├─ Automated full backups (daily)
                                                         └─ WAL / PITR (continuous, retention window)

Local dev
  Docker Compose Postgres (volume) ── no Azure backups
  Optional: manual pg_dump for your own snapshots
```

| Environment | Backup mechanism |
|-------------|------------------|
| **Azure prod** | Platform automated backups + PITR (primary DR) |
| **Local Docker** | Named volume persists data across restarts; **not** a DR plan — use `pg_dump` before risky experiments |
| **CI** | Ephemeral Postgres per job — no backup needed |

---

## Phase 5 provisioning checklist (one-time)

When creating **Azure Database for PostgreSQL — Flexible Server**:

1. **Backup retention** — set **≥ 7 days** (NFR-10). Default is often 7; increase only if budget allows (NFR-12 ≤ $25/month).
2. **Automated backups** — enabled by default on Flexible Server; confirm in portal **Backup and restore**.
3. **Geo-redundant backup** — optional; usually **off** for cost on a personal app unless you need cross-region DR.
4. **Document** server name, resource group, and connection strings in secure notes (not git).
5. **Smoke verify** — after first deploy, open **Backup and restore** and confirm restore points appear within 24h.

Record completion in [NFR checklist](../checklists/nfr-phase4.md) (NFR-10) when Phase 5 provisioning is done.

---

## Azure: verify backups (routine)

**Portal:** Resource → **PostgreSQL flexible server** → **Backup and restore**

| Check | Expected |
|-------|----------|
| Automated backups | Enabled |
| Retention period | ≥ 7 days |
| Restore points | List populates (may take up to ~24h after server creation) |
| Earliest restore time | Within retention window |

**Frequency:** After Phase 5 go-live, glance monthly or after any schema migration.

No CLI required for v1; optional later: `az postgres flexible-server show` for backup properties.

---

## Azure: point-in-time restore (PITR)

Use when prod data is corrupted, deleted, or a migration went wrong and you need the **whole database** as of an earlier time.

**Important:** PITR creates a **new** server instance. You repoint the API; you do not “undo” in place on the original server.

### Steps

1. **Stop writes (minimize drift)**  
   - Scale App Service to **0** instances, or stop the API, or block traffic at Static Web Apps — goal: no new thoughts during restore.

2. **Choose restore time**  
   - Pick a timestamp **before** the incident (timezone: note UTC vs local).  
   - If unsure, restore to 5–15 minutes before the last known-good state.

3. **Portal: restore**  
   - **Backup and restore** → **Restore** / **Point-in-time restore**.  
   - Target: **new server** name (e.g. `tot-pg-restored-YYYYMMDD`).  
   - Select date/time → confirm create.

4. **Wait for new server**  
   - Provisioning + restore may take **30–90+ minutes** depending on size (personal DB is small).

5. **Network and security**  
   - Ensure new server has correct **firewall rules** (App Service outbound, your IP for admin).  
   - Same Postgres version / extensions as original if possible.

6. **Migrations**  
   - Restored DB already includes schema at restore point.  
   - If you deploy **newer** API code than restore point, run `tot-db` migrations as `tot_owner` **only after** deciding whether restore point or forward migrate is correct.  
   - Typical DR: restore to before bad change → API code at matching version → no forward migration needed.

7. **Repoint API**  
   - Update App Service setting `DATABASE_URL_API` (or `DATABASE_URL`) to the **new** server connection string (`tot_api` user).  
   - Restart App Service.

8. **Verify**  
   ```bash
   curl -s https://<api-host>/health
   # Sign in → spot-check thoughts/tags in UI
   ```

9. **Cleanup**  
   - When satisfied, delete old server to avoid double billing (NFR-12).  
   - Update internal docs with new server hostname.

10. **Post-incident**  
    - Note incident time, restore time, and root cause in [CHALLENGES.md](../CHALLENGES.md) if worth remembering.

**RTO budget:** Steps 1–8 should fit within **4 hours** for a small personal database.

---

## Azure: restore to new server (latest backup)

If PITR is unavailable but a **latest snapshot** restore is offered:

- Same flow as PITR but without a custom timestamp — you get the latest backup (coarser RPO).
- Still creates a **new** server; repoint API the same way.

---

## Local dev: manual logical backup

For experiments on Docker Postgres **before** risky migrations or data wipes:

```bash
# From repo root; requires docker compose postgres running
docker compose exec -T postgres pg_dump -U tot_owner -d tot --no-owner --no-acl \
  > "tot-local-backup-$(date +%Y%m%d-%H%M%S).sql"
```

**Restore into a fresh local DB** (destructive to current `tot` — use only on dev):

```bash
# Stop API clients first
docker compose exec -T postgres psql -U tot_owner -d tot -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose exec -T postgres psql -U tot_owner -d tot < tot-local-backup-YYYYMMDD-HHMMSS.sql
./tot-db/scripts/migrate.sh   # if dump predates latest migrations
```

Local backups are **gitignored** — never commit dumps (may contain note content).

---

## What we do not rely on for v1

| Approach | Why not primary DR |
|----------|-------------------|
| Audit columns / change log tables | RPO/RTO via platform restore, not row replay |
| App-level export JSON | Nice for portability; not automated DR |
| Docker volume alone | Survives restart, not laptop loss or `docker volume rm` |
| pytest / CI databases | Ephemeral |

---

## Troubleshooting

| Symptom | Action |
|---------|--------|
| No restore points in portal | Wait 24h after server create; check retention not 0 |
| Restore fails | Check quota, region capacity, name collision |
| API up but empty/wrong data | Wrong `DATABASE_URL_API` or restored to wrong timestamp |
| Migrations fail after restore | Restore point older than code — align code version or re-run migrations carefully |
| Cost spike after DR | Delete orphaned old Flexible Server |

---

## Cross-references

| Doc | Topic |
|-----|--------|
| [QUESTION_ANSWER — backup runbook](../QUESTION_ANSWER.md#2026-07-03-postgres-backup-restore) | Why backups matter; RPO/RTO plain language |
| [QUESTION_ANSWER — audit vs RPO/RTO](../QUESTION_ANSWER.md#2026-06-30-audit-columns-rpo-rto) | Why we skip audit columns for v1 |
| [TOT_DB.md — CI/Azure](../../tot-db/TOT_DB.md) | Migrations before/after deploy |
| [BUILD_LOG — Gunicorn](../BUILD_LOG.md#2026-07-03-phase-4-gunicorn) | API restart after repoint |

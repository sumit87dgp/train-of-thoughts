# Redis on staging: security and hosting

**Date:** 2026-07-09  
**Status:** Agreed for staging VM setup; production uses Azure Cache for Redis ([ADR 0004](../architecture/adr/0004-azure-managed-databases.md))

## Context

SPPO Data 360 uses Redis for **precomputed dashboard answers** (sync worker → Redis → API), not raw datasets — see [NFR.md](../architecture/NFR.md).

| Environment | Redis hosting |
|-------------|----------------|
| **Local dev** | Docker (`redis:7-alpine` in `sppo-data-360-db/docker-compose.yml`) |
| **Staging VM** | Native install on RHEL (`dnf install redis`), loopback + password |
| **Production** | Azure Cache for Redis |

---

## The question

> What does “secure it (staging)” mean when installing Redis on the VM, and why is it important?

---

## What “secure it” means

Baseline **Redis hygiene** on the staging VM — two settings in `/etc/redis.conf`:

| Setting | Meaning |
|---------|---------|
| **`bind 127.0.0.1`** (loopback) | Redis accepts connections **only on the VM itself**, not on the LAN or internet-facing interface |
| **`requirepass`** | Every client must authenticate with a password (`REDIS_PASSWORD` / `REDIS_URL` on the server) |

Without these, default Redis often allows **any host on the network** to connect to port `6379` with **no authentication**.

For this architecture, API and sync worker run **on the same VM** as Redis:

```text
API / sync worker  →  127.0.0.1:6379  +  password   ✓
Office network     →  6379, no password              ✗
```

Do **not** open port `6379` in the firewall unless there is a rare, documented need for a remote client — prefer co-located services on localhost.

---

## Why it matters

Redis is a **cache**, not the system of record, but it still holds sensitive operational data:

- Precomputed workload summaries, failure counts, trends
- Whatever the sync worker wrote for the dashboard hot path
- Key names and TTLs that reveal what the app caches

If staging Redis is left open:

1. **Anyone on the network** who can reach `6379` can read keys (`GET`, `KEYS`) or wipe the cache (`FLUSHALL`).
2. **No caller identity** — legitimate API/sync traffic is indistinguishable from arbitrary clients.
3. **Staging is not throwaway** — it sits on the corporate network and may hold Databricks-derived aggregates; it should not be easier to attack than necessary.

This is a **common misconfiguration** in real deployments (open Redis instances are routinely scanned on internal networks).

---

## What this is *not*

The staging steps are **baseline** hardening, not full enterprise Redis security:

| In scope (staging VM) | Deferred (Azure prod / later) |
|------------------------|-------------------------------|
| Loopback bind | TLS in transit |
| Shared password | Per-service ACL users |
| Server-side env secret | Private endpoints, Azure AD auth |
| `maxmemory` optional cap | Geo-redundancy, advanced monitoring |

Azure Cache for Redis in production adds platform-level controls per [ADR 0004](../architecture/adr/0004-azure-managed-databases.md).

---

## Local Docker parity

Local dev uses Docker Redis with `--requirepass` from root `.env` (`REDIS_PASSWORD`). Same idea: password required; container port mapped to host only for local tools (Redis Insight, `redis-cli`).

---

## Operational commands (staging)

Install and hardening steps are in [STAGING_VM_DATABASES.md](../../sppo-data-360-db/STAGING_VM_DATABASES.md#redis).

Quick verify after setup:

```bash
redis-cli -a 'YOUR_PASSWORD' --no-auth-warning ping   # → PONG
```

App env on the VM (not committed):

```bash
REDIS_URL=redis://:YOUR_PASSWORD@127.0.0.1:6379/0
```

---

## Related docs

- [STAGING_VM_DATABASES.md](../../sppo-data-360-db/STAGING_VM_DATABASES.md) — install, configure, verify on RHEL
- [NFR.md](../architecture/NFR.md) — caching model (answers in Redis)
- [ADR 0003](../architecture/adr/0003-database-hosting-by-environment.md) — native installs on staging VM
- [sppo-data-360-db/README.md](../../sppo-data-360-db/README.md) — local Docker Redis

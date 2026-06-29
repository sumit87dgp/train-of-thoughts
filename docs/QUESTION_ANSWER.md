# Questions & Answers

Learning notes from questions asked during development. Newest entries first.

**Related:** [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) · [BUILD_LOG.md](BUILD_LOG.md) · [CHALLENGES.md](CHALLENGES.md)

---

## Index

- [2026-06-30 — PostgreSQL roles and grants: tot_owner vs tot_api in our app](#2026-06-30-roles-grants)
- [2026-06-30 — DBeaver tree: app vs public schemas and other Postgres folders](#2026-06-30-dbeaver-db-tree)
- [2026-06-30 — Docker Desktop shows http://localhost:5433; Postgres is not a browser service](#2026-06-30-docker-port-browser)

---

<a id="2026-06-30-roles-grants"></a>

## 2026-06-30 — Roles and grants (`003_roles_grants.sql`)

**Question:** What are roles and grants in PostgreSQL, and how do they fit our app? Why `tot_api` and `tot_owner`?

**Answer:**

### Roles and grants (PostgreSQL basics)

| Term | Meaning |
|------|---------|
| **Role** | A database identity. Can `LOGIN` (connect) or be a group. Like a user account. |
| **Grant** | Permission given to a role: e.g. `USAGE` on a schema, `EXECUTE` on a function, `SELECT` on a table. |
| **Owner** | The role that created an object. Owners have full rights on that object. |

Postgres does not use a separate “user” concept — **users are roles with `LOGIN`**.

### Our two roles

| Role | How it is created | Purpose |
|------|-------------------|---------|
| **`tot_owner`** | Docker Compose `POSTGRES_USER` when the container first starts | Owns the `app` schema, tables, types, and functions. Runs **migrations** only. Not used by the running API. |
| **`tot_api`** | Created in [`003_roles_grants.sql`](../tot-db/migrations/003_roles_grants.sql) | The **FastAPI connection user**. Least privilege: may call `app.*` functions, not touch tables directly. |

So you see both in DBeaver under **Roles**, but only `tot_api` is defined in migration `003`. `tot_owner` comes from Postgres init via `docker-compose.yml`.

### What `003` does today (Phase 0)

```sql
CREATE ROLE tot_api WITH LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA app TO tot_api;
```

That lets `tot_api` “see” schema `app`. It does **not** yet grant `EXECUTE` on functions or any access to tables — those come in **Phase 1** when functions exist (ADR-005, NFR-07).

### Why two roles? (architecture)

```text
FastAPI  --connects as-->  tot_api
                              |
                              | EXECUTE only
                              v
                         app.create_thought(...)   [SECURITY DEFINER, owned by tot_owner]
                              |
                              | runs with owner's rights
                              v
                         app.thoughts, app.tags, ...
```

1. **`tot_api`** — If the API is compromised, the attacker cannot `SELECT * FROM app.thoughts` or run ad-hoc SQL on tables (no table grants).
2. **`tot_owner`** — Owns objects and runs inside **SECURITY DEFINER** functions so normal CRUD still works in one transaction.
3. **Migrations** — Need a privileged role (`tot_owner`) to `CREATE TABLE`, `CREATE FUNCTION`, etc. The API never needs that power at runtime.

This matches [PROJECT_BRIEF.md](architecture/PROJECT_BRIEF.md) ADR-005 and NFR-07: API role gets **`EXECUTE` on functions only**.

### Who uses which connection string

| Task | Role | Example env var |
|------|------|-----------------|
| `./tot-db/scripts/migrate.sh` | `tot_owner` | `DATABASE_URL` |
| Running FastAPI / asyncpg pool | `tot_api` | `DATABASE_URL_API` |

**Takeaway:** **Roles** = who connects; **grants** = what they may do. **`tot_owner`** builds and owns; **`tot_api`** only executes the front door (`app.*` functions).

---

<a id="2026-06-30-dbeaver-db-tree"></a>

## 2026-06-30 — DBeaver database tree (tot @ localhost:5433)

**Question:** Quick summary of the Postgres folder structure in DBeaver (app, public, Event Triggers, etc.)?

**Answer:**

| Item | What it is |
|------|------------|
| **app** | Our application schema (Phase 0). Tables, functions, and views for Train of Thoughts will live here. Empty for now until Phase 1. |
| **public** | Postgres default schema. Holds `schema_migrations` from our migrate script — not app data. |
| **Event Triggers / Extensions** | Built-in Postgres system areas. DBeaver catalog views; unused in Phase 0. |
| **Storage / Roles / Admin** | Server metadata (tablespaces, users like `tot_owner`/`tot_api`, locks). For inspection, not app CRUD. |

**Takeaway:** **`app`** = our code’s home; **`public`** = defaults + migration tracking; the rest is Postgres/DBeaver infrastructure.

---

<a id="2026-06-30-docker-port-browser"></a>

## 2026-06-30 — Docker Desktop port link vs browser

**Question:** In Docker Desktop, the container is running and the Ports column shows a hyperlink `http://localhost:5433`. Does that mean Postgres should open in the browser?

**Answer:** No. You will not get a useful web page from that link for PostgreSQL.

Docker Desktop turns port mappings into clickable links and often prefixes them with `http://`. For `tot-postgres`, the mapping is:

```text
0.0.0.0:5433 → 5432/tcp
```

| Part | Meaning |
|------|---------|
| Host port **5433** | Where clients on your machine connect |
| Container port **5432** | Where Postgres listens inside the container |
| Protocol | **PostgreSQL** (database wire protocol), not HTTP |

Opening `http://localhost:5433` in a browser usually fails or shows nothing — that is expected. Postgres is not a web server.

**How to verify or connect to Postgres instead:**

```bash
# Health check
docker exec tot-postgres pg_isready -U tot_owner -d tot

# Interactive SQL (from host, if psql installed)
psql postgres://tot_owner:tot_owner_dev@localhost:5433/tot

# Interactive SQL (inside container)
docker exec -it tot-postgres psql -U tot_owner -d tot
```

GUI tools (pgAdmin, DBeaver, etc.) use host `localhost`, port **5433** — not a browser URL.

**What will open in a browser later in this project:**

| URL | Service |
|-----|---------|
| `http://localhost:5173` | React frontend (Vite) |
| `http://localhost:8000/docs` | FastAPI OpenAPI docs |

The browser talks to the API; the API talks to Postgres. You do not browse to the database directly.

**Takeaway:** The Docker Desktop link confirms the port is published. Use `psql`, `docker exec`, or a DB GUI — not a browser — to work with Postgres.

---

## New entry template

Add a line to the [Index](#index) above, then paste here:

```markdown
<a id="yyyy-mm-dd-short-slug"></a>

## YYYY-MM-DD — Title

**Question:**

**Answer:**

**Takeaway:** (optional — one line)
```

Index line format:

```markdown
- [YYYY-MM-DD — Summary under 50 words](#yyyy-mm-dd-short-slug)
```

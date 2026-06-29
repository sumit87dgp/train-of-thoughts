# Questions & Answers

Learning notes from questions asked during development. Newest entries first.

**Related:** [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) · [BUILD_LOG.md](BUILD_LOG.md) · [CHALLENGES.md](CHALLENGES.md)

---

## Index

- [2026-06-30 — .env.example vs .env: clone setup and Docker Compose env handling](#2026-06-30-env-example-pattern)
- [2026-06-30 — GitGuardian secret in docker-compose.yml: prevent, automate, remediate](#2026-06-30-gitguardian-secrets)
- [2026-06-30 — docker-compose.yml, compose up, and essential Docker commands](#2026-06-30-docker-basics)
- [2026-06-30 — Audit columns vs RPO/RTO: backups, not extra table columns for v1](#2026-06-30-audit-columns-rpo-rto)
- [2026-06-30 — PostgreSQL roles and grants: tot_owner vs tot_api in our app](#2026-06-30-roles-grants)
- [2026-06-30 — DBeaver tree: app vs public schemas and other Postgres folders](#2026-06-30-dbeaver-db-tree)
- [2026-06-30 — Docker Desktop shows http://localhost:5433; Postgres is not a browser service](#2026-06-30-docker-port-browser)

---

<a id="2026-06-30-env-example-pattern"></a>

## 2026-06-30 — `.env.example` vs `.env`: clone setup and Docker Compose env handling

**Question:** After fixing GitGuardian findings, how should environment variables be organized? When is `.env` created, and how does Docker Compose get passwords without leaking secrets into git?

**Answer:**

### The standard pattern (this repo)

| File | In git? | Purpose |
|------|---------|---------|
| `.env.example` | ✅ yes | Documents **which** variables exist and **placeholder** values only |
| `.env` | ❌ no (`.gitignore`) | Your **real local** values — created by you, never committed |
| `docker-compose.yml` | ✅ yes | References `${VAR}` names only — **no password literals or `${VAR:-default}` fallbacks** |

Same idea at the frontend layer: `tot-frontend/.env.example` → copy to `tot-frontend/.env` for Vite (`VITE_API_URL`).

### First step after cloning

`.env` is **not** in the repo. Create it from the template:

```bash
# Repo root — Docker, migrations, backend
cp .env.example .env

# Frontend (when you run the SPA)
cp tot-frontend/.env.example tot-frontend/.env
```

Then edit each `.env` and replace placeholders with **local-only** values. For a fresh machine, you pick new passwords; for an existing Docker volume, passwords in `.env` must match what Postgres was initialized with (or you reset the volume / run `ALTER USER`).

### What goes in each file

**`.env.example` (safe to commit)**

- Variable names and structure
- Obvious placeholders: `your-local-tot-owner-password`, `your-local-jwt-secret-change-me`
- Comments explaining sync rules

**`.env` (private)**

- Real dev passwords (`tot_owner_dev`, etc. on your machine)
- Connection strings where the password segment matches `TOT_OWNER_PASSWORD` / `TOT_API_PASSWORD`
- `TOT_API_PASSWORD` must match the `tot_api` role in [`003_roles_grants.sql`](../tot-db/migrations/003_roles_grants.sql) unless you change that role via a new migration

### How Docker Compose uses `.env` (important)

Docker Compose **automatically reads** a file named `.env` in the project directory for **variable substitution** in `docker-compose.yml` — e.g. `${TOT_OWNER_PASSWORD}` and `${POSTGRES_PORT:-5433}`.

We **do not** use `env_file: .env` on the Postgres service. That would inject **every** key from `.env` (`JWT_SECRET`, `DATABASE_URL`, …) into the database container’s environment, which is unnecessary and widens exposure inside the container.

Current pattern:

```yaml
environment:
  POSTGRES_DB: tot
  POSTGRES_USER: tot_owner
  POSTGRES_PASSWORD: ${TOT_OWNER_PASSWORD}
```

Compose reads `.env` on the **host** → substitutes into YAML → passes only `POSTGRES_*` into the container.

### Why `.env.example` must not copy real secrets

If `.env.example` contained the same values as your working `.env` (e.g. `tot_owner_dev`), then **checking the example file into git** would expose what scanners treat as secrets. The example file is **documentation**, not a second copy of your private config.

### Checklist for new contributors

1. `cp .env.example .env` (and frontend copy if needed)
2. Set passwords in `.env`; keep `DATABASE_URL` / `DATABASE_URL_API` in sync
3. `docker compose up -d`
4. Never commit `.env`

See also: [GitGuardian remediation](#2026-06-30-gitguardian-secrets) · [BUILD_LOG entry](BUILD_LOG.md#2026-06-30-env-security-pattern)

**Takeaway:** Committed template (placeholders) + gitignored `.env` (real values) + compose references names only. After clone, **always** `cp .env.example .env` before `docker compose up`.

---

<a id="2026-06-30-gitguardian-secrets"></a>

## 2026-06-30 — GitGuardian: secret in `docker-compose.yml`

**Question:** GitGuardian flagged line 9 in `docker-compose.yml` (`POSTGRES_PASSWORD: ${TOT_OWNER_PASSWORD:-tot_owner_dev}`). (1) How to prevent this? (2) What automation helps? (3) How to fix after commit/push? (4) General security notes.

**Answer:**

### What was flagged

GitGuardian saw a **password-like value in git-tracked source**:

```yaml
POSTGRES_PASSWORD: ${TOT_OWNER_PASSWORD:-tot_owner_dev}
```

The `${VAR:-default}` syntax still **embeds `tot_owner_dev` in the file** committed to GitHub. Scanners treat that as a leaked secret even for “local dev” passwords.

| OK in repo | Not OK in repo |
|------------|----------------|
| Variable **names** (`TOT_OWNER_PASSWORD`) | Real production passwords |
| Placeholders in `.env.example` (documented samples) | Inline password defaults in tracked YAML/code |
| Ephemeral CI test DB passwords (debated; prefer GitHub Secrets) | Same password reused in prod |

### 1. How to prevent

1. **Never put passwords in tracked files** — use `.env` (gitignored) or a secret manager.
2. **`docker-compose.yml`** — reference only `${TOT_OWNER_PASSWORD}` (no inline default). Compose reads `.env` on the host for substitution; do **not** use `env_file: .env` unless you intend every key to enter the container (we pass only `POSTGRES_*` — see [env pattern Q&A](#2026-06-30-env-example-pattern)).
3. **Before first run:** `cp .env.example .env` and keep real values in `.env` only. `.env.example` uses placeholders, not your real dev passwords.
4. **Production (Phase 5):** Azure Key Vault / App Service settings — not git (NFR-08).
5. **Review** `migrate.sh` defaults, `config.py` defaults, and migration SQL — scanners may flag those too; prefer env vars for connection strings.

**Remediated in repo:** `docker-compose.yml` uses `${TOT_OWNER_PASSWORD}` without a fallback default; `.env.example` holds placeholders only; full pattern documented in [`.env.example` vs `.env`](#2026-06-30-env-example-pattern).

### 2. Process / automation

| Layer | Tool / practice |
|-------|-----------------|
| **Pre-commit (local)** | [ggshield](https://docs.gitguardian.com/ggshield-docs/getting_started) (`ggshield install -m local`), [gitleaks](https://github.com/gitleaks/gitleaks), or `detect-secrets` — block commit before push |
| **CI / GitHub** | GitGuardian on the repo (you have this), GitHub **secret scanning** |
| **PR policy** | No merge if secret scan fails |
| **Convention** | `.env.example` = samples only; `.env` = real local secrets (in `.gitignore`) |
| **Cursor / review** | Ask agent not to add password defaults to tracked files |

Example pre-commit (conceptual):

```bash
ggshield secret scan pre-commit
```

### 3. Rectify after commit and push

**Severity for this project:** `tot_owner_dev` is a **known local dev** password — low risk if the repo is private and DB is not internet-exposed. Still **fix the pattern** so habits stay correct.

| Step | Action |
|------|--------|
| 1 | **Remove** the secret from tracked files (done for `docker-compose.yml`). |
| 2 | **Rotate** if the same value was ever used beyond local Docker (Azure, shared server) — generate a new password and update `.env`. |
| 3 | **Commit and push** the fix. |
| 4 | **Mark resolved** in GitGuardian after the scanner sees the fix on `main`. |
| 5 | **History rewrite** (optional) — if a *real* secret was pushed to a **public** repo: `git filter-repo` or BFG Repo-Cleaner, then force-push and **rotate** the secret (treat old value as compromised). Overkill for `tot_owner_dev` on a private learning repo; required for production credentials. |

If Postgres was already initialized with the old password, changing `.env` alone may require `docker compose down -v` (wipes data) or `ALTER USER` inside the container.

### 4. Security mindset (this app)

- **NFR-08:** No secrets in git; prod uses App Service / Key Vault.
- **Least privilege:** `tot_api` vs `tot_owner` (see [roles Q&A](#2026-06-30-roles-grants)).
- **GitGuardian is a safety net** — prevention is: secrets in `.env` / vault, not in compose, code, or migrations when avoidable.
- **`.env.example`** may still trigger some tools; it is intentionally committed as documentation — use obvious placeholders (`change-me`).

**Takeaway:** Scanners flag **passwords in git**, not just “real” ones. Use `.env.example` (placeholders) + `.env` (secrets); compose references `${VAR}` only; automate with ggshield/gitleaks; rotate and rewrite history only when exposure mattered.

---

## 2026-06-30 — Docker basics for this project

**Question:** Is `docker-compose.yml` the blueprint of the image? What command brings up the container? What Docker commands should a developer know?

**Answer:**

### `docker-compose.yml` — image or something else?

**Close, but more precise:** it is the blueprint for your **stack of services (containers)**, not usually a custom image.

| Concept | What it is |
|---------|------------|
| **Image** | Read-only template (e.g. `postgres:16-alpine` from Docker Hub) |
| **Container** | A running (or stopped) instance of an image |
| **`docker-compose.yml`** | Declares **services**: which image to use, env vars, ports, volumes, health checks |

In [docker-compose.yml](../docker-compose.yml) we **do not build** a custom image — we **pull** `postgres:16-alpine` and configure how it runs (DB `tot`, user `tot_owner`, port `5433→5432`, volume `tot_pg_data`).

A `build:` section plus `Dockerfile` is the path to **build your own image** (e.g. containerizing the API later).

### Command that started our Postgres container

From the repo root:

```bash
docker compose up -d
```

| Part | Meaning |
|------|---------|
| `up` | Create and start services from the compose file |
| `-d` | Detached (run in background) |

**Compose commands useful for Train of Thoughts:**

```bash
docker compose ps              # status (healthy?, ports)
docker compose logs postgres   # container logs
docker compose stop            # stop, keep containers
docker compose start           # start stopped containers
docker compose down            # stop and remove containers
docker compose down -v         # also remove volumes — wipes DB data
```

### Essential Docker commands (developer cheat sheet)

**Images**

| Command | Purpose |
|---------|---------|
| `docker pull postgres:16-alpine` | Download an image |
| `docker images` | List local images |
| `docker rmi <image>` | Remove an image |
| `docker build -t myapp .` | Build from a `Dockerfile` |

**Containers**

| Command | Purpose |
|---------|---------|
| `docker ps` | Running containers |
| `docker ps -a` | All containers |
| `docker start / stop / restart <name>` | Lifecycle |
| `docker rm <name>` | Remove a stopped container |
| `docker logs -f <name>` | Follow logs |
| `docker exec -it tot-postgres psql -U tot_owner -d tot` | Run a command inside the container |
| `docker inspect <name>` | Ports, mounts, config |

**Cleanup / debug**

| Command | Purpose |
|---------|---------|
| `docker system df` | Disk usage |
| `docker volume ls` | List volumes (e.g. `tot_pg_data`) |
| `docker system prune` | Remove unused data (use carefully) |

### How it fits Train of Thoughts

```text
docker-compose.yml  →  defines service "postgres"
       ↓
docker compose up -d  →  pulls image, creates tot-postgres, mounts volume
       ↓
localhost:5433  →  Postgres for migrate.sh, DBeaver, backend
```

**Takeaway:** Compose describes **how to run** services; `docker compose up -d` starts them. Our DB uses a **published image**, not a custom build (yet).

---

## 2026-06-30 — Audit columns vs RPO / RTO

**Question:** Tables in [TOT_DB.md](../tot-db/TOT_DB.md) have no full audit columns. Would those help for RPO/RTO later, or is that overkill?

**Answer:**

**RPO/RTO and row audit columns solve different problems.**

| Concept | Meaning | How we meet it (brief) |
|---------|---------|-------------------------|
| **RPO** (Recovery Point Objective) | Max acceptable data loss | Azure Postgres **automated backups** (NFR-10, NFR-11: RPO 24h) |
| **RTO** (Recovery Time Objective) | Max time to restore service | **Restore whole database** from backup / PITR + runbook (RTO 4h) |

Disaster recovery = **platform backup + restore**, not replaying per-row change logs.

**What we already have:** `app.thoughts` has `created_at` and `updated_at` — enough for MVP listing and “when was this edited?” `tags` and `thought_tags` have no timestamps; fine for v1.

**What “audit columns” often means (and why we skip most for v1):**

| Column | Purpose | Needed for RPO/RTO? |
|--------|---------|---------------------|
| `created_by` / `updated_by` | Who changed a row | No — v1 is single-user |
| `deleted_at` (soft delete) | Trash / undo | No — helps accidental delete, not DR |
| History table | Full change log | No — compliance/debugging; extra complexity |

**Verdict:** Skip full audit columns for Phase 1. RPO/RTO are covered later by Azure backups and a restore runbook (Phase 4–5). Optional later: `created_at` on `tags`, soft delete on `thoughts`, or a history table if multi-user or change-log UX matters.

**Takeaway:** Backups restore the **whole DB**; `created_at`/`updated_at` on `thoughts` are sufficient for v1.

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

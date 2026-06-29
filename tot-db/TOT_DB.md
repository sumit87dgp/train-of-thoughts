# Train of Thoughts — Database Plan

> **Parent document:** [PROJECT_BRIEF.md](../docs/architecture/PROJECT_BRIEF.md)

This plan defines the PostgreSQL layer for Train of Thoughts. All application CRUD flows through `app.*` functions; the API database role has `EXECUTE` only — no direct table access.

**Relevant ADRs:** ADR-002 (functions own CRUD), ADR-003 (functions over procedures), ADR-004 (parameterized calls), ADR-005 (SECURITY DEFINER + restricted API role), ADR-009 (versioned SQL migrations), NFR-07 (least-privilege DB role), NFR-13 (version-controlled schema/functions).

---

## Goals

1. Encapsulate all data operations in PostgreSQL functions under the `app` schema.
2. Enforce least privilege: `tot_api` role can call functions but cannot read or write tables directly.
3. Support MVP features: thoughts CRUD, tags (many-to-many), keyword search.
4. Provide repeatable, version-controlled migrations for local Docker and Azure Flexible Server.

---

## Folder Layout

```text
tot-db/
├── TOT_DB.md                   # this document
├── migrations/
│   ├── 001_schema.sql          # Phase 0: CREATE SCHEMA app (applied)
│   ├── 002_tables.sql          # Phase 1: extensions, tables, indexes, views
│   ├── 003_roles_grants.sql    # Phase 0/1: tot_api role, schema grants (applied Phase 0)
│   ├── 004_functions.sql       # Phase 1: app.* CRUD + search functions (pending)
│   └── 005_function_grants.sql # Phase 1: EXECUTE on functions for tot_api (pending)
├── functions/                  # optional: source-of-truth copies of function defs
└── roles/                      # optional: standalone grant scripts for review
```

Migrations are applied in numeric order via `scripts/migrate.sh`. Phase 0 applied `001` and `003` before tables existed; `002_tables.sql` was added as a forward migration (editing `001` alone would not re-run on an existing database).

---

## Schema Design (Migration 001)

### Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
```

### Tables

#### `app.thoughts`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | PK, default `gen_random_uuid()` |
| `title` | `TEXT` | NOT NULL, `CHECK (char_length(title) <= 500)` |
| `body` | `TEXT` | NOT NULL, default `''` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` |

#### `app.tags`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | PK, default `gen_random_uuid()` |
| `name` | `TEXT` | NOT NULL, `CHECK (char_length(name) <= 100)` |

**Uniqueness:** case-insensitive tag names via unique index on `LOWER(name)`.

#### `app.thought_tags`

| Column | Type | Constraints |
|--------|------|-------------|
| `thought_id` | `UUID` | FK → `app.thoughts(id)` ON DELETE CASCADE |
| `tag_id` | `UUID` | FK → `app.tags(id)` ON DELETE CASCADE |

**Primary key:** `(thought_id, tag_id)`.

### Indexes

| Index | Purpose |
|-------|---------|
| `thoughts_updated_at_idx` on `(updated_at DESC)` | List thoughts by recency |
| `tags_name_lower_unique` on `LOWER(name)` | Case-insensitive tag uniqueness |
| `thought_tags_tag_id_idx` on `(tag_id)` | Filter thoughts by tag |

### Views (optional, static reads)

| View | Purpose |
|------|---------|
| `app.v_tags` | `SELECT id, name FROM app.tags ORDER BY LOWER(name)` — simple tag listing for `GET /api/tags` |

Parameterized reads use functions; this view is static and safe for the API to access indirectly via a thin wrapper function if desired.

---

## Functions (Migration 004)

All API-facing functions:

- Live in schema `app`.
- Use `SECURITY DEFINER` and are owned by `tot_owner`.
- Use static SQL with bound parameters (`$1`, `$2`, …) — no dynamic SQL concatenation from user input (ADR-004).
- Run in a single transaction when touching multiple tables.

### Return Types

Define composite types for consistent asyncpg mapping:

```sql
CREATE TYPE app.thought_row AS (
    id          UUID,
    title       TEXT,
    body        TEXT,
    created_at  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ,
    tags        TEXT[]   -- tag names, sorted
);
```

### Function Catalog

| Function | Signature | Behavior |
|----------|-----------|----------|
| `app.ensure_tag` | `(p_name TEXT) RETURNS UUID` | Trim name; upsert on `LOWER(name)`; return tag id |
| `app.create_thought` | `(p_title TEXT, p_body TEXT, p_tag_names TEXT[] DEFAULT '{}') RETURNS app.thought_row` | Insert thought; call `ensure_tag` for each tag; link in `thought_tags`; return full row |
| `app.get_thought` | `(p_id UUID) RETURNS app.thought_row` | Fetch thought + aggregated tag names; raise if not found |
| `app.update_thought` | `(p_id UUID, p_title TEXT, p_body TEXT, p_tag_names TEXT[] DEFAULT '{}') RETURNS app.thought_row` | Update title/body/`updated_at`; replace tag links; return full row |
| `app.delete_thought` | `(p_id UUID) RETURNS BOOLEAN` | Delete thought (cascades `thought_tags`); return `true` if deleted |
| `app.list_thoughts` | `(p_limit INT, p_offset INT, p_tag_name TEXT DEFAULT NULL) RETURNS SETOF app.thought_row` | Paginated list, newest first; optional filter by tag name (case-insensitive) |
| `app.search_thoughts` | `(p_query TEXT, p_limit INT, p_offset INT) RETURNS SETOF app.thought_row` | Keyword search on title and body (v1: `ILIKE '%' || p_query || '%'`; Phase 6: `tsvector`) |
| `app.list_tags` | `() RETURNS TABLE (id UUID, name TEXT)` | All tags ordered by name — alternative to `v_tags` for a single EXECUTE grant surface |

### Example Call Pattern (from API via asyncpg)

```sql
SELECT * FROM app.create_thought($1, $2, $3);
SELECT * FROM app.get_thought($1);
SELECT * FROM app.list_thoughts($1, $2, $3);
SELECT * FROM app.search_thoughts($1, $2, $3);
```

### Internal Helper (not granted to API)

| Function | Purpose |
|----------|---------|
| `app._thought_with_tags` | `(p_id UUID) RETURNS app.thought_row` — private helper used by get/update/list/search |

Prefix with `_` and do **not** grant `EXECUTE` to `tot_api`.

---

## Roles and Grants (Migrations 003 and 005)

### Roles

| Role | Purpose |
|------|---------|
| `tot_owner` | Owns schema, tables, types, functions; used only for migrations and definer ownership |
| `tot_api` | Connection role used by FastAPI; EXECUTE on `app.*` functions only |

### Grant Matrix

```text
tot_owner:
  - OWNER of app schema, all tables, types, functions

tot_api:
  - GRANT USAGE ON SCHEMA app
  - GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app (except app._*)
  - NO SELECT, INSERT, UPDATE, DELETE on any table
  - NO USAGE on sequences (UUIDs via gen_random_uuid)
```

### Connection Strings

| Environment | User | Notes |
|-------------|------|-------|
| Local | `tot_api` | Password from `.env` / Docker Compose |
| Azure | `tot_api` | Password in App Service settings / Key Vault (Phase 2+) |
| Migrations | `tot_owner` | Used only in CI migration step, not by running API |

---

## Migration Runner (ADR-009)

**Choice for v1:** [dbmate](https://github.com/amacneil/dbmate) — lightweight, SQL-file based, tracks `schema_migrations` table.

### Configuration

```text
# .env (repo root or tot-db/)
DATABASE_URL=postgres://tot_owner:password@localhost:5432/tot?sslmode=disable
```

### Commands

```bash
# Apply pending migrations
dbmate -d tot-db/migrations up

# Roll back last migration (use sparingly in prod)
dbmate -d tot-db/migrations down
```

**Alternative:** a minimal `tot-db/scripts/migrate.sh` that applies `migrations/*.sql` in order if dbmate is not preferred. Document the chosen tool in the repo README when implemented.

### CI / Azure (Phase 5)

1. GitHub Actions job runs `dbmate up` against Azure Postgres using `tot_owner` credentials from secrets.
2. Migrations run **before** or **in parallel with** API deploy; API must not start against a schema older than the code expects.
3. Azure Flexible Server: enable automated backups, 7-day retention minimum (NFR-10).

---

## Local Development

### Docker Compose (repo root)

Postgres 16 with:

- Database: `tot`
- Users: `tot_owner`, `tot_api` (passwords from env)
- Volume for data persistence
- Port `5432` exposed to host

### Workflow

```bash
docker compose up -d postgres
dbmate -d tot-db/migrations up
psql postgres://tot_api:password@localhost:5432/tot -c "SELECT * FROM app.list_thoughts(10, 0, NULL);"
```

---

## Testing Strategy

### SQL Smoke Tests

Manual or scripted checks via `psql` as `tot_api`:

1. `create_thought` with tags → returns row with tag array.
2. `get_thought` returns same data.
3. `update_thought` replaces tags.
4. `list_thoughts` paginates correctly.
5. `search_thoughts` finds by keyword.
6. `delete_thought` removes row; `get_thought` fails.
7. Verify `tot_api` **cannot** `SELECT * FROM app.thoughts` (permission denied).

### Integration Tests (tot-backend)

pytest fixtures connect as `tot_api` and call functions through asyncpg (Phase 1 exit criteria). Tests run against a real Postgres instance (Docker in CI).

---

## Phased Implementation

### Phase 0 — Foundation

| Task | Exit signal |
|------|-------------|
| Add `docker-compose.yml` with Postgres 16 | `docker compose up` starts DB |
| Create empty `app` schema in `001_schema.sql` (minimal) | Schema exists |
| Wire dbmate (or migrate script) | `dbmate up` succeeds |

### Phase 1 — Database-First Core

| Task | Exit signal |
|------|-------------|
| Add `002_tables.sql` (extensions, tables, indexes, `v_tags`) | Tables visible in `\dt app.*` |
| Complete `004_functions.sql` (all functions + `thought_row` type) | CRUD works via `psql` as `tot_api` |
| Add `005_function_grants.sql` | `tot_api` has EXECUTE on functions only |
| Document smoke test commands in runbook | Repeatable manual verification |
| Backend pytest calls functions directly | Tests pass without HTTP |

**Phase 1 progress:** `002_tables.sql`, `004_functions.sql`, and `005_function_grants.sql` applied. CRUD via functions works as `tot_api`; direct table access denied.

**Phase 1 exit criteria:** Full CRUD provable via SQL/psql and pytest without UI.

### Phase 5 — Azure

| Task | Exit signal |
|------|-------------|
| Provision Azure Database for PostgreSQL Flexible Server | Server reachable |
| Store `tot_owner` URL in GitHub secrets | CI can migrate |
| Run migrations in deploy pipeline | Schema matches local |
| API connects with `tot_api` role | App Service health OK |

### Phase 6 — Enhancements (post-MVP)

- Replace `ILIKE` search with `tsvector` + GIN index.
- Materialized views or optimized search functions if needed.
- Procedures only for batch/admin jobs (e.g. archive old thoughts).

---

## Security Checklist

- [ ] All API queries use bound parameters (`$1`, `$2`) — no f-string SQL in Python.
- [ ] `SECURITY DEFINER` functions owned by `tot_owner`; audit each for SQL injection and privilege escalation.
- [ ] `tot_api` has no table DML or SELECT grants.
- [ ] Migration credentials (`tot_owner`) not used by running API.
- [ ] No secrets committed to git (NFR-08).

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [TOT_BACKEND.md](../tot-backend/TOT_BACKEND.md) | Calls `app.*` functions via asyncpg |
| [TOT_FRONTEND.md](../tot-frontend/TOT_FRONTEND.md) | Consumes REST API only; no direct DB access |
| [PROJECT_BRIEF.md](../docs/architecture/PROJECT_BRIEF.md) | Architecture principles, NFRs, ADRs |

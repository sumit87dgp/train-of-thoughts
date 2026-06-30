# Train of Thoughts — Backend Plan

> **Parent document:** [PROJECT_BRIEF.md](../docs/architecture/PROJECT_BRIEF.md)

This plan defines the FastAPI HTTP layer for Train of Thoughts. The backend is intentionally thin: validation, authentication, and orchestration only. All data access goes through parameterized calls to PostgreSQL `app.*` functions — no ORM, no ad-hoc table SQL.

**Relevant ADRs:** ADR-001 (decoupled SPA + API), ADR-004 (parameterized DB calls), ADR-006 (asyncpg, no ORM), ADR-008 (JWT first, Entra later), NFR-02/03 (performance targets), NFR-06/07 (SQL security), NFR-14 (health + observability).

**Database contract:** [TOT_DB.md](../tot-db/TOT_DB.md)

---

## Goals

1. Expose a REST JSON API over PostgreSQL functions defined in `tot-db`.
2. Validate all input with Pydantic v2; map function results to response schemas.
3. Protect routes with JWT auth (single-user MVP).
4. Enable local development with CORS for the Vite frontend.
5. Ship with pytest + httpx integration tests and OpenAPI docs at `/docs`.

---

## Folder Layout

```text
tot-backend/
├── TOT_BACKEND.md
├── pyproject.toml              # Python 3.10+, deps, pytest config
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app, lifespan, CORS, router includes
│   ├── config.py               # pydantic-settings: env vars
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py             # get_db, get_current_user dependencies
│   │   ├── health.py
│   │   ├── auth.py
│   │   ├── thoughts.py
│   │   └── tags.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── thought.py
│   │   └── tag.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth.py             # JWT create/verify, password check
│   │   └── errors.py           # HTTP exception helpers, error JSON shape
│   └── db/
│       ├── __init__.py
│       ├── pool.py             # asyncpg pool create/close
│       ├── thoughts.py         # function callers for thoughts
│       └── tags.py             # function callers for tags
└── tests/
    ├── conftest.py             # event_loop, pool, AsyncClient, auth helpers
    ├── test_health.py
    ├── test_auth.py
    ├── test_thoughts_api.py
    └── test_db_functions.py    # direct asyncpg function tests (Phase 1)
```

---

## Dependencies (pyproject.toml)

| Package | Purpose |
|---------|---------|
| `fastapi` | HTTP framework |
| `uvicorn[standard]` | ASGI server (dev) |
| `gunicorn` | Process manager (prod) |
| `asyncpg` | Async PostgreSQL driver |
| `pydantic` v2 | Request/response validation |
| `pydantic-settings` | Environment configuration |
| `python-jose[cryptography]` or `PyJWT` | JWT encode/decode |
| `passlib[bcrypt]` | Password hashing (single-user env creds) |
| `httpx` | Async test client |
| `pytest`, `pytest-asyncio` | Test runner |

---

## Configuration

Environment variables (document in root `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | `postgres://tot_api:...@host:5432/tot` |
| `JWT_SECRET` | Yes | Signing key for access tokens |
| `JWT_ALGORITHM` | No | Default `HS256` |
| `JWT_EXPIRE_MINUTES` | No | Default `1440` (24h) |
| `TOT_USER` | Yes | Single-user login name |
| `TOT_PASSWORD_HASH` | Yes* | Bcrypt hash of password |
| `TOT_PASSWORD` | Dev only | Plain password for local dev (hash at startup if hash unset) |
| `CORS_ORIGINS` | Yes | Comma-separated origins, e.g. `http://localhost:5173` |
| `LOG_LEVEL` | No | Default `INFO` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Prod | Phase 4+ |

`config.py` uses `pydantic-settings` with validation; fail fast on missing required vars in non-dev environments.

---

## Application Bootstrap (`main.py`)

```mermaid
flowchart TB
  Start[Lifespan start]
  Pool[Create asyncpg pool]
  Routes[Mount routers]
  CORS[Configure CORS]
  Start --> Pool --> Routes --> CORS
  Shutdown[Lifespan shutdown]
  Close[Close pool]
  Shutdown --> Close
```

- **Lifespan:** create pool on startup, close on shutdown.
- **Routers:** include `health`, `auth`, `thoughts`, `tags` under appropriate prefixes.
- **CORS:** allow origins from `CORS_ORIGINS`; credentials if needed for cookies (v1 uses Bearer token, credentials optional).
- **OpenAPI:** auto-generated at `/docs` and `/redoc`.

---

## API Surface (v1 MVP)

### Health (public)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{"status": "ok"}`; optionally ping DB pool |

### Auth (public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Body: `{ "username", "password" }` → `{ "access_token", "token_type": "bearer" }` |

No user table in v1 — credentials compared against env vars (ADR-008).

### Thoughts (protected)

| Method | Path | DB Function | Notes |
|--------|------|-------------|-------|
| GET | `/api/thoughts` | `app.list_thoughts` | Query: `limit`, `offset`, `tag` |
| POST | `/api/thoughts` | `app.create_thought` | Body: `title`, `body`, `tags[]` |
| GET | `/api/thoughts/{id}` | `app.get_thought` | 404 if not found |
| PUT | `/api/thoughts/{id}` | `app.update_thought` | Full replace of tags |
| DELETE | `/api/thoughts/{id}` | `app.delete_thought` | 204 on success |
| GET | `/api/thoughts/search` | `app.search_thoughts` | Query: `q`, `limit`, `offset` |

Register `/api/thoughts/search` **before** `/api/thoughts/{id}` in the router to avoid path conflicts.

### Tags (protected)

| Method | Path | DB Function | Notes |
|--------|------|-------------|-------|
| GET | `/api/tags` | `app.list_tags` | All tags for autocomplete |

---

## Pydantic Schemas

### Request

```python
# schemas/thought.py (conceptual)
class ThoughtCreate(BaseModel):
    title: str = Field(..., max_length=500)
    body: str = ""
    tags: list[str] = []

class ThoughtUpdate(BaseModel):
    title: str = Field(..., max_length=500)
    body: str = ""
    tags: list[str] = []
```

### Response

```python
class ThoughtResponse(BaseModel):
    id: UUID
    title: str
    body: str
    created_at: datetime
    updated_at: datetime
    tags: list[str]

class ThoughtListResponse(BaseModel):
    items: list[ThoughtResponse]
    limit: int
    offset: int
    # total: optional in v1 if not returned by DB function
```

Map asyncpg records to Pydantic models in the `db/` layer or route handlers.

---

## Database Access Layer (`app/db/`)

### Pool (`pool.py`)

```python
# Conceptual pattern — no f-strings for SQL
async def get_pool() -> asyncpg.Pool: ...

async def fetch_thought(pool, thought_id: UUID) -> ThoughtResponse | None:
    row = await pool.fetchrow(
        "SELECT * FROM app.get_thought($1)",
        thought_id,
    )
```

### Rules

1. **Every** DB call uses `$1`, `$2` placeholders — never concatenate user input into SQL (NFR-06).
2. One module per domain (`thoughts.py`, `tags.py`).
3. Translate `asyncpg` exceptions: unique violations, not-found from function → appropriate HTTP errors in routes.
4. Connection uses `tot_api` role only.

---

## Authentication (Phase 1 — JWT)

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant Auth as services/auth
  Client->>API: POST /api/auth/login
  API->>Auth: verify username/password
  Auth-->>API: JWT access_token
  API-->>Client: token
  Client->>API: GET /api/thoughts Authorization Bearer
  API->>Auth: decode + validate JWT
  Auth-->>API: subject
  API-->>Client: 200 + data
```

### Implementation

- `services/auth.py`: `create_access_token(sub)`, `decode_token(token)`, `verify_password(plain, hash)`.
- `api/deps.py`: `get_current_user` dependency — raises `401` if missing/invalid token.
- Apply dependency to all `/api/*` routes except `/api/auth/login` and `/health`.
- Token payload: `{ "sub": username, "exp": ... }`.

### Phase 2+ (Entra ID)

Replace login endpoint and JWT validation with Microsoft Entra ID token validation; keep route protection pattern via FastAPI dependencies (ADR-008).

---

## Error Handling

Consistent JSON error shape (Phase 4 formalizes; define early):

```json
{
  "detail": "Human-readable message",
  "code": "THOUGHT_NOT_FOUND"
}
```

| Status | When |
|--------|------|
| 400 | Validation failure (Pydantic) |
| 401 | Missing/invalid JWT |
| 404 | Thought not found |
| 422 | Unprocessable entity (FastAPI default for body validation) |
| 500 | Unexpected errors (log full trace; generic message to client) |

---

## CORS

- Allow origins from `CORS_ORIGINS` env var.
- Methods: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`.
- Headers: `Authorization`, `Content-Type`.
- Local dev: `http://localhost:5173` (Vite default).

---

## Testing Strategy

### Fixtures (`conftest.py`)

- Test database URL (Docker Postgres; same migrations as `tot-db`).
- `asyncpg` pool fixture (session or function scoped).
- `httpx.AsyncClient` with `app=main.app` and lifespan.
- Helper to obtain JWT for authenticated requests.

### Test Files

| File | Coverage |
|------|----------|
| `test_health.py` | `GET /health` returns 200 |
| `test_auth.py` | Login success/failure; protected route without token → 401 |
| `test_thoughts_api.py` | Full CRUD + search via HTTP |
| `test_db_functions.py` | Direct function calls (Phase 1, can merge into API tests later) |

### CI

```bash
pytest tot-backend/tests -v
```

Run against Postgres service container in GitHub Actions.

---

## Phased Implementation

### Phase 0 — Foundation

| Task | Exit signal |
|------|-------------|
| Scaffold `pyproject.toml`, `app/main.py` | App imports cleanly |
| Implement `GET /health` | curl returns 200 |
| Wire asyncpg pool in lifespan | Pool connects to Docker Postgres |
| Configure CORS for Vite origin | Browser preflight succeeds |

### Phase 1 — DB Integration Tests

| Task | Exit signal |
|------|-------------|
| `test_db_functions.py` calls `app.create_thought`, etc. | Tests pass against real Postgres |
| Depends on [TOT_DB.md](../tot-db/TOT_DB.md) Phase 1 | Functions exist |

### Phase 2 — Thin API

| Task | Exit signal |
|------|-------------|
| Pydantic schemas for all request/response types | OpenAPI reflects models |
| `db/thoughts.py`, `db/tags.py` function callers | Parameterized queries only |
| Routes for thoughts, tags, auth | Full CRUD via curl/Postman with JWT |
| OpenAPI at `/docs` | Interactive docs work |

**Phase 2 exit criteria:** Full CRUD via Postman/curl with JWT.

### Phase 4 — Production Hardening

| Task | Exit signal |
|------|-------------|
| Structured logging (JSON in prod) | Logs include request ID |
| Correlation ID middleware | ID in logs and optional response header |
| Application Insights integration | Traces in Azure portal |
| Gunicorn + Uvicorn worker config | Documented for App Service |
| Error handling conventions | Consistent error JSON |

### Phase 5 — Azure Deployment

| Task | Exit signal |
|------|-------------|
| GitHub Actions: lint, test, deploy | Pipeline green on main |
| Deploy to App Service (Linux) | API reachable over HTTPS |
| App settings: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` | Env configured |
| Health check probes `/health` | App Service reports healthy |

---

## Production Process Model

```bash
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --workers 2
```

Two workers sufficient for personal scale (NFR-04: ≤ 10 users).

---

## Security Checklist

- [ ] No secrets in git; use env / App Service settings / Key Vault (Phase 2+).
- [ ] JWT secret is strong and unique per environment.
- [ ] All DB access via bound parameters to `app.*` functions.
- [ ] `DATABASE_URL` uses `tot_api` role, not `tot_owner`.
- [ ] HTTPS only in non-local environments (NFR-05).

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [TOT_DB.md](../tot-db/TOT_DB.md) | Function signatures, roles, migrations |
| [TOT_FRONTEND.md](../tot-frontend/TOT_FRONTEND.md) | Consumes this API |
| [PROJECT_BRIEF.md](../docs/architecture/PROJECT_BRIEF.md) | NFRs, ADRs, deployment topology |

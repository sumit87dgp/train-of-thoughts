# Questions & Answers

Learning notes from questions asked during development. Newest entries first.

**Related:** [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) · [BUILD_LOG.md](BUILD_LOG.md) · [CHALLENGES.md](CHALLENGES.md)

---

## Index

- [2026-06-30 — Docker Desktop shows http://localhost:5433; Postgres is not a browser service](#2026-06-30-docker-port-browser)

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

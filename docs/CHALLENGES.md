# Challenges Log

Errors, root causes, and fixes. Newest entries first.

**Agreement:** [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) · **Build history:** [BUILD_LOG.md](BUILD_LOG.md)

---

## Index

- [2026-07-05 — SWA served source (`main.jsx`) instead of Vite `dist/` build](#2026-07-05-swa-deploy-source-instead-of-dist)
- [2026-07-05 — Azure API down: special characters in `DATABASE_URL_API` password broke the connection URL](#2026-07-05-database-url-api-password-special-chars)
- [2026-06-30 — Backend venv used Python 3.10: incomplete pip install, not wrong version](#2026-06-30-venv-wrong-python)
- [2026-06-30 — Agent tried apt install Python 3.12 without user request](#2026-06-30-apt-python-install)
- [2026-06-30 — pip installs aborted; overlapping runs, incomplete backend venv](#2026-06-30-pip-install-aborted)
- [2026-06-30 — Postgres port 5432 hit host DB, not Docker](#2026-06-30-port-5432-conflict)
- [2026-06-30 — Too many layers at once during Phase 0](#2026-06-30-parallel-layers)

---

<a id="2026-07-05-swa-deploy-source-instead-of-dist"></a>

## 2026-07-05 — SWA served source (`main.jsx`) instead of Vite `dist/` build

**Symptom:** Static Web App loaded the page title but the browser console showed: `Failed to load module script: Expected a JavaScript module but the server responded with a MIME type of "application/octet-stream"` at `main.jsx:1`.

**Context:** Phase 5 frontend deploy via GitHub Actions (`Azure/static-web-apps-deploy@v1`) with `npm run build` in CI and `skip_app_build: true`.

**Cause:** `app_location: tot-frontend` uploaded **source** (including dev `index.html` referencing `/src/main.jsx`). With `skip_app_build: true`, Oryx/SWA does not run Vite — SWA has no MIME type for raw `.jsx`, so the module load fails.

**Fix:** Point deploy at the pre-built output:

```yaml
app_location: tot-frontend/dist
output_location: ""
skip_app_build: true
```

Added `tot-frontend/public/staticwebapp.config.json` (copied into `dist/` on build) for React Router SPA fallback.

**Lesson:** When CI builds the SPA, deploy **`dist/`** as `app_location`, not the project root. Dev `index.html` must never reach production SWA.

---

<a id="2026-07-05-database-url-api-password-special-chars"></a>

## 2026-07-05 — Azure API down: special characters in `DATABASE_URL_API` password broke the connection URL

**Symptom:** After Phase 5 deploy, `curl https://tot-api.azurewebsites.net/health` returned Azure’s generic **Application Error** HTML (not FastAPI JSON). Portal **Instances** showed **Stopped** with **ContainerTimeout** (“container did not start within 230s”). Log stream showed Gunicorn and workers starting, then Application Insights QuickPulse logs — but the app never stayed healthy.

**Context:** First production deploy to Azure App Service (FastAPI + asyncpg) and Azure Database for PostgreSQL Flexible Server. `DATABASE_URL_API` set on App Service (not GitHub). Health check was unchecked in the portal. Passwords for DB roles used strong secrets with **`@`** and **`#`**.

**What we tried (investigation path):**

1. **Instances / ContainerTimeout** — Confirmed the container failed to become ready; unrelated to health-check checkbox being off (that only affects recovery probing once the app runs).
2. **Log stream** — First failure was `ImportError: cannot import name 'Sentinel' from 'typing_extensions' (/agents/python/typing_extensions.py)` when the Application Insights **codeless agent** (`ApplicationInsightsAgent_EXTENSION_VERSION=~3`) prepended `/agents/python` to `PYTHONPATH`. Fix: disable codeless agent or strip `/agents/python` from `PYTHONPATH`; keep in-app `azure-monitor-opentelemetry`.
3. **After telemetry fix** — Logs showed Gunicorn boot + QuickPulse, but `/health` still failed. Ruled out “telemetry noise” as the cause; workers likely died during **lifespan** `create_pool()` (DB connect) or instance remained **Stopped** from prior failures.
4. **Where to set `DATABASE_URL_API`** — Clarified: **Azure App Service** application settings for runtime; GitHub only has `DATABASE_URL` (`tot_owner`, migrate job) and `TOT_API_PASSWORD` (plain password for `set-tot-api-password.sh`).
5. **Password special characters** — `@` in a `postgres://tot_api:PASSWORD@host:5432/...` URL is parsed as the **credential/host delimiter**, truncating the password and corrupting the hostname. `#` can truncate the URL (fragment). App sent wrong credentials → DB auth failure on startup → workers exit → **ContainerTimeout** / Application Error.

**Cause:** The **`tot_api` password embedded in `DATABASE_URL_API` was not URL-encoded**. Characters like `@` and `#` broke URL parsing, so asyncpg never connected with the real password even though Postgres and migrations were fine.

**Fix:**

1. Changed `tot_api` password to a **simple alphanumeric** secret via DBeaver (as admin): `ALTER ROLE tot_api WITH PASSWORD '...';` — same effect as [`set-tot-api-password.sh`](../tot-db/scripts/set-tot-api-password.sh).
2. Updated **`DATABASE_URL_API`** on App Service with the new password in the URL (no encoding needed for alphanumeric).
3. Kept GitHub **`TOT_API_PASSWORD`** in sync (plain text, not URL-encoded).
4. Restarted App Service → `GET /health` returned `{"status":"ok"}`.

**Alternative fix:** Keep a complex password and **percent-encode** only the password segment in the URL (e.g. `@` → `%40`, `#` → `%23`). PowerShell: `[System.Uri]::EscapeDataString('your-password')`.

**Lesson:**

- **`postgres://` URLs are not “just strings”** — reserve URL-safe passwords for connection strings, or encode the password portion.
- **`TOT_API_PASSWORD` (GitHub) ≠ `DATABASE_URL_API` (Azure)** — same secret, different formats: plain in secrets/SQL; encoded (if needed) in URLs.
- **Application Error + ContainerTimeout** often means startup never finished — check Log stream *after* import/telemetry lines for DB/auth errors, not only the first traceback.
- Document App Service settings in [azure-deploy.md](runbooks/azure-deploy.md); `DATABASE_URL_API` lives on **tot-api**, not in GitHub deploy secrets.

---

<a id="2026-06-30-venv-wrong-python"></a>

## 2026-06-30 — Backend venv used Python 3.10

**Symptom:** Inside `tot-backend/.venv`, `python --version` showed **3.10.12**; `pytest` / imports failed; docs briefly claimed 3.12 was required.

**Context:** Phase 0 backend setup; parallel `pip install` runs; agent documented pyenv / `python3.12` workflow.

**Cause:** **`pip install -e ".[dev]"` never finished** (aborted parallel installs). Python 3.10 is **valid** (`requires-python = ">=3.10"`). The venv was removed to start clean, not because 3.10 was incompatible.

**Fix:** Removed broken `.venv`. Standard workflow: `python3 -m venv .venv` → activate → single `pip install -e ".[dev]"`. Docs reverted to **Python 3.10+** — no 3.12 upgrade.

**Lesson:** Distinguish **incomplete venv** from **wrong Python version**. Use `python3 -m venv`; one pip install at a time. See [QUESTION_ANSWER: Python 3.10+](QUESTION_ANSWER.md#2026-06-30-backend-venv-python310).

---

<a id="2026-06-30-apt-python-install"></a>

## 2026-06-30 — Agent tried apt install Python 3.12

**Symptom:** User asked why agent was installing Python on the system.

**Context:** Phase 0; system had Python 3.10 only; `pyenv` not detected.

**Cause:** Agent attempted `sudo apt-get install python3.12` to unblock backend install instead of waiting for user toolchain setup.

**Fix:** Stopped system install. Project uses **`requires-python = ">=3.10"`** (3.10 on WSL is fine). See [Python 3.10+ Q&A](QUESTION_ANSWER.md#2026-06-30-backend-venv-python310).

**Lesson:** Toolchain installs (Python, nvm, apt) are **user-led** unless explicitly requested. Agent must not push 3.12/pyenv without user preference.

---

<a id="2026-06-30-pip-install-aborted"></a>

## 2026-06-30 — pip installs aborted

**Symptom:** `pytest` missing; multiple terminal tasks show `status: aborted`; `.venv` incomplete.

**Context:** Phase 0 backend setup; several `pip install -e ".[dev]"` runs started in parallel.

**Cause:** Multiple concurrent pip processes; slow dependency resolver backtracking.

**Fix:** Kill stray pip processes; single venv with **`python3 -m venv .venv`** + `source .venv/bin/activate` + one `pip install -e ".[dev]"`.

**Lesson:** One install at a time; activate venv explicitly; use **`python3`** (3.10+).

---

<a id="2026-06-30-port-5432-conflict"></a>

## 2026-06-30 — Postgres port 5432 conflict

**Symptom:** `password authentication failed for user "tot_owner"` when running `migrate.sh` against `localhost:5432`.

**Context:** WSL host has PostgreSQL client and a local server; Docker also mapped to 5432 initially.

**Cause:** `psql` on `localhost:5432` reached **host Postgres**, not the Docker container. Host instance has no `tot_owner` role with our password.

**Fix:** Changed Docker publish to **5433:5432**; updated `DATABASE_URL` in `.env.example`, `migrate.sh` default, and backend `config.py` default.

**Lesson:** Verify target with `docker exec tot-postgres psql ...` vs `psql -h 127.0.0.1 -p <port>`. Prefer a non-default host port when host Postgres exists.

---

<a id="2026-06-30-parallel-layers"></a>

## 2026-06-30 — Too many layers at once

**Symptom:** Phase 0 felt messy; hard to follow; backend/frontend/DB steps interleaved.

**Context:** Single Agent session tried Docker + migrations + pip + npm + CI together.

**Cause:** No scoped session boundary; agent optimized for “done” over “learn step by step”.

**Fix:** User requested BUILD_LOG, CHALLENGES, WORKING_AGREEMENT; retry Phase 0 one layer per session with user guidance.

**Lesson:** Follow [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md): one layer, propose → approve → execute → log.

---

## New entry template

Add a line to the [Index](#index) above, then paste here:

```markdown
<a id="yyyy-mm-dd-short-slug"></a>

## YYYY-MM-DD — Title

**Symptom:**

**Context:**

**Cause:**

**Fix:**

**Lesson:**
```

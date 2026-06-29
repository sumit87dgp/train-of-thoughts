# Challenges Log

Errors, root causes, and fixes. Newest entries first.

**Agreement:** [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) · **Build history:** [BUILD_LOG.md](BUILD_LOG.md)

---

## Index

- [2026-06-30 — Agent tried apt install Python 3.12; user prefers pyenv only](#2026-06-30-apt-python-install)
- [2026-06-30 — pip installs aborted; overlapping runs, incomplete backend venv](#2026-06-30-pip-install-aborted)
- [2026-06-30 — Postgres port 5432 hit host DB, not Docker](#2026-06-30-port-5432-conflict)
- [2026-06-30 — Too many layers at once during Phase 0](#2026-06-30-parallel-layers)

---

<a id="2026-06-30-apt-python-install"></a>

## 2026-06-30 — Agent tried apt install Python 3.12

**Symptom:** User asked why agent was installing Python on the system.

**Context:** Phase 0; system had Python 3.10 only; `pyenv` not detected.

**Cause:** Agent attempted `sudo apt-get install python3.12` to unblock backend install instead of waiting for user toolchain setup.

**Fix:** Stopped system install. Restored `requires-python = ">=3.12"`, added `tot-backend/.python-version`, documented pyenv workflow in README and WORKING_AGREEMENT.

**Lesson:** Toolchain installs (pyenv, nvm, apt Python) are **user-led** unless explicitly requested.

---

<a id="2026-06-30-pip-install-aborted"></a>

## 2026-06-30 — pip installs aborted

**Symptom:** `pytest` missing; multiple terminal tasks show `status: aborted`; `.venv` incomplete.

**Context:** Phase 0 backend setup; several `pip install -e ".[dev]"` runs started in parallel.

**Cause:** Multiple concurrent pip processes; slow dependency resolver backtracking; some runs used system Python 3.10 venv before 3.12 policy was clarified.

**Fix:** Kill stray pip processes; single venv with **pyenv 3.12** + `source .venv/bin/activate` + one `pip install`. Pinned versions in `pyproject.toml`.

**Lesson:** One install at a time; activate venv explicitly; use Python 3.12 from pyenv, not system `python3`.

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

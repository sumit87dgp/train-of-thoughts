# Challenges Log

Errors, root causes, and fixes. Newest entries first.

**Agreement:** [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) · **Build history:** [BUILD_LOG.md](BUILD_LOG.md)

---

## Index

- [2026-06-30 — Backend venv used Python 3.10: incomplete pip install, not wrong version](#2026-06-30-venv-wrong-python)
- [2026-06-30 — Agent tried apt install Python 3.12 without user request](#2026-06-30-apt-python-install)
- [2026-06-30 — pip installs aborted; overlapping runs, incomplete backend venv](#2026-06-30-pip-install-aborted)
- [2026-06-30 — Postgres port 5432 hit host DB, not Docker](#2026-06-30-port-5432-conflict)
- [2026-06-30 — Too many layers at once during Phase 0](#2026-06-30-parallel-layers)

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

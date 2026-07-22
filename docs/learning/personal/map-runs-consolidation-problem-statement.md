# Map Runs — Consolidating manual benchmark results (problem statement)

**Date:** 2026-07-22  
**Status:** Discovery — stakeholder answers captured; v1 UX direction emerging  
**Route:** `/manual/map-runs`  
**Author context:** Captured from product discussion; refine with stakeholders before Phase 4 build.

**Related architecture (already accepted):**

- [PROJECT_BRIEF.md — Phase 4 Manual execution capture](../../architecture/PROJECT_BRIEF.md)
- [ADR 0006 — ADLS development strategy](../../architecture/adr/0006-adls-development-strategy.md)
- [map-runs-backlog.md](../../map-runs-backlog.md) — terminal UX only today
- [NFR.md](../../architecture/NFR.md) — manual capture path, retention, no parsing in v1

---

## 1. What the user wants (plain language)

### Optional step — run workloads on SUTs

1. SSH into a system under test (SUT).
2. Execute workloads / benchmarks manually (as today with MobaXterm, or via the new in-app terminal).

### Core problem — scattered results

Manual runs produce result files (logs, reports, CSVs, archives, etc.) that live in **different folders on different SUTs**. There is no single place to find, compare, or analyze them later.

### Desired outcome — “Map my runs”

**Consolidate** = upload result artifacts from SUTs into a **central zone** so they can be analyzed later.

| Environment | Central storage (target) |
|-------------|---------------------------|
| **Production** | Azure Data Lake Storage Gen2 (ADLS) |
| **Dev / staging** | Azurite (Azure-compatible local emulator) or filesystem stand-in |

**Important platform rule (already documented):** Raw files land in **ADLS/Azurite first**. **Databricks** is for **parsed analytics** in a later phase (separate manual schema, new parsers). v1 capture = **store + register**, not parse.

---

## 2. How this maps to existing product naming

| Term | Meaning in Data 360 |
|------|---------------------|
| **Manual Execution** | Product route `/manual/*` (parallel to `/automation/*`) |
| **Map Runs** | Manual-only section at `/manual/map-runs` |
| **Map (verb)** | Link a manual run’s artifacts to the platform registry + lake path |
| **SUT** | System under test — hostname/FQDN the user SSHs to |

The name **Map Runs** fits: user connects to SUTs, runs benchmarks, then **maps** (registers + uploads) the resulting files into the central store.

---

## 3. What exists today (v1 Map Runs)

Built and working (terminal + bookmarks only):

| Layer | What exists |
|-------|-------------|
| **UI** | 3-column layout: SUT list \| SSH terminal \| **reserved empty right pane** |
| **Terminal** | WebSocket → `sppo-data-360-terminal-gateway` → SSH |
| **Postgres** | `user_suts` — per-user SUT bookmarks (`fqdn`, `port`, `label`, `last_connected_at`) |
| **API** | `GET/POST/DELETE /api/v1/manual/suts`, `POST .../connect` |

**Not built yet (Phase 4):**

| Layer | Gap |
|-------|-----|
| **Storage** | No `StorageService`, no upload grants, no ADLS/Azurite |
| **Postgres** | No **file/run registry** (only SUT bookmarks) |
| **UI** | No upload/register workflow; right pane unused |
| **SUT-side tooling** | No documented uploader script/CLI |
| **Databricks** | No manual schema / parsers (explicitly post–v1) |

---

## 4. Target architecture (from ADR 0006 — already accepted)

Large files must **not** stream through the API. Preferred flow:

```text
1. User / SUT  →  API:     request upload (metadata: workload, SUT, user, path hint, size)
2. API         →  Client:   short-lived upload grant (SAS on ADLS / Azurite equivalent)
3. Client / SUT → Storage: direct upload (Azure SDK, AzCopy, or dev stand-in)
4. Client / SUT → API:      confirm complete (path, size, checksum)
5. API         →  Postgres: persist registry row (file + run linkage + ADLS path)
```

Later (post–v1): batch/parser jobs read ADLS partitions → Databricks **manual** tables → manual dashboard / AI Insights.

### Storage backends by environment

| Phase | Backend | Purpose |
|-------|---------|---------|
| 1 | Local filesystem (e.g. `.data/lake/`) | Fastest API + metadata dev |
| 2 | Azurite in Docker | Azure SDK parity locally |
| 3 | Real ADLS Gen2 | Staging / production |

---

## 5. Stakeholder answers (2026-07-22)

### A. Artifacts & layout on the SUT

| Topic | Answer |
|-------|--------|
| **File types** | Unstructured files — any format (`.txt`, `.log`, `.rsf`, `.csv`, `.json`, etc.) |
| **Layout** | Usually a **folder of files at the same level** (flat directory), not deep trees |
| **Paths on SUT** | **Ad hoc** — no fixed convention per workload |
| **Max single file** | **~2 GB** |
| **Folder total size** | If the folder (or selected set) is **> 1 GB**, UI should **prompt user to compress/zip first** before upload |
| **One run** | Typically one folder’s worth of loose files (may become one zip if over threshold) |

### B. Who uploads (priority order)

| Priority | Mechanism | When |
|----------|-----------|------|
| **1 (v1 preference)** | **Button in UI** after SSH — user maps from Map Runs | First implementation |
| **2 (later)** | **SUT script** — `curl` download + execute (grant-based uploader) | Planned, not v1 |
| **3** | Terminal command | **Not required** |

**Implication:** v1 cannot rely on the browser reading SUT filesystem paths. With UI-first preference and script deferred, v1 likely needs **orchestration through infrastructure we already have** (see §6).

### C. Metadata at map time

| Field | Answer |
|-------|--------|
| Workload / benchmark name | **Free text** (mostly) |
| Run date, notes | Free text / user-entered (details TBD) |
| SUT | From active bookmark / session |
| User | From Entra SSO |

### D. Network

| Topic | Answer |
|-------|--------|
| **SUT → Azure storage** | **Yes** — SUTs can reach Azure (ADLS) directly |

Direct-to-storage **SAS upload grants** from the SUT (or from a gateway acting on the user’s behalf) align with ADR 0006.

### E. SSH / terminal

| Topic | Answer |
|-------|--------|
| **Portal terminal** | **Primary** — portal is used for runs, not upload-only |
| MobaXterm-only workflow | Not the target; portal SSH is in scope |

### F. Still open

- **Azurite** in local docker-compose (phase 2) — still recommended per ADR 0006

### H. Confirmed (2026-07-22, round 3)

| Topic | Decision |
|-------|----------|
| **ADLS root** | **`https://<storageaccount>.blob.core.windows.net/<container>/`** — account + container from env; no extra org prefix for v1 |
| **Path under container** | **`{run_uuid}/artifacts/result-files/{filename}`** |
| **Map number in UI** | **Yes for v1** — per-user 4-digit display (e.g. Map #0042) |
| **Checksum** | **SHA-256**, computed by gateway during SSH pull |

### G. Additional decisions (2026-07-22, round 2)

| Topic | Answer |
|-------|--------|
| **v1 upload mechanism** | **Gateway pull over SSH** (not SUT-side azcopy for v1) |
| **> 1 GB handling** | **Auto-zip over SSH** (not instructions-only) |
| **Batch vs file-by-file** | **User choice** — parent folder may hold many runs; user may upload whole folder, a segregated subfolder, or selected files |
| **Mapped runs history** | **Right pane** — show past uploads + stored metadata for the connected SUT |

---

## 6. v1 UX direction (emerging from answers)

### User journey (target)

```text
1. Connect to SUT in Map Runs (left list + centre terminal)
2. Run benchmark on SUT (terminal)
3. Right pane: “Map this run”
   - Free-text workload name, notes, run date
   - Source path on SUT (ad hoc folder path)
   - Scan → user picks scope: whole folder | one subfolder | selected files
   - Size check → if total > 1 GB → auto-zip over SSH, then continue
4. User clicks Upload / Map
5. Gateway pulls via SSH → ADLS/Azurite; Postgres registry row created
6. Right pane shows mapped-run history + metadata for this SUT
```

### v1 upload path (UI button without SUT script yet)

**Decided for v1:** **Gateway pull over SSH** (ADR 0006 exception path — gateway proxies bytes because UI-first upload is required before SUT script exists).

| Approach | v1 |
|----------|-----|
| **A. Gateway pull over SSH** | **Selected** |
| **B. SUT script with grant** | Phase 2 |
| **C. API streams through browser** | Reject |

### Size policy (product rules)

| Rule | Action |
|------|--------|
| Single file **> 2 GB** | Reject with clear error |
| Folder / selection **> 1 GB** | **Auto-zip over SSH**, then upload the archive |
| After zip | Upload the archive as one object |

### Upload scope (user choice after scan)

Real SUT layouts vary:

| Pattern | Example | UI behaviour |
|---------|---------|--------------|
| **Flat dump folder** | `/results/` with files from many runs mixed together | Scan lists files; user **selects subset** or whole folder |
| **Segregated subfolders** | `/results/spec_cpu_20260722/`, `/results/spec_cpu_20260723/` | Scan lists **immediate child folders**; user picks **one subfolder** (or several) |
| **Single run folder** | One folder = one benchmark run | Upload **whole folder** (default) |

Gateway scan returns: path, type (file/dir), size, mtime — flat listing at chosen depth; no deep tree required for v1.

---

## 7. Identifiers & ADLS path convention (confirmed)

### Two layers — do not conflate them

| Layer | Purpose | v1 decision |
|-------|---------|-------------|
| **System ID** | Postgres joins, ADLS folder name, SAS scope | **UUID** (`manual_runs.id`) — matches `users`, `suts`, `user_suts` |
| **Display reference** | Right pane, history list, support | **4-digit map number per user** (e.g. Map #0042) |
| **Storage root** | Azure account + container | Env-configured; not embedded in Postgres path logic |

A **4-digit number alone is not the ADLS primary key** — use it for **UI and human lookup** only; **`run_uuid`** owns the blob prefix.

### Map number (v1 — confirmed)

- **`map_number`** — zero-padded 4-digit string or SMALLINT, **scoped per user** (`1`…`9999`)
- Assigned at register time (`MAX(map_number)+1` for that `user_id`, or sequence)
- UI label: **`Map #0042 · {workload} · {run_date}`**
- Postgres unique constraint: `(user_id, map_number)`

### ADLS layout (confirmed)

**Root (environment):**

```text
https://<storageaccount>.blob.core.windows.net/<container>/
```

Configured via env vars (e.g. `ADLS_ACCOUNT`, `ADLS_CONTAINER`); dev phase 1 uses filesystem stand-in with the **same relative paths** under e.g. `.data/lake/`.

**Relative path per upload (under container):**

```text
{run_uuid}/artifacts/result-files/{filename}
```

Examples:

```text
a1b2c3d4-e5f6-7890-abcd-ef1234567890/artifacts/result-files/result.log
a1b2c3d4-e5f6-7890-abcd-ef1234567890/artifacts/result-files/metrics.csv
```

After auto-zip (single archive):

```text
{run_uuid}/artifacts/result-files/{run_uuid}.zip
```

**Why `run_uuid` first:** one map operation = one top-level folder; all artifacts for that run live under `…/artifacts/result-files/`; lifecycle and future parsers can key off `run_uuid`; no collision with another user’s Map #0042.

**Postgres stores:**

| Column | Example |
|--------|---------|
| `manual_runs.id` | UUID (same as `run_uuid` in path) |
| `manual_runs.map_number` | `42` → displayed as `#0042` |
| `manual_runs.adls_prefix` | `{run_uuid}/artifacts/result-files/` (relative; no account/container) |
| `manual_run_files.adls_path` | `{run_uuid}/artifacts/result-files/result.log` |
| `manual_run_files.source_path` | `/home/user/results/spec_cpu/result.log` (SUT audit) |
| `manual_run_files.sha256` | hex digest from gateway during pull |

### Checksum flow (confirmed)

```text
Gateway SSH read → stream to ADLS (or dev filesystem) → SHA-256 incremental hash
→ API confirm_upload(path, size_bytes, sha256)
→ Postgres manual_run_files.sha256 persisted
```

Gateway must not buffer entire multi-GB files in memory — hash while streaming.

### Registry linkage (sketch)

```text
manual_runs
  id (UUID), user_id, sut_id, map_number, workload_name, notes, run_date,
  source_path_hint, adls_prefix, upload_status, total_bytes, created_at

manual_run_files
  id, run_id, filename, source_path, adls_path, size_bytes, sha256, uploaded_at
```

---

## 8. Proposed phasing (updated)

| Step | Deliverable | User-visible outcome |
|------|-------------|----------------------|
| **4a** | Postgres: `manual_runs` + `manual_run_files` (or equivalent) + API CRUD | Register a run without file bytes |
| **4b** | `StorageService` + local filesystem backend + upload grant/confirm | End-to-end upload in dev |
| **4c** | Map Runs **right pane**: metadata + SUT path + Upload button + size/zip rules | Primary UX (stakeholder preference) |
| **4c′** | Gateway SSH pull → ADLS via SAS (or minimal remote azcopy) | Enables UI button without SUT script |
| **4d** | Azurite backend + docker-compose | Staging-like SDK testing |
| **4e** | SUT uploader script (documented) | Large files from SUT without UI streaming |
| **4f** | ADLS Gen2 in QA/prod | Production consolidation |
| **Later** | Databricks manual schema + parsers + manual dashboard widgets | Analyze consolidated data |

Parsing / Databricks analytics stays **out of scope** until capture is stable.

---

## 9. Revision history

| Date | Change |
|------|--------|
| 2026-07-22 | Initial problem statement from user discussion |
| 2026-07-22 | Stakeholder answers: artifacts, sizes, UI-first upload, ad hoc paths, SUT→Azure, free-text metadata |
| 2026-07-22 | Round 2: gateway pull, auto-zip, flexible upload scope, right-pane history; identifiers & ADLS path §7 |
| 2026-07-22 | Round 3: ADLS `{run_uuid}/artifacts/result-files/`, per-user map #, SHA-256 on gateway pull |

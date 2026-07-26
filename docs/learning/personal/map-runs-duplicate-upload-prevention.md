# Map Runs — Preventing duplicate uploads (personal learning)

> **Private learning doc** — lives in `docs/learning/personal/` (gitignored).  
> Project: SPPO Data 360 — Manual Execution → Map Runs (`/manual/map-runs`)  
> Written: 2026-07-26

**Related (product docs):**

- [map-runs-consolidation-problem-statement.md](../../map-runs/map-runs-consolidation-problem-statement.md)
- [map-runs-implementation-status.md](../../map-runs/map-runs-implementation-status.md)
- [map-runs-storage-grant-confirm-guide.md](../../map-runs/map-runs-storage-grant-confirm-guide.md)

---

## 1. The question (problem statement)

There are scenarios where a user may **accidentally or intentionally** try to map **already scanned files or subfolders again**.

**Example edge case:**

1. A user runs workloads on a particular SUT and always stores result files in a **fixed directory** (e.g. `/home/user/benchmark-results/`).
2. They return to Map Runs, enter that same path in **Source path on SUT**, scan, and map again — perhaps without checking history.
3. **Scanning** the directory is fine (discovery), but **upload should not be allowed** for files/folders that were already mapped earlier for that SUT.

**Design question:** How do we avoid duplicate uploads? **Can SHA-256 help prevent duplicate upload?**

---

## 2. What the codebase stores today

There is **no duplicate detection** implemented yet. Relevant registry fields:

| Field | Table | When set | Purpose |
|-------|-------|----------|---------|
| `source_path` | `manual_workloads` | Register | Scan root the user typed |
| `source_path` | `manual_workload_run_files` | Register | Absolute SUT path per file (audit) |
| `size_bytes` | `manual_workload_run_files` | Register / scan | Expected size from SFTP stat |
| `mtime` | *(scan API only today)* | Scan / expand | Last content-modified time from SUT — **not persisted in Postgres yet** |
| `sha256` | `manual_workload_run_files` | **Confirm** (after gateway pull) | Content digest from SFTP read |
| `adls_path` | `manual_workload_run_files` | Confirm | Lake location `{map_id}/artifacts/{filename}` |

**Important timing detail:** At **scan time**, the gateway returns path, type, size, and mtime — **not** SHA-256. Hashing happens during **gateway pull** while streaming bytes, then Postgres is updated on **confirm**.

**Uniqueness today:** Only `(manual_workload_id, adls_path)` within a single map — **not** across maps or SUTs.

See migration `009_manual_workloads_tables.sql` and problem statement §7–§8 in `docs/map-runs/`.

---

## 3. What is SHA-256, what else exists, and why is it necessary?

This section explains the **building block** behind `manual_workload_run_files.sha256` — useful before diving into duplicate prevention.

### 3.1 What is a hash (digest)?

A **cryptographic hash function** takes input of **any size** (a file, a string, a zip) and produces a **fixed-length fingerprint** (the **digest**).

Properties that matter for Map Runs:

| Property | Meaning |
|----------|---------|
| **Deterministic** | Same bytes in → same digest out, every time |
| **Fixed size** | Output length is always the same (SHA-256 → 256 bits) |
| **One-way** | Cannot reconstruct the file from the digest |
| **Avalanche effect** | Tiny change in input → completely different digest |
| **Collision resistance** | Hard to find two different files with the same digest |

A hash is **not encryption** — it does not hide content; it **identifies** and **verifies** content.

**Analogy:** A hash is like a **strong fingerprint for data**. Two identical files share the same fingerprint; two different files (almost always) do not.

### 3.2 What is SHA-256 specifically?

**SHA-256** is one member of the **SHA-2** family (Secure Hash Algorithm), published by NIST.

| Aspect | Detail |
|--------|--------|
| **Output** | 256 bits → **64 hexadecimal characters** (e.g. `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) |
| **Input** | Any length — 10 bytes or 2 GB, same algorithm |
| **How computed** | Read file in chunks; update hasher per chunk (streaming) |
| **In our gateway** | `hashlib.sha256()` in Python while SFTP bytes stream to storage PUT |

In Map Runs, SHA-256 is stored in Postgres **only after upload confirm** — the gateway computed it while reading the file from the SUT, and the API persists it on `POST …/confirm`.

```text
SUT file bytes  →  SHA-256(hasher)  →  64-char hex  →  manual_workload_run_files.sha256
```

### 3.3 Other hash / checksum types (and why we did not pick them)

Many algorithms produce a “fingerprint”, but they differ in **purpose**, **strength**, and **output size**.

| Algorithm | Output (typical) | Type | Common use | Notes for Map Runs |
|-----------|------------------|------|------------|-------------------|
| **CRC32** | 32-bit hex | Checksum | Network packets, zip internal checks | Very fast; **not** cryptographic — easy to craft collisions; poor for trust/audit |
| **MD5** | 128-bit / 32 hex | Cryptographic hash (legacy) | Old file dedup, etag | **Deprecated** for security; collision attacks exist; avoid for new systems |
| **SHA-1** | 160-bit / 40 hex | Cryptographic hash (legacy) | Git objects (historically), TLS (old) | **Deprecated**; collision demonstrations exist |
| **SHA-256** | 256-bit / 64 hex | Cryptographic hash (current standard) | TLS, code signing, blob integrity, our registry | **Our choice** — widely supported, strong enough, fits `CHAR(64)` column |
| **SHA-384 / SHA-512** | 384 / 512 bits | SHA-2 family | High-security contexts | Longer digests; no meaningful gain for artifact dedup; more storage |
| **BLAKE2b / BLAKE3** | Variable | Modern fast hash | Databases, backups, some dedup systems | Faster than SHA-256 on CPU; less “default” in enterprise/Azure docs |
| **xxHash / MurmurHash** | 64–128 bit | Non-cryptographic hash | Databases, hash tables, speed | Great for **indexing**, not for **proving integrity** to auditors |

**Checksum vs cryptographic hash:**

- **Checksum** (e.g. CRC32): detects **accidental** bit flips (disk/network noise).
- **Cryptographic hash** (SHA-256): also designed to resist **intentional** collision finding — important when the digest is a **system of record**.

For benchmark artifacts that may be cited in audits or compliance discussions, a **cryptographic** hash is appropriate.

### 3.4 Why SHA-256 is necessary in Map Runs

Even before duplicate prevention, SHA-256 serves several roles in the capture pipeline:

| Role | Why it matters |
|------|----------------|
| **Integrity verification** | Confirms the bytes that landed in the lake are **exactly** what was read from the SUT (no truncation, corruption, or partial upload). |
| **Audit trail** | Postgres row can answer: “Map #1006’s `result.log` was digest `abc…` at upload time.” Supports traceability without re-reading the lake. |
| **Confirm handshake** | Grant → PUT → **confirm** pattern: client (gateway) reports `{ size_bytes, sha256 }`; API can reject mismatch vs registered size or storage stat. |
| **Content identity** | Same digest = same bytes (with overwhelming probability) — foundation for **duplicate detection** across maps and paths. |
| **Storage / cloud alignment** | Azure Blob and ADLS support MD5 and CRC64 for integrity; SHA-256 is a common choice in application registries and is familiar to security reviewers. |
| **Future content-addressed lake** | Optional path `{container}/{sha256}` or dedupe-before-PUT — digest becomes the primary key for blobs. |

**What SHA-256 does *not* do:**

- Does **not** tell you *which* map or path a file came from (that is `source_path`, `manual_workload_id`).
- Does **not** prove *when* a file was created on the SUT (that is `mtime` / `run_date`).
- Does **not** avoid reading the file — computing the hash requires **reading every byte** (done today during gateway pull, not during scan).

### 3.5 Why SHA-256 for this project (decision summary)

Problem statement (Round 3) locked **SHA-256 on gateway pull**. Rationale in one place:

1. **Standard** — Python `hashlib`, security reviews, and ADR-style docs all recognize SHA-256.
2. **Right size** — 64 hex chars map cleanly to `CHAR(64)` in Postgres with a format check.
3. **Strong enough** — Collision risk for accidental duplicate detection is negligible; no need for SHA-512.
4. **Streaming-friendly** — Gateway already streams SFTP → PUT; hashing in the same pass adds minimal overhead.
5. **Avoid legacy algorithms** — MD5/SHA-1 carry deprecation baggage even for non-adversarial lab use.

### 3.6 Plain-language recap

> **SHA-256** is a standard way to turn a file into a short, unique-ish **content ID**. We store it so we can prove what we uploaded, verify integrity at confirm time, and later ask “have we already ingested these exact bytes?” Duplicate prevention uses **path + size + mtime** early (cheap) and **SHA-256** when we need to be certain about **content** (after read or on demand).

---

## 4. What is mtime (and related file timestamps)?

**`mtime`** is short for **modification time** — the timestamp when a file’s **contents were last written or changed** on disk.

This section explains what the gateway returns as `mtime` during scan/expand, and how it complements `size_bytes` and SHA-256 for duplicate detection.

### 4.1 The three Unix file timestamps

On Linux and most lab SUTs, every file has metadata timestamps (from `stat` / SFTP `listdir_attr`):

| Name | Stands for | Updates when… | Typical use |
|------|------------|---------------|-------------|
| **mtime** | **Modification time** | File **content** is written or truncated | “When was this result log last updated?” |
| **atime** | **Access time** | File is **read** (opened for read) | “When was this file last opened?” — often disabled on perf-tuned systems |
| **ctime** | **Change time** | **Metadata** changes (permissions, owner, link count) — *not* “creation time” on Linux | “When did inode metadata last change?” |

**Common confusion:** On Linux, **ctime ≠ creation time**. True “birth time” exists on some filesystems as **`btime`**, but SFTP/Map Runs v1 only expose **`st_mtime`** today.

**Analogy:** Think of a lab notebook on a shelf:

- **mtime** — last time someone **wrote** in the notebook  
- **atime** — last time someone **opened** it to read  
- **ctime** — last time the **label or shelf assignment** changed  

For benchmark results, **mtime** is usually what you care about: “has this log been overwritten since we last mapped it?”

### 4.2 What mtime looks like in practice

Example file on a SUT:

```text
Path:  /home/user/results/dgemm_json
Size:  7474 bytes
mtime: 2026-07-26 14:30:00 UTC   (Unix epoch: 1785123456)
```

In our gateway scan response, `mtime` is an **integer Unix timestamp** (seconds since 1970-01-01 UTC), taken from SFTP `entry.st_mtime` in `file_scan.py`. It may be `null` if the server does not provide it.

The UI currently displays **path and size** in scan results; **mtime is available in the API** but not shown in the form yet.

### 4.3 How Map Runs uses mtime today vs planned

| Stage | mtime today | Notes |
|-------|-------------|-------|
| **Scan / expand-folder** | Returned in JSON | Free — comes from SFTP directory listing, no full file read |
| **Register (Postgres)** | **Not stored** | Only `source_path`, `size_bytes`, `filename` persisted |
| **Confirm** | **Not stored** | SHA-256 stored instead (content fingerprint after read) |
| **Duplicate prevention (planned)** | Compare scan `mtime` vs stored `sut_mtime` at first map | Requires a migration to persist mtime on register |

So: we **already collect** mtime on scan; we **do not yet record** it in the registry. Duplicate logic in §7–§8 assumes we add something like `manual_workload_run_files.sut_mtime BIGINT` (or `TIMESTAMPTZ`) when registering.

### 4.4 Why mtime matters for duplicate prevention

Compare three signals for “is this the same file as Map #1006?”:

| Signal | Cost on scan | Detects same path + same content | Detects same path + **new** run (overwritten file) |
|--------|--------------|-----------------------------------|-----------------------------------------------------|
| **source_path only** | Free | Blocks re-map (too aggressive) | Wrongly blocks new run |
| **path + size_bytes** | Free | Strong hint | Works if new run changes size |
| **path + size + mtime** | Free | Stronger hint | Works if new run changes content (usually updates mtime) |
| **SHA-256** | Must read entire file | Definitive for content | Definitive |

**Example scenarios:**

1. **Accidental re-map** — User scans same directory; `result.log` unchanged.  
   → Same path, same size, **same mtime** → treat as duplicate; block Map.

2. **New benchmark run, same filename** — User overwrites `result.log` with fresh results.  
   → Same path, possibly same size, **new mtime** → allow new Map # with optional warning.

3. **Copy preserving mtime** — Rare: `cp -p` or tarball extract keeps old mtime.  
   → mtime alone could lie; SHA-256 on Map confirms content (edge case).

### 4.5 mtime vs SHA-256 (when to use which)

| | **mtime** | **SHA-256** |
|---|-----------|-------------|
| **What it represents** | Last time content was modified on SUT | Fingerprint of exact byte content |
| **Available at scan?** | Yes | No (unless you read the whole file) |
| **Stored in Postgres today?** | No | Yes (after confirm) |
| **Cheap duplicate hint?** | Yes | No |
| **Proof of identical bytes?** | No | Yes |

Use **mtime + size + path** as a **fast filter** before Map; use **SHA-256** when you need **proof** or after upload for audit.

### 4.6 Plain-language recap

> **mtime** tells you *when a file was last changed on the SUT*, not *what* is inside it. For Map Runs it is a free extra field from SSH scan that helps distinguish “same file still sitting there” from “same path but user ran again and overwrote the log” — without reading the file. We should persist it at register time if we implement duplicate blocking.

---

## 5. The scenario decomposed

When a user re-scans a familiar directory, several cases exist:

| Case | What changed on SUT | Desired behaviour |
|------|---------------------|-------------------|
| **Accidental re-map** | Same files, unchanged | **Block** (or hard warn) |
| **New run, same layout** | Same paths, **new content** (overwritten logs) | **Allow** new Map # |
| **Intentional re-map** | Same files; user wants another Map # | Product decision: block vs “Map anyway” override |

Duplicate policy depends on which case matters most for v1.

---

## 6. Can SHA-256 prevent duplicates?

### 6.1 Where SHA-256 helps

- **Same bytes, any path:** Identical content → identical hash → strong dedup signal across maps.
- **After pull:** Gateway already computes SHA-256 incrementally during SFTP read; good for **post-upload audit** and cross-map content dedup in Postgres.
- **Lake dedup (future):** Avoid storing the same blob twice if storage is keyed or checked by hash before PUT.

### 6.2 Where SHA-256 is weak or too late

| Issue | Detail |
|-------|--------|
| **Too late at confirm only** | By confirm, SFTP read + PUT already happened; rejecting at confirm only avoids marking `done` — poor UX and wasted bandwidth. |
| **Not available at scan** | Scan lists path/size/mtime; hashing every file on scan means **full read over SSH** — expensive for large directories. |
| **Same path, new content** | Hash changes → correctly treated as new; a **path-only** rule would wrongly block. |
| **Same content, new path** | Hash matches; **path-only** rule would miss the duplicate. |
| **Folder / zip (future)** | Folder identity is a **set** of files or one archive hash — different rules than single-file dedup. |

### 6.3 Direct answer

**Yes**, SHA-256 can help prevent duplicate uploads of **identical content**, especially if checked **before or during Map** (not only at confirm).

**No**, SHA-256 alone is **not sufficient** for the “user always maps the same directory” story without also using **path, size, and mtime**, because:

- Hash is unknown at scan time today.
- Lab users often **reuse paths** with **new run data** — path-only blocking would be wrong; content-aware checks would be right.

**Best combination for this edge case:**

- **`(sut_id, source_path)` lookup** at scan/expand time for UX and blocking.
- Refine with **`size_bytes` / `mtime`** to detect “same path, updated file”.
- Use **SHA-256** to confirm true content duplicate or dedupe lake storage (optionally hash selected files on Map, not on every scan).

---

## 7. Practical dedup strategies

### 7.1 Path-based (recommended v1 gate)

**Rule:** For this **`sut_id`**, any file with `file_status = 'done'` and the same **`source_path`** is already mapped.

| Aspect | Detail |
|--------|--------|
| **When** | After scan or expand-folder, **before Map run** (paths are known). |
| **UI** | Mark rows “Already mapped · Map #1006”; disable selection or block Map with a list. |
| **Pros** | Cheap; matches “this file on this SUT”; no full file read over SSH. |
| **Cons** | Same path with **updated** run results looks like a duplicate unless size/mtime differ. |

**Refinement:** Treat as duplicate only if `(sut_id, source_path, size_bytes)` matches — and optionally **`mtime`** if persisted at first map.

If size or mtime changed → show **“File changed since Map #1006 — allow new map?”**

### 7.2 SHA-256 at selection time (stronger, costlier)

- On **Map** (or expand-folder), gateway hashes **selected files only** (not the whole tree at scan).
- Compare to `manual_workload_run_files.sha256` where `file_status = 'done'` for this `sut_id` (or globally, if product allows).
- **Pros:** Content-accurate.
- **Cons:** Extra SSH I/O; slower for large selections.

**Middle ground:** Hash only when path+size match a prior `done` row (confirm same content), or when user clicks Map.

### 7.3 Dedup scope (product)

| Scope | Question |
|-------|----------|
| **Per SUT** | “This file on this machine was already captured” — usually correct for the fixed-directory edge case. |
| **Per SUT + workload** | Same file mapped for DGEMM and again for SPEC CPU — allow or not? |
| **Global hash** | Same bytes on two SUTs — usually **allow** (different machines). |

The fixed-directory example suggests **per `sut_id`**, keyed by file `source_path` and/or hash — not necessarily by workload name.

### 7.4 Folder / subfolder re-map

Folder mode expands to many files. Dedup runs on the **expanded file list**:

| Overlap | **Locked behaviour** |
|---------|----------------------|
| All files already mapped | **Hard block** — cannot Map |
| **Partial overlap** | **Map only new (unmapped) files** — skip files that match a prior `done` row on `(sut_id, source_path, size_bytes, mtime)` |
| Messaging | “3 of 5 files already mapped (Map #1005, #1006); 2 new files will be uploaded” |

SHA-256 helps when path+size+mtime match but content might differ (rare edge case). For v1, **path + size + mtime** is the gate; hash confirms on pull if needed.

### 7.5 API / DB lookup (sketch)

After scan or expand, UI or API checks prior captures for the active SUT:

```sql
SELECT
    f.source_path,
    f.size_bytes,
    f.sha256,
    mw.id AS map_id,
    mw.completed_at
FROM sppo_data_360.manual_workload_run_files f
JOIN sppo_data_360.manual_workloads mw ON mw.id = f.manual_workload_id
WHERE mw.sut_id = :sut_id
  AND f.file_status = 'done'
  AND f.source_path = ANY(:paths);
```

Optional **strict** partial unique index (only if product never allows same path twice on same SUT, even when content changes):

```sql
CREATE UNIQUE INDEX ... ON (sut_id, source_path)
WHERE file_status = 'done';
-- Would require "force re-map" or new path when file is overwritten
```

---

## 8. Recommended direction (layered)

### Layer 1 — V1 dedup gate (scan / register)

- **Scope:** `sut_id` + `source_path`.
- **Compare:** `size_bytes` (and `mtime` if stored from scan).
- **UI:** Flag duplicates in scan results; **hard block** Map for matching files (see §9).

### Layer 2 — SHA-256 role

- Keep as **source of truth after upload** (already implemented on confirm).
- Optionally on Map: hash only files that matched path+size to a prior `done` row.
- Longer term: content-addressed lake paths or dedupe-before-PUT (separate from Map # UX).

### Layer 3 — Do not hash everything on scan

- Full-tree hashing on every Scan is too heavy over SSH.
- Path (+ size/mtime) at scan; hash on demand at Map or after path match.

### Layer 4 — Product knobs

| Situation | **Locked behaviour** |
|-----------|----------------------|
| path + size + mtime match prior `done` row | **Hard block** — no upload, no “Map anyway” for identical files |
| Partial folder overlap | Register and pull **new files only** |
| Same content, user picks different workload from dropdown | **Overwrite** — do not create a second Map #; update `workload_name` on the existing capture (metadata re-attribution, no re-upload) |

---

## 9. Product decisions (locked 2026-07-26)

Stakeholder answers to the open questions. Use these when implementing dedup and when updating the problem statement / ADR.

| # | Question | **Decision** |
|---|----------|--------------|
| 1 | Hard block vs warn + confirm when path+size+mtime match a prior `done` row? | **Hard block** — no upload for identical files |
| 2 | Partial folder overlap — block entire folder or map only new files? | **Map only new files** — skip already-mapped paths; upload the rest under the same new Map # |
| 3 | Same content, different workload name — still duplicate for this SUT? | **Treat as overwrite** — same bytes/path on this SUT do not get a second lake copy; **update `workload_name`** on the existing capture to the newly selected catalog workload (metadata re-attribution) |
| 4 | Store `sut_mtime` on register? | **Yes** — add column (e.g. `sut_mtime` BIGINT Unix epoch or `TIMESTAMPTZ`) on `manual_workload_run_files`; persist from scan/expand at register time |
| 5 | Separate duplicate-check API vs enrich scan response? | **Approach A (locked)** — `POST /api/v1/manual/workloads/check-duplicates` on API; UI calls after scan/expand. Gateway must **not** call Postgres or API. |

### 9.1 API shape — Approach A vs B (locked 2026-07-26)

This question is about **where** duplicate detection runs after the user scans the SUT.

Today:

- **Gateway scan** (`POST /map-runs/scan`) talks to the SUT over SSH — it knows paths, sizes, mtimes; it does **not** query Postgres.
- **Registry** (prior maps) lives in **Postgres**, accessed by the **API service**.

So after scan returns, something must compare scan results to prior `done` rows.

#### Summary comparison

| Approach | How it works | Pros | Cons |
|----------|--------------|------|------|
| **A. Separate API: check-duplicates** | UI calls API after scan/expand, e.g. `POST /api/v1/manual/workloads/check-duplicates` with `{ sut_id, files: [{ source_path, size_bytes, mtime }] }`. API queries Postgres and returns `{ duplicates: [...], new_files: [...] }`. | Clear separation: SSH on gateway, registry on API; works after scan **or** expand-folder; easy to test | Extra HTTP round trip after scan |
| **B1. Gateway enriches scan** | Gateway calls API/Postgres during scan; response includes `already_mapped`, `existing_map_id` per row. | Single browser call | **Breaks gateway ↔ registry isolation**; gateway needs DB creds and dedup logic |
| **B2. Composite API scan-and-check** | New API route proxies gateway scan + Postgres lookup; returns merged rows in one response. | Single browser call; gateway stays SSH-only | API↔gateway coupling; duplicates UI orchestration; expand-folder needs parallel route |

#### Decision: Approach A

`POST /manual/workloads/check-duplicates` on the **API**, called by the UI after scan/expand with the active `sut_id`. Keeps gateway focused on SSH; keeps dedup rules next to Postgres. UI merges duplicate flags into scan rows before Map.

**Architecture constraint:** No direct gateway → Postgres or gateway → API communication. The UI orchestrates gateway scan and API duplicate check as separate HTTP calls.

**Why A over B:**

1. **B1 ruled out** — violates the no gateway→Postgres/API boundary; spreads dedup logic into the terminal gateway.
2. **B2 viable but not chosen** — saves one browser round trip, but adds a composite API that proxies SSH scan and partially replaces the UI’s existing orchestration role (register and pull are already UI-driven gateway+API sequences).
3. **A matches today’s pattern** — Map Runs already has the UI call gateway for scan/pull and API for register/grant; `check-duplicates` is the same shape.
4. **A tests cleanly** — gateway scan tests, API dedup tests, and UI merge logic stay independent.
5. **Cost of A is low** — scan payloads are small JSON; the second call is fast relative to SSH listing.

**Authoritative git-tracked copy:** `docs/map-runs/map-runs-duplicate-prevention.md` (full B1/B2 flows and comparison table).

**Flow (Approach A — chosen):**

```text
1. UI → Gateway: POST /map-runs/scan (or expand-folder)
2. UI → API: POST /manual/workloads/check-duplicates { sut_id, files: [...] }
3. UI: mark rows, hard-block duplicates, folder mode = only register new_files
4. UI → API: POST /manual/workloads (only new file rows)
5. Gateway pull as today
```

**Flow (Approach B2 — documented, not chosen):**

```text
1. UI → API: POST /manual/workloads/scan-and-check { sut_id, source_path, ssh creds, … }
2. API → Gateway: internal scan
3. API → Postgres: duplicate lookup
4. UI: receives merged rows (already_mapped flags) in one response
5. Register + pull as today
```

---

## 10. Flow diagram (conceptual, updated for locked decisions)

```mermaid
flowchart TD
    A[User scans source path on SUT] --> B[Gateway: list paths, sizes, mtimes]
    B --> C[API: check-duplicates for sut_id]
    C --> D{Each file: prior done row<br/>same path + size + mtime?}
    D -->|Yes| E[Hard block · show Map #N<br/>workload overwrite if name changed only]
    D -->|No| F[Selectable / mappable]
    F --> G{Folder partial overlap?}
    G -->|Some dupes| H[Map new files only]
    G -->|All new| I[Map full selection]
    H --> J[Register + pull + confirm]
    I --> J
    J --> K[Persist sut_mtime + sha256]
```

---

## 11. Summary (interview-style)

> “Scan is idempotent discovery; upload is gated against the registry on **SUT + source path + size + mtime**. Duplicates are **hard blocked**; folders can map **only new files**. Same content with a different workload name **updates metadata** on the existing Map — no second lake copy. **SHA-256** proves content after pull; **sut_mtime** is persisted at register. Duplicate lookup lives on the **API** (check-duplicates after gateway scan), not inside the SSH gateway.”

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-26 | Initial capture from Map Runs duplicate-upload brainstorm |
| 2026-07-26 | Added §3 — SHA-256 fundamentals, alternatives, and necessity |
| 2026-07-26 | Added §4 — mtime and Unix file timestamps (atime, ctime) |
| 2026-07-26 | §9 — Stakeholder locked decisions; §9.1 explains check-duplicates API question |
| 2026-07-26 | Q5 locked — Approach A; gateway/API boundary; see `docs/map-runs/map-runs-duplicate-prevention.md` |
| 2026-07-26 | §9.1 — restored Approach B (B1/B2) with rationale for choosing A |

# PostgreSQL 16 on staging — `/run/postgresql` startup failure (debug notes)

**Date:** 2026-07-24  
**Host:** `atlpwlappdev01` (on-premises staging VM, RHEL 8, PGDG PostgreSQL 16)  
**Related:** [STAGING_VM_DATABASES.md](../../../sppo-data-360-db/STAGING_VM_DATABASES.md)

---

## Symptom

`postgresql-16.service` failed to start after a manual restart:

```bash
sudo systemctl status postgresql-16.service
```

```text
Active: failed (Result: exit-code)
Process: ... ExecStart=/usr/pgsql-16/bin/postgres -D ${PGDATA} (code=exited, status=1/FAILURE)
ExecStartPre=... postgresql-16-check-db-dir ${PGDATA} (code=exited, status=0/SUCCESS)
```

`ExecStartPre` succeeded (data directory exists and looks valid), but the main `postgres` process exited immediately with status 1.

---

## Debug path

### Step 1 — `journalctl` (not enough on its own)

```bash
sudo journalctl -u postgresql-16.service -n 80 --no-pager
```

Every attempt showed only:

```text
LOG:  redirecting log output to logging collector process
HINT: Future log output will appear in directory "log".
```

Then systemd reported `Main process exited, code=exited, status=1/FAILURE`.

**Lesson:** When PostgreSQL uses the logging collector (`logging_collector = on`), the **real FATAL line is not in journalctl** — it goes to files under `PGDATA/log/`.

### Step 2 — PostgreSQL log files

Default data directory on RHEL PGDG: `/var/lib/pgsql/16/data/`.

List logs (newest first):

```bash
sudo ls -lt /var/lib/pgsql/16/data/log/ | head
```

Read today's file directly (avoid glob issues with `sudo` — see pitfall below):

```bash
sudo tail -100 /var/lib/pgsql/16/data/log/postgresql-Fri.log
```

Filter for failures:

```bash
sudo grep -E 'FATAL|PANIC|ERROR' /var/lib/pgsql/16/data/log/postgresql-Fri.log | tail -20
```

### Step 3 — Root cause (from log)

Repeated on every start attempt:

```text
LOG:  starting PostgreSQL 16.14 on x86_64-pc-linux-gnu ...
LOG:  listening on IPv4 address "127.0.0.1", port 5432
FATAL:  could not create lock file "/run/postgresql/.s.PGSQL.5432.lock": No such file or directory
LOG:  database system is shut down
```

PostgreSQL binds to TCP fine, then fails when creating the **Unix socket lock file** under `/run/postgresql/`. That directory did not exist.

---

## Fix (confirmed working)

**Immediate:**

```bash
sudo mkdir -p /run/postgresql
sudo chown postgres:postgres /run/postgresql
sudo chmod 755 /run/postgresql

sudo systemctl reset-failed postgresql-16
sudo systemctl start postgresql-16
sudo systemctl status postgresql-16
```

**Verify:**

```bash
sudo ss -lntp | grep 5432
ls -la /run/postgresql/
```

After a healthy start, expect socket files such as `.s.PGSQL.5432` and `.s.PGSQL.5432.lock`.

**Survive reboot** — `/run` is tmpfs and is cleared on boot. PGDG normally recreates `/run/postgresql` via systemd tmpfiles:

```bash
ls /usr/lib/tmpfiles.d/postgresql*
cat /usr/lib/tmpfiles.d/postgresql-16.conf   # expect: d /run/postgresql 0755 postgres postgres -
sudo systemd-tmpfiles --create
```

If the tmpfiles snippet is missing, add `/etc/tmpfiles.d/postgresql-16.conf`:

```text
d /run/postgresql 0755 postgres postgres -
```

Then run `sudo systemd-tmpfiles --create /etc/tmpfiles.d/postgresql-16.conf`.

---

## Why `/run/postgresql` matters

| Path | Role |
|------|------|
| `/run/postgresql/.s.PGSQL.5432` | Unix domain socket for local connections |
| `/run/postgresql/.s.PGSQL.5432.lock` | Lock file preventing multiple postmasters on the same port |

TCP listening on `127.0.0.1:5432` can succeed while socket creation still fails if the runtime directory is missing. Clients using `-h 127.0.0.1` (TCP) and local peer connections (socket) both depend on a fully started postmaster.

---

## Pitfalls encountered during debug

### `sudo tail ... postgresql-*.log` → “No match”

`sudo` does not expand shell globs. Use an explicit filename or expand the glob before `sudo`:

```bash
sudo tail -100 /var/lib/pgsql/16/data/log/postgresql-Fri.log

# or
sudo tail -100 "$(ls -t /var/lib/pgsql/16/data/log/postgresql-*.log | head -1)"
```

### Unrelated log noise — peer authentication (Jul 17)

Older log lines showed:

```text
FATAL:  Peer authentication failed for user "postgres"
DETAIL:  Connection matched file ".../pg_hba.conf" line 113: "local all all peer"
```

That happens when someone runs `psql -U postgres` **as root** instead of `sudo -u postgres psql`. It is **not** the cause of the service failing to start; the Jul 24 FATAL about `/run/postgresql` was the blocker.

---

## Quick reference — staging PostgreSQL health

From [STAGING_VM_DATABASES.md](../../../sppo-data-360-db/STAGING_VM_DATABASES.md):

```bash
sudo systemctl is-active postgresql-16
sudo ss -lntp | grep 5432
export PGPASSWORD='...'
/usr/pgsql-16/bin/psql -h 127.0.0.1 -p 5432 -U dbo_sppo -d sppo_data_360 -c 'SELECT version();'
```

---

## Takeaways

1. **`systemctl status` + `journalctl` are only the first layer** — with `logging_collector` on, read `PGDATA/log/postgresql-*.log` for FATAL lines.
2. **“Listening on port 5432” does not mean startup succeeded** — socket/lock file creation can still fail afterward.
3. **`/run/postgresql` must exist** and be owned by `postgres` — normally created at boot by `systemd-tmpfiles`; if missing, create it and ensure tmpfiles config is present.
4. **Match log filename to day** (`postgresql-Fri.log`, etc.) when using PGDG daily log rotation.

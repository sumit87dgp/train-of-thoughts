#!/usr/bin/env bash
# Production ASGI entrypoint — Gunicorn + Uvicorn workers.
# See docs/runbooks/gunicorn-app-service.md
set -euo pipefail

cd "$(dirname "$0")/.."

workers="${GUNICORN_WORKERS:-2}"
port="${PORT:-${API_PORT:-8000}}"

exec gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  -b "0.0.0.0:${port}" \
  --workers "$workers" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(cd "$SCRIPT_DIR/../migrations" && pwd)"

DATABASE_URL="${DATABASE_URL:-postgres://tot_owner:tot_owner_dev@localhost:5433/tot?sslmode=disable}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

for file in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$file" ] || continue
  version="$(basename "$file")"
  applied="$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM public.schema_migrations WHERE version = '$version'")"
  if [ "$applied" = "1" ]; then
    echo "skip: $version"
    continue
  fi
  echo "apply: $version"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "INSERT INTO public.schema_migrations (version) VALUES ('$version');"
done

echo "migrations complete"

#!/usr/bin/env bash
# After migrations, set a strong password for tot_api (003 creates tot_api_dev).
# Usage:
#   export DATABASE_URL='postgres://tot_owner:...@host:5432/tot?sslmode=require'
#   export TOT_API_PASSWORD='strong-secret'
#   ./tot-db/scripts/set-tot-api-password.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL (tot_owner) is required}"
: "${TOT_API_PASSWORD:?TOT_API_PASSWORD is required}"

# Escape single quotes for SQL literal: ' -> ''
escaped="${TOT_API_PASSWORD//\'/\'\'}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "ALTER ROLE tot_api WITH PASSWORD '${escaped}';"

echo "tot_api password updated."
echo "Set App Service DATABASE_URL_API to use this password with sslmode=require."

#!/usr/bin/env bash
# Set App Service application settings from environment variables (never commit secrets).
#
# Required env vars (export before running, or pass inline):
#   DATABASE_URL_API   — postgres://tot_api:...@<fqdn>:5432/tot?sslmode=require
#   JWT_SECRET         — strong random secret
#   CORS_ORIGINS       — https://<swa>.azurestaticapps.net
#   TOT_USER           — login username (e.g. admin)
#   TOT_PASSWORD       — login password
#
# Optional:
#   APPLICATIONINSIGHTS_CONNECTION_STRING — if not already set by 04-app-service.sh
#   DATABASE_SSL=true
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

require_az
select_subscription

: "${DATABASE_URL_API:?Set DATABASE_URL_API (tot_api connection string with sslmode=require)}"
: "${JWT_SECRET:?Set JWT_SECRET}"
: "${CORS_ORIGINS:?Set CORS_ORIGINS to your Static Web App origin}"
: "${TOT_USER:?Set TOT_USER}"
: "${TOT_PASSWORD:?Set TOT_PASSWORD}"

SETTINGS=(
  "DATABASE_URL_API=${DATABASE_URL_API}"
  "JWT_SECRET=${JWT_SECRET}"
  "CORS_ORIGINS=${CORS_ORIGINS}"
  "TOT_USER=${TOT_USER}"
  "TOT_PASSWORD=${TOT_PASSWORD}"
  "LOG_FORMAT=json"
  "LOG_LEVEL=INFO"
  "DATABASE_SSL=true"
)

if [[ -n "${APPLICATIONINSIGHTS_CONNECTION_STRING:-}" ]]; then
  SETTINGS+=("APPLICATIONINSIGHTS_CONNECTION_STRING=${APPLICATIONINSIGHTS_CONNECTION_STRING}")
fi

echo "Updating App Service settings on ${WEBAPP_NAME}..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --settings "${SETTINGS[@]}" \
  --output table

echo ""
echo "App settings updated (values not printed)."
echo "Restarting web app..."
az webapp restart \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --output table

echo "Done. Verify: curl -sS https://${WEBAPP_NAME}.azurewebsites.net/health"

#!/usr/bin/env bash
# Start Postgres + App Service after stop-idle.sh (NFR-12).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

require_az
select_subscription

echo "Starting PostgreSQL Flexible Server ${POSTGRES_SERVER}..."
az postgres flexible-server start \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --output table

echo "Waiting for Postgres to become Ready..."
for _ in $(seq 1 30); do
  state="$(az postgres flexible-server show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$POSTGRES_SERVER" \
    --query state -o tsv 2>/dev/null || echo Unknown)"
  echo "  state=${state}"
  if [[ "$state" == "Ready" ]]; then
    break
  fi
  sleep 10
done

echo "Starting web app ${WEBAPP_NAME}..."
az webapp start \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --output table

API_URL="https://${WEBAPP_NAME}.azurewebsites.net"
echo ""
echo "Started."
echo "  Health: curl -sS ${API_URL}/health"
echo "  (Allow a minute for cold start after idle.)"

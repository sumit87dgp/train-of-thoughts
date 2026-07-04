#!/usr/bin/env bash
# Application Insights (workspace-based) for tot-backend telemetry.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

require_az
select_subscription

LOG_ANALYTICS_NAME="${LOG_ANALYTICS_NAME:-${NAME_PREFIX}-logs}"

echo "Creating Log Analytics workspace ${LOG_ANALYTICS_NAME}..."
az monitor log-analytics workspace create \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_NAME" \
  --location "$LOCATION" \
  --output table

WORKSPACE_ID="$(az monitor log-analytics workspace show \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_NAME" \
  --query id -o tsv)"

echo "Creating Application Insights ${APP_INSIGHTS_NAME}..."
az monitor app-insights component create \
  --app "$APP_INSIGHTS_NAME" \
  --location "$LOCATION" \
  --resource-group "$RESOURCE_GROUP" \
  --workspace "$WORKSPACE_ID" \
  --application-type web \
  --kind web \
  --output table

CONNECTION_STRING="$(az monitor app-insights component show \
  --app "$APP_INSIGHTS_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString -o tsv)"

echo ""
echo "Application Insights ready."
echo "  Name: ${APP_INSIGHTS_NAME}"
echo "  APPLICATIONINSIGHTS_CONNECTION_STRING (store as App Service setting / secret):"
echo "    ${CONNECTION_STRING}"

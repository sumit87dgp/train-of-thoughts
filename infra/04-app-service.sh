#!/usr/bin/env bash
# Linux App Service (Python) for tot-backend — Gunicorn startup + /health probe.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

require_az
select_subscription

PYTHON_RUNTIME="${PYTHON_RUNTIME:-PYTHON:3.12}"
STARTUP_COMMAND='gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT --workers 2 --timeout 120 --access-logfile - --error-logfile -'

echo "Creating App Service plan ${APP_SERVICE_PLAN} (${APP_SERVICE_SKU}, Linux)..."
az appservice plan create \
  --name "$APP_SERVICE_PLAN" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku "$APP_SERVICE_SKU" \
  --is-linux \
  --output table

echo "Creating web app ${WEBAPP_NAME} (${PYTHON_RUNTIME})..."
az webapp create \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_SERVICE_PLAN" \
  --name "$WEBAPP_NAME" \
  --runtime "$PYTHON_RUNTIME" \
  --output table

echo "Configuring startup command and Oryx build..."
az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --startup-file "$STARTUP_COMMAND" \
  --output table

az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --settings \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    ENABLE_ORYX_BUILD=true \
    LOG_FORMAT=json \
    LOG_LEVEL=INFO \
  --output table

echo "Configuring health check path /health..."
az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --generic-configurations "{\"healthCheckPath\": \"/health\"}" \
  --output table

if az monitor app-insights component show \
  --app "$APP_INSIGHTS_NAME" \
  --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  CONNECTION_STRING="$(az monitor app-insights component show \
    --app "$APP_INSIGHTS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query connectionString -o tsv)"
  echo "Wiring Application Insights connection string..."
  az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$WEBAPP_NAME" \
    --settings \
      APPLICATIONINSIGHTS_CONNECTION_STRING="$CONNECTION_STRING" \
      ApplicationInsightsAgent_EXTENSION_VERSION=~3 \
    --output table
fi

echo "Enabling HTTPS-only..."
az webapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --https-only true \
  --output table

API_URL="https://${WEBAPP_NAME}.azurewebsites.net"
echo ""
echo "App Service ready."
echo "  URL: ${API_URL}"
echo "  Startup: ${STARTUP_COMMAND}"
echo "  Health: ${API_URL}/health"
echo ""
echo "Next: set secrets with 06-app-settings.sh, deploy via GitHub Actions."
echo "  GitHub secret VITE_API_URL=${API_URL}"
echo "  GitHub secret AZURE_WEBAPP_NAME=${WEBAPP_NAME}"

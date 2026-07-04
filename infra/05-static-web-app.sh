#!/usr/bin/env bash
# Azure Static Web Apps (Free) for tot-frontend.
# SWA Free tier locations are limited — use STATIC_WEB_APP_LOCATION if LOCATION is unsupported.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

require_az
select_subscription

# Free SKU supported regions (as of common Azure docs): eastasia, eastus2, westus2, westeurope, centralus
SWA_LOCATION="${STATIC_WEB_APP_LOCATION:-eastasia}"

echo "Creating Static Web App ${STATIC_WEB_APP_NAME} in ${SWA_LOCATION} (Free)..."
az staticwebapp create \
  --name "$STATIC_WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$SWA_LOCATION" \
  --sku Free \
  --output table

HOSTNAME="$(az staticwebapp show \
  --name "$STATIC_WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query defaultHostname -o tsv)"

DEPLOY_TOKEN="$(az staticwebapp secrets list \
  --name "$STATIC_WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.apiKey -o tsv)"

SWA_ORIGIN="https://${HOSTNAME}"
echo ""
echo "Static Web App ready."
echo "  URL: ${SWA_ORIGIN}"
echo ""
echo "Add GitHub secret:"
echo "  AZURE_STATIC_WEB_APPS_API_TOKEN=<deployment token below>"
echo ""
echo "Deployment token (sensitive — do not commit):"
echo "  ${DEPLOY_TOKEN}"
echo ""
echo "Set CORS_ORIGINS on App Service to: ${SWA_ORIGIN}"
echo "  (export CORS_ORIGINS=${SWA_ORIGIN} then run 06-app-settings.sh)"

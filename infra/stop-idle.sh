#!/usr/bin/env bash
# Stop expensive resources when you are not using the app (NFR-12).
# Postgres: no compute charge while stopped (storage still billed).
# App Service: site stopped; B1 plan may still incur plan charges — see docs/runbooks/azure-cost.md
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

require_az
select_subscription

echo "Stopping PostgreSQL Flexible Server ${POSTGRES_SERVER}..."
az postgres flexible-server stop \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --output table || echo "Postgres stop skipped or already stopped."

echo "Stopping web app ${WEBAPP_NAME}..."
az webapp stop \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --output table || echo "Web app stop skipped or already stopped."

echo ""
echo "Idle stop complete."
echo "  - Postgres compute: stopped (largest saver)"
echo "  - Web app: stopped (B1 plan may still bill — see docs/runbooks/azure-cost.md)"
echo "  - SWA Free: left running (\$0)"
echo ""
echo "Resume with: ./start-prod.sh"

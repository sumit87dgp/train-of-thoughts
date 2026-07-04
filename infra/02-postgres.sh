#!/usr/bin/env bash
# Azure Database for PostgreSQL Flexible Server (tot_owner admin, DB tot).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

require_az
select_subscription

: "${TOT_OWNER_PASSWORD:?TOT_OWNER_PASSWORD is required in config.env}"

echo "Creating PostgreSQL Flexible Server ${POSTGRES_SERVER} (${POSTGRES_SKU})..."
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --location "$LOCATION" \
  --admin-user tot_owner \
  --admin-password "$TOT_OWNER_PASSWORD" \
  --sku-name "$POSTGRES_SKU" \
  --tier Burstable \
  --storage-size "$POSTGRES_STORAGE_GB" \
  --version "$POSTGRES_VERSION" \
  --backup-retention "$POSTGRES_BACKUP_RETENTION_DAYS" \
  --geo-redundant-backup Disabled \
  --public-access 0.0.0.0 \
  --yes \
  --output table

echo "Ensuring database 'tot' exists..."
az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$POSTGRES_SERVER" \
  --database-name tot \
  --output table || true

echo "Allowing Azure services (firewall 0.0.0.0)..."
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --output table || true

if [[ -n "${CLIENT_IP:-}" ]]; then
  echo "Allowing client IP ${CLIENT_IP}..."
  az postgres flexible-server firewall-rule create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$POSTGRES_SERVER" \
    --rule-name AllowClientIP \
    --start-ip-address "$CLIENT_IP" \
    --end-ip-address "$CLIENT_IP" \
    --output table || true
fi

FQDN="$(postgres_fqdn)"
echo ""
echo "Postgres ready."
echo "  FQDN: ${FQDN}"
echo "  Admin: tot_owner"
echo "  Database: tot"
echo "  DATABASE_URL (migrations):"
echo "    postgres://tot_owner:***@${FQDN}:5432/tot?sslmode=require"
echo ""
echo "Next: run migrations (see docs/runbooks/azure-deploy.md), then ALTER ROLE tot_api."

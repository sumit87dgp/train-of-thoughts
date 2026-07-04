#!/usr/bin/env bash
# Shared helpers for infra/*.sh — source this file, do not run directly.
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${INFRA_DIR}/config.env"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing ${CONFIG_FILE}"
  echo "Copy infra/config.env.example to infra/config.env and fill in values."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$CONFIG_FILE"
set +a

: "${RESOURCE_GROUP:?RESOURCE_GROUP is required in config.env}"
: "${LOCATION:?LOCATION is required in config.env}"
: "${NAME_PREFIX:?NAME_PREFIX is required in config.env}"

POSTGRES_SERVER="${POSTGRES_SERVER:-${NAME_PREFIX}-pg}"
WEBAPP_NAME="${WEBAPP_NAME:-${NAME_PREFIX}-api}"
APP_SERVICE_PLAN="${APP_SERVICE_PLAN:-${NAME_PREFIX}-plan}"
APP_INSIGHTS_NAME="${APP_INSIGHTS_NAME:-${NAME_PREFIX}-ai}"
STATIC_WEB_APP_NAME="${STATIC_WEB_APP_NAME:-${NAME_PREFIX}-web}"

APP_SERVICE_SKU="${APP_SERVICE_SKU:-B1}"
POSTGRES_SKU="${POSTGRES_SKU:-Standard_B1ms}"
POSTGRES_STORAGE_GB="${POSTGRES_STORAGE_GB:-32}"
POSTGRES_BACKUP_RETENTION_DAYS="${POSTGRES_BACKUP_RETENTION_DAYS:-7}"
POSTGRES_VERSION="${POSTGRES_VERSION:-16}"

require_az() {
  if ! command -v az >/dev/null 2>&1; then
    echo "Azure CLI (az) is required. Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
    exit 1
  fi
}

select_subscription() {
  if [[ -n "${SUBSCRIPTION_ID:-}" ]]; then
    az account set --subscription "$SUBSCRIPTION_ID"
  fi
  echo "Subscription: $(az account show --query id -o tsv) ($(az account show --query name -o tsv))"
}

postgres_fqdn() {
  az postgres flexible-server show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$POSTGRES_SERVER" \
    --query fullyQualifiedDomainName -o tsv
}

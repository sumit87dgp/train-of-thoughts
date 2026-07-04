#!/usr/bin/env bash
# Create the resource group for Train of Thoughts production.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

require_az
select_subscription

echo "Creating resource group ${RESOURCE_GROUP} in ${LOCATION}..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags project=train-of-thoughts env=prod \
  --output table

echo "Done: resource group ${RESOURCE_GROUP}"

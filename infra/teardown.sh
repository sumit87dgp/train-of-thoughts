#!/usr/bin/env bash
# Delete the entire resource group (all Phase 5 resources). Irreversible.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

require_az
select_subscription

echo "This will DELETE resource group ${RESOURCE_GROUP} and ALL resources inside it."
read -r -p "Type the resource group name to confirm: " confirm
if [[ "$confirm" != "$RESOURCE_GROUP" ]]; then
  echo "Aborted."
  exit 1
fi

az group delete --name "$RESOURCE_GROUP" --yes --no-wait
echo "Delete started (async). Check: az group show -n ${RESOURCE_GROUP}"

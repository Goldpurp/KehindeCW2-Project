#!/usr/bin/env bash
set -euo pipefail

# Azure Front Door Standard/Premium is the supported replacement for new Azure
# CDN profiles. Azure for Students and Free Trial subscriptions can reject these
# resources; use a paid/eligible subscription before running this script.

SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-783472e2-68ab-434c-ab49-c0d841bd3244}"
RESOURCE_GROUP="${RESOURCE_GROUP:-KehindeRazaq}"
PROFILE_NAME="${PROFILE_NAME:-kehindecw2-frontdoor-174522579}"
ENDPOINT_NAME="${ENDPOINT_NAME:-kehindecw2-edge-174522579}"
ORIGIN_GROUP_NAME="${ORIGIN_GROUP_NAME:-kehindecw2-api-origin-group}"
ORIGIN_NAME="${ORIGIN_NAME:-kehindecw2-api-origin}"
FUNCTION_HOST="${FUNCTION_HOST:-goldpurpapi174522579.azurewebsites.net}"

az account set --subscription "$SUBSCRIPTION_ID"
az extension add --name cdn --upgrade --yes >/dev/null
az provider register --namespace Microsoft.Cdn --wait

if ! az afd profile show \
  --resource-group "$RESOURCE_GROUP" \
  --profile-name "$PROFILE_NAME" \
  --output none >/dev/null 2>&1; then
  az afd profile create \
    --resource-group "$RESOURCE_GROUP" \
    --profile-name "$PROFILE_NAME" \
    --sku Standard_AzureFrontDoor \
    --output none
fi

if ! az afd endpoint show \
  --resource-group "$RESOURCE_GROUP" \
  --profile-name "$PROFILE_NAME" \
  --endpoint-name "$ENDPOINT_NAME" \
  --output none >/dev/null 2>&1; then
  az afd endpoint create \
    --resource-group "$RESOURCE_GROUP" \
    --profile-name "$PROFILE_NAME" \
    --endpoint-name "$ENDPOINT_NAME" \
    --enabled-state Enabled \
    --output none
fi

if ! az afd origin-group show \
  --resource-group "$RESOURCE_GROUP" \
  --profile-name "$PROFILE_NAME" \
  --origin-group-name "$ORIGIN_GROUP_NAME" \
  --output none >/dev/null 2>&1; then
  az afd origin-group create \
    --resource-group "$RESOURCE_GROUP" \
    --profile-name "$PROFILE_NAME" \
    --origin-group-name "$ORIGIN_GROUP_NAME" \
    --probe-request-type HEAD \
    --probe-protocol Https \
    --probe-interval-in-seconds 60 \
    --probe-path / \
    --sample-size 4 \
    --successful-samples-required 3 \
    --additional-latency-in-milliseconds 50 \
    --output none
fi

if ! az afd origin show \
  --resource-group "$RESOURCE_GROUP" \
  --profile-name "$PROFILE_NAME" \
  --origin-group-name "$ORIGIN_GROUP_NAME" \
  --origin-name "$ORIGIN_NAME" \
  --output none >/dev/null 2>&1; then
  az afd origin create \
    --resource-group "$RESOURCE_GROUP" \
    --profile-name "$PROFILE_NAME" \
    --origin-group-name "$ORIGIN_GROUP_NAME" \
    --origin-name "$ORIGIN_NAME" \
    --host-name "$FUNCTION_HOST" \
    --origin-host-header "$FUNCTION_HOST" \
    --http-port 80 \
    --https-port 443 \
    --priority 1 \
    --weight 1000 \
    --enabled-state Enabled \
    --output none
fi

if ! az afd route show \
  --resource-group "$RESOURCE_GROUP" \
  --profile-name "$PROFILE_NAME" \
  --endpoint-name "$ENDPOINT_NAME" \
  --route-name kehindecw2-api-route \
  --output none >/dev/null 2>&1; then
  az afd route create \
    --resource-group "$RESOURCE_GROUP" \
    --profile-name "$PROFILE_NAME" \
    --endpoint-name "$ENDPOINT_NAME" \
    --route-name kehindecw2-api-route \
    --origin-group "$ORIGIN_GROUP_NAME" \
    --supported-protocols Http Https \
    --patterns-to-match /api/* \
    --forwarding-protocol HttpsOnly \
    --https-redirect Enabled \
    --link-to-default-domain Enabled \
    --output none
fi

HOSTNAME="$(az afd endpoint show \
  --resource-group "$RESOURCE_GROUP" \
  --profile-name "$PROFILE_NAME" \
  --endpoint-name "$ENDPOINT_NAME" \
  --query hostName \
  --output tsv)"

echo "Azure Front Door endpoint: https://${HOSTNAME}"
echo "Frontend API base URL: https://${HOSTNAME}/api"

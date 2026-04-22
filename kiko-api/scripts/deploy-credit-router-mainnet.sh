#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-}"
DEFAULT_ENV_FILE="$ROOT_DIR/contracts.env"
APP_ENV_FILE="$ROOT_DIR/.env"

if [[ -n "$ENV_FILE" && ! -f "$ENV_FILE" ]]; then
  echo "Env file was provided but does not exist: $ENV_FILE"
  exit 1
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "forge is required but not installed."
  exit 1
fi

if ! command -v cast >/dev/null 2>&1; then
  echo "cast is required but not installed."
  exit 1
fi

if [[ -n "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [[ -f "$DEFAULT_ENV_FILE" ]]; then
  ENV_FILE="$DEFAULT_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [[ -f "$APP_ENV_FILE" ]]; then
  ENV_FILE="$APP_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  ENV_FILE="<process environment>"
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env: $name"
    exit 1
  fi
}

normalize_bool() {
  local value="${1:-false}"
  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" ]]
}

print_redacted_command() {
  local redact_next=false
  local arg
  for arg in "$@"; do
    if [[ "$redact_next" == "true" ]]; then
      printf ' %q' "<redacted-private-key>"
      redact_next=false
      continue
    fi
    printf ' %q' "$arg"
    if [[ "$arg" == "--private-key" ]]; then
      redact_next=true
    fi
  done
  echo
}

require_env BASE_MAINNET_RPC_URL
require_env CREDIT_ROUTER_DEPLOYER_PRIVATE_KEY
require_env CREDIT_ROUTER_OWNER_ADDRESS
require_env CREDIT_ROUTER_TREASURY_ADDRESS

CHAIN_ID="8453"
REFUND_AUTHORITY_ADDRESS="${CREDIT_ROUTER_REFUND_AUTHORITY_ADDRESS:-$CREDIT_ROUTER_OWNER_ADDRESS}"
REFUND_WINDOW_SECONDS="${CREDIT_ROUTER_REFUND_WINDOW_SECONDS:-86400}"
VERIFY_ENABLED="${CREDIT_ROUTER_VERIFY:-false}"
DRY_RUN_ENABLED="${CREDIT_ROUTER_DRY_RUN:-false}"
PRINT_RUNTIME_ENV="${CREDIT_ROUTER_PRINT_RUNTIME_ENV:-true}"
TOKEN_CONFIG_SIGNER_PRIVATE_KEY="${CREDIT_ROUTER_OWNER_PRIVATE_KEY:-$CREDIT_ROUTER_DEPLOYER_PRIVATE_KEY}"

DEPLOYER_ADDRESS="$(cast wallet address --private-key "$CREDIT_ROUTER_DEPLOYER_PRIVATE_KEY")"
TOKEN_CONFIG_SIGNER_ADDRESS="$(cast wallet address --private-key "$TOKEN_CONFIG_SIGNER_PRIVATE_KEY")"

TOKENS_REQUIRE_CONFIG=false
if [[ -n "${CREDIT_ROUTER_USDC_ADDRESS:-}" || -n "${CREDIT_ROUTER_USDT_ADDRESS:-}" || -n "${CREDIT_ROUTER_KIKO_ADDRESS:-}" ]]; then
  TOKENS_REQUIRE_CONFIG=true
fi

if [[ "$TOKENS_REQUIRE_CONFIG" == "true" && "$TOKEN_CONFIG_SIGNER_ADDRESS" != "$CREDIT_ROUTER_OWNER_ADDRESS" ]]; then
  echo "Token config signer does not match owner."
  echo "owner: $CREDIT_ROUTER_OWNER_ADDRESS"
  echo "token config signer: $TOKEN_CONFIG_SIGNER_ADDRESS"
  echo "Set CREDIT_ROUTER_OWNER_PRIVATE_KEY to the private key for the owner address, or leave token addresses blank and configure them manually later."
  exit 1
fi

echo "== CreditTopUpRouter Base Mainnet Deploy =="
echo "env source: $ENV_FILE"
echo "chain id: $CHAIN_ID"
echo "deployer: $DEPLOYER_ADDRESS"
echo "owner: $CREDIT_ROUTER_OWNER_ADDRESS"
echo "token config signer: $TOKEN_CONFIG_SIGNER_ADDRESS"
echo "treasury: $CREDIT_ROUTER_TREASURY_ADDRESS"
echo "refund authority: $REFUND_AUTHORITY_ADDRESS"
echo "refund window seconds: $REFUND_WINDOW_SECONDS"
echo

configure_token() {
  local router_address="$1"
  local symbol="$2"
  local token_address="$3"
  local refunds_enabled="$4"
  local nonce

  if [[ -z "$token_address" ]]; then
    echo "skip token config for $symbol: address not set"
    return 0
  fi

  nonce="$(cast nonce "$TOKEN_CONFIG_SIGNER_ADDRESS" --block pending --rpc-url "$BASE_MAINNET_RPC_URL")"
  echo "configure token: $symbol -> $token_address (refunds_enabled=$refunds_enabled)"
  echo "using pending nonce: $nonce"
  cast send \
    "$router_address" \
    "setTokenConfig(address,bool,bool)" \
    "$token_address" \
    true \
    "$refunds_enabled" \
    --nonce "$nonce" \
    --confirmations 1 \
    --rpc-url "$BASE_MAINNET_RPC_URL" \
    --private-key "$TOKEN_CONFIG_SIGNER_PRIVATE_KEY"
}

print_runtime_env_block() {
  local router_address="$1"
  cat <<EOF

Copy these runtime env values into kiko-api/.env:

CREDITS_TOPUP_MODE=router_contract
CREDITS_BASE_TREASURY_ADDRESS=$CREDIT_ROUTER_TREASURY_ADDRESS
CREDITS_TOPUP_ROUTER_ADDRESS=$router_address
CREDITS_REFUND_OPERATOR_ADDRESS=$REFUND_AUTHORITY_ADDRESS
CREDITS_BASE_USDC_ADDRESS=${CREDIT_ROUTER_USDC_ADDRESS:-}
CREDITS_BASE_USDT_ADDRESS=${CREDIT_ROUTER_USDT_ADDRESS:-}
CREDITS_BASE_KIKO_ADDRESS=${CREDIT_ROUTER_KIKO_ADDRESS:-}

EOF
}

FORGE_CREATE_ARGS=(
  forge create
  --broadcast
  contracts/credits/CreditTopUpRouter.sol:CreditTopUpRouter
  --rpc-url "$BASE_MAINNET_RPC_URL"
  --private-key "$CREDIT_ROUTER_DEPLOYER_PRIVATE_KEY"
)

if normalize_bool "$VERIFY_ENABLED"; then
  require_env BASESCAN_API_KEY
  FORGE_CREATE_ARGS+=(
    --verify
    --chain "$CHAIN_ID"
    --etherscan-api-key "$BASESCAN_API_KEY"
  )
fi

if normalize_bool "$DRY_RUN_ENABLED"; then
  echo "[dry-run] forge create command:"
  print_redacted_command "${FORGE_CREATE_ARGS[@]}"
  echo
  echo "[dry-run] token config actions:"
  [[ -n "${CREDIT_ROUTER_USDC_ADDRESS:-}" ]] && echo " USDC -> ${CREDIT_ROUTER_USDC_ADDRESS} refunds=${CREDIT_ROUTER_USDC_REFUNDS_ENABLED:-true}"
  [[ -n "${CREDIT_ROUTER_USDT_ADDRESS:-}" ]] && echo " USDT -> ${CREDIT_ROUTER_USDT_ADDRESS} refunds=${CREDIT_ROUTER_USDT_REFUNDS_ENABLED:-true}"
  [[ -n "${CREDIT_ROUTER_KIKO_ADDRESS:-}" ]] && echo " KIKO -> ${CREDIT_ROUTER_KIKO_ADDRESS} refunds=${CREDIT_ROUTER_KIKO_REFUNDS_ENABLED:-true}"
  if normalize_bool "$PRINT_RUNTIME_ENV"; then
    print_runtime_env_block "<router-address-after-deploy>"
  fi
  exit 0
fi

# CONTEXT MEMORY
# Updated: 2026-04-22
# Status: verified
# Why: forge create simulates by default; mainnet deployment must explicitly broadcast and
# keep constructor args last because `--constructor-args <ARGS>...` is variadic. Post-deploy
# token configuration is owner-gated and may need a different private key from the deployer.
# Debug Goal: dry-run must never attempt deployment parsing; non-dry-run must create a real contract.
# Search Tags: forge create broadcast missing deploy script constructor args order parse router address owner private key token config
# Invariants:
# - dry-run exits before any deploy or token config transaction is sent
# - non-dry-run includes --broadcast so forge returns a real deployed contract address
# - constructor args stay at the end of the command so option parsing does not swallow flags
# - setTokenConfig must be signed by the owner address, not merely the deployer
# - sequential token config calls use the pending nonce from the signer to avoid RPC nonce races
# Failure Modes:
# - forgetting --broadcast makes "real deploy" behave like a simulation
# - placing flags after `--constructor-args` can make forge ignore them or parse unexpectedly
# - using a deployer key for `setTokenConfig` reverts with OwnableUnauthorizedAccount
# - relying on provider default nonce selection can fail with `nonce too low` on rapid sequential sends
# - parsing forge output after a simulation yields an empty router address
FORGE_CREATE_ARGS+=(
  --constructor-args
  "$CREDIT_ROUTER_OWNER_ADDRESS"
  "$CREDIT_ROUTER_TREASURY_ADDRESS"
  "$REFUND_AUTHORITY_ADDRESS"
  "$REFUND_WINDOW_SECONDS"
)

echo "[deploy] forge create command:"
print_redacted_command "${FORGE_CREATE_ARGS[@]}"
echo

DEPLOY_OUTPUT="$("${FORGE_CREATE_ARGS[@]}")"
printf '%s\n' "$DEPLOY_OUTPUT"

ROUTER_ADDRESS="$(printf '%s\n' "$DEPLOY_OUTPUT" | awk '/Deployed to:/ { print $3 }' | tail -n 1)"
if [[ -z "$ROUTER_ADDRESS" ]]; then
  echo "Failed to parse deployed router address from forge output."
  exit 1
fi

echo
echo "router deployed at: $ROUTER_ADDRESS"
echo

configure_token "$ROUTER_ADDRESS" "USDC" "${CREDIT_ROUTER_USDC_ADDRESS:-}" "${CREDIT_ROUTER_USDC_REFUNDS_ENABLED:-true}"
configure_token "$ROUTER_ADDRESS" "USDT" "${CREDIT_ROUTER_USDT_ADDRESS:-}" "${CREDIT_ROUTER_USDT_REFUNDS_ENABLED:-true}"
configure_token "$ROUTER_ADDRESS" "KIKO" "${CREDIT_ROUTER_KIKO_ADDRESS:-}" "${CREDIT_ROUTER_KIKO_REFUNDS_ENABLED:-true}"

echo
echo "router owner() => $(cast call "$ROUTER_ADDRESS" "owner()(address)" --rpc-url "$BASE_MAINNET_RPC_URL")"
echo "router treasury() => $(cast call "$ROUTER_ADDRESS" "treasury()(address)" --rpc-url "$BASE_MAINNET_RPC_URL")"
echo "router refundAuthority() => $(cast call "$ROUTER_ADDRESS" "refundAuthority()(address)" --rpc-url "$BASE_MAINNET_RPC_URL")"
echo "router refundWindowSeconds() => $(cast call "$ROUTER_ADDRESS" "refundWindowSeconds()(uint64)" --rpc-url "$BASE_MAINNET_RPC_URL")"

if normalize_bool "$PRINT_RUNTIME_ENV"; then
  print_runtime_env_block "$ROUTER_ADDRESS"
fi

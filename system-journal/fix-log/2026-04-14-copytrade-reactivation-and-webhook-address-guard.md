# 2026-04-14 Copytrade Reactivation And Webhook Address Guard

## Problem

Two runtime gaps remained after the initial copy-trade wallet cleanup:

1. A config already marked `requiresResign=true` could still be toggled back to
   `active` through the lightweight status endpoint.
2. Alchemy webhook reconciliation still trusted every active persisted
   `targetWallet`, so one malformed legacy address could make the whole webhook
   address update fail for that chain.

## Root Cause

- `PATCH /api/copy-trade/config/:id/status` updated status without checking the
  config's re-sign requirement or target-wallet validity.
- `alchemyWebhookReconciler` built desired address sets from all active configs
  without re-validating the stored address against chain-specific rules.

## Fix

- Status reactivation now rejects configs that:
  - have `requiresResign=true`
  - have an invalid persisted wallet address
  - would collide with another already-active config on the same user+chain+target tuple
- Webhook reconciliation now filters desired addresses through chain validation
  before calling Alchemy.
- Invalid desired webhook addresses are logged and skipped instead of poisoning
  the full update batch.

## Document Provenance

- Source: production log `logs.1776098593325.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - blocking `requiresResign` reactivation
  - filtering malformed webhook target addresses
- Verification: verified in runtime and code review

## Guardrails

- `requiresResign=true` means the config is not safe to reactivate via a simple
  status toggle.
- Webhook desired sets must be chain-valid before external sync.
- A single malformed legacy config must not block unrelated valid tracked
  wallets from webhook registration.

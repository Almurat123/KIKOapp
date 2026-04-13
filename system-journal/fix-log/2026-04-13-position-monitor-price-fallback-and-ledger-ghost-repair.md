# 2026-04-13 Position Monitor Price Fallback And Ledger Ghost Repair

## Summary

Two runtime issues were visible in production:

- `TP/SL check skipped: Price not available` kept repeating because the monitor only
  consulted `cacheHub.getTokenPriceSnapshot(...)` and never used guarded runtime
  fallback when the cache was cold.
- `Exit price missing from live data; persisting exit with unresolved USD valuation`
  still happened even though `getGuardPriceSnapshot(...)` could resolve a live
  price through `getTokenInfo` or DEX-price fallback.
- After a real mirror sell succeeded, an older open position could remain in the
  TP/SL loop if durable ledger state had already reached closed / zero-remaining
  exposure but the legacy position row never got closed.

## What Changed

- `kiko-api/src/services/copytrade-v2/runtime/positionMonitor.ts`
  - TP/SL monitoring now falls back to `getGuardPriceSnapshot(...)` before skipping
    a cycle on price miss.
  - Exit execution now resolves guarded price fallback before persisting exit
    valuation.
  - Added monitor-side reconciliation for open ghosts whose durable ledger already
    shows closed / zero-remaining exposure.
- `kiko-api/src/services/copytrade-v2/runtime/legacyPositionExitRuntime.ts`
  - Applied the same guarded price fallback to the compatibility runtime.
- `kiko-api/src/services/copytrade-v2/runtime/ledgerClosedGhostPositionReconciler.ts`
  - New narrow repair owner for legacy open positions contradicted by durable ledger closure.
- `kiko-api/src/services/copytrade-v2/__tests__/ledgerClosedGhostPositionReconciler.test.ts`
  - Added regression coverage for ledger-closed ghost repair.

## Why

The repository already had `getGuardPriceSnapshot(...)`, which can resolve price
from cached snapshots, tokenInfo, DEX price fallback, and token metadata. The
runtime problem was not missing upstream capability; it was that the monitor and
legacy exit path stopped at cache miss and treated that as authoritative absence.

The lingering TP/SL loop after mirror sell was also not a pricing problem alone.
Production logs showed a successful mirror sell followed by continued TP/SL
warnings for an older `positionId`, which means the durable owner had already
advanced while the legacy open position row stayed behind.

## Design Boundary

- Cache snapshot miss is not enough to skip TP/SL or exit valuation.
- Durable ledger closed-state must dominate legacy open ghosts.
- Monitor repair remains narrow:
  - close only when ledger says `FOLLOWER_CLOSED`
  - or tracked remaining exposure is zero and exit evidence exists
- This change does not widen webhook attribution or mirror-sell ownership.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776053950823.json`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: identifying repeated TP/SL warnings after successful mirror sell and missing exit valuation fallback
- Verification: verified in runtime

- Source: `kiko-api/src/services/copytrade-v2/runtime/guardPrice.ts`
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: reusing existing guarded price resolution instead of snapshot-only behavior
- Verification: verified in code

- Source: `system-journal/design-language/copytrade-race-recovery.md`
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: keeping monitor repair anchored to durable owner state rather than webhook heuristics
- Verification: verified in code

## Verification

- `npx tsx --test --test-force-exit src/services/copytrade-v2/__tests__/guardPrice.test.ts src/services/copytrade-v2/__tests__/historicalTargetSellGhostPositionReconciler.test.ts src/services/copytrade-v2/__tests__/ledgerClosedGhostPositionReconciler.test.ts`
- `npx tsc --noEmit`

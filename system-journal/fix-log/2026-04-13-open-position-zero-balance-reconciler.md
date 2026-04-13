# 2026-04-13 Open Position Zero-Balance Reconciler

## Summary

Production still had a follower self-sell failure mode:

- the follower wallet had already sold or otherwise cleared the token balance
- the legacy `position.status` stayed `open`
- `PositionMonitor` kept treating the position as live exposure and re-ran price fetches every 60 seconds

This was not a pricing bug. It was a monitor-ownership bug: the monitor never
performed a generic balance check for mature open positions unless they were
already marked as `mirror_sell`.

## What Changed

- `kiko-api/src/services/copytrade-v2/runtime/zeroBalanceOpenPositionReconciler.ts`
  - New narrow reconciler for mature EVM open positions whose wallet balance is
    already zero or dust.
- `kiko-api/src/services/copytrade-v2/runtime/positionMonitor.ts`
  - Added zero-balance reconciliation before TP/SL price evaluation for open
    positions with no active exit work.
- `kiko-api/src/services/copytrade-v2/__tests__/zeroBalanceOpenPositionReconciler.test.ts`
  - Added regression coverage for mature zero-balance closure and grace-window skip.

## Why

The previous runtime only did balance-based cleanup in the `mirror_sell` dust
reconciler. That meant manually self-sold follower positions, or other paths
that cleared the wallet without setting `exitReason='mirror_sell'`, could stay
open forever.

For money-moving monitoring, `status='open'` is not enough. Mature positions
must still prove the follower wallet actually owns the token balance.

## Design Boundary

- This reconciler is narrow:
  - EVM only
  - `status='open'` only
  - mature positions only
  - zero/dust balance only
- It closes stale monitor ghosts.
- It does not infer mirror-sell attribution.
- It does not claim a target sell was detected.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776058177552.json`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: confirming recurring 60-second price fetches for a follower position that had already been self-sold
- Verification: verified in runtime

- Source: `kiko-api/src/jobs/positionMonitorJob.ts`
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: confirming the recurring query cadence matched the 60-second monitor loop
- Verification: verified in code

- Source: `system-journal/design-language/copytrade-race-recovery.md`
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: keeping this as monitor cleanup instead of widening ingress attribution
- Verification: verified in code

## Verification

- `npx tsx --test --test-force-exit src/services/copytrade-v2/__tests__/guardPrice.test.ts src/services/copytrade-v2/__tests__/historicalTargetSellGhostPositionReconciler.test.ts src/services/copytrade-v2/__tests__/ledgerClosedGhostPositionReconciler.test.ts src/services/copytrade-v2/__tests__/zeroBalanceOpenPositionReconciler.test.ts`
- `npx tsc --noEmit`

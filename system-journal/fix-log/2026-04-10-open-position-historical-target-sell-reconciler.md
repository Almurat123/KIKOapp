# Fix Log: 2026-04-10 Open Position Historical Target Sell Reconciler

## Summary

Production still emitted repeated `TP/SL check skipped: Price not available` warnings for
legacy open positions that had already missed their target-sell replay during buy confirmation.
The durable target-sell event existed, but no `position_exit_intents` row was ever created, so
`positionMonitor.ts` kept treating the position as a normal TP/SL candidate forever.

## What Changed

- Added `historicalTargetSellGhostPositionReconciler.ts` to let the runtime monitor replay
  persisted historical target-sell evidence into the same durable exit-intent scheduler used by
  buy confirmation and live sell webhook handling.
- Updated `positionMonitor.ts` to:
  - run this orphan repair before price-dependent TP/SL logic
  - skip TP/SL checks for positions that already have active exit intents
  - avoid repeating `Price not available` warnings once exit work has been armed
- Generalized `buyConfirmationMirrorSellRelease.ts` so monitor-side orphan recovery can reuse the
  same durable release helper while preserving source provenance in metadata.

## Why

The earlier buy-confirmation fix only protected future buy confirmations. It did not heal
historical production rows whose buy confirmation had already happened before the patch existed.
Those old rows could stay `Position.status='open'` forever with:

- a real `target_sell_events` row
- no active `position_exit_intents`
- no price data

That shape produced endless monitor noise without any exit progression.

## Runtime Evidence

- Verified on production database on 2026-04-10:
  - `Position.id = cmnqjfh2o1zb1oh6sq19ku2hf`
  - `Position.status = open`
  - latest `target_sell_events.target_sell_tx_hash = 0x0e055822cd7b4f9a51bbbaae78515026a8a8f1abf6c6f20015696183aa6ec21f`
  - `pending_attributed_positions.status = armed`
  - no latest exit intent existed for this position
- Verified from uploaded runtime log `logs.1775805546761.json` on 2026-04-10:
  - 16 repeated `TP/SL check skipped: Price not available` warnings
  - all warnings pointed to `positionId = cmnqjfh2o1zb1oh6sq19ku2hf`
  - warnings spanned deployments `8be43cda-1598-47e5-ab95-30b23faf220b`,
    `c15fb2ec-93fe-46db-9e4c-2fb72aa28cdb`, and `2d5f36ff-7a09-4107-a1aa-07c4caed7f1e`

## Document Provenance

- Source: Production PostgreSQL runtime data
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: confirming the old LIQ position remained open with durable sell history but no exit intent
- Verification: verified in runtime

- Source: `kiko-api/src/services/copytrade-v2/buy/buyConfirmationTransition.ts`
- Kind: repo doc
- Retrieved: 2026-04-10
- Applied To: confirming the earlier fix only covered future buy-confirmation replay
- Verification: verified in code

- Source: `/Users/almurat/Downloads/logs.1775805546761.json`
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: confirming the repeated warning still targeted the old LIQ position
- Verification: verified in runtime

# Fix Log: 2026-04-14 Copytrade Historical Target Sell Release Result Semantics

## Summary

Production log `logs.1776159582066.json` showed a BSC copytrade position with an already-active
mirror-sell intent still emitting both:

- `mirror_sell_idempotent_skip`
- `Historical target sell ghost position replayed into exit flow`

for the same `positionId` and `targetSellTxHash`.

The worker was not proving a second sell execution. The bug was that the historical release helper
returned one boolean success shape for two materially different outcomes:

- new durable exit work was scheduled
- the durable scheduler found an already-active exit intent and reused it

That collapsed idempotent reuse into the same "replayed" semantics used for true historical replay.

## What Changed

- `buyConfirmationMirrorSellRelease.ts`
  - return type changed from `boolean` to structured outcome
  - now distinguishes:
    - `scheduled`
    - `already_active`
    - `armed_pending`
    - non-action outcomes
- `buyConfirmationTransition.ts`
  - still arms order state when historical sell evidence maps to existing exit work
  - logs true replay only for `scheduled`
  - logs reuse separately for `already_active` and `armed_pending`
- `historicalTargetSellGhostPositionReconciler.ts`
  - treats `already_active` as repaired so monitor-side TP/SL does not proceed on stale snapshots
  - stops claiming "replayed into exit flow" when no new exit work was created
- added regression tests for:
  - helper returning `already_active`
  - reconciler treating `already_active` as repaired

## Why

The monitor can run with an older snapshot of active exit intents than the scheduler state that
exists by the time historical release is attempted. In that shape, the owner layer must say:

- durable exit work already exists
- but no fresh replay happened

Those are different facts and callers must not collapse them.

## Runtime Evidence

- Source log: `/Users/almurat/Downloads/logs.1776159582066.json`
- Verified on 2026-04-14
- Relevant facts:
  - `positionId = cmnyff7d20igelhbbuczqcocq`
  - `targetSellTxHash = 0x8a32f0daee495d4fc366890f484252a82bcfa0b403ae07fc83e32caafa345df9`
  - `mirror_sell_idempotent_skip`
    - `blockedReason = active_intent`
    - `reasonCode = position_exit_intent_active`
  - followed by `Historical target sell ghost position replayed into exit flow`

That sequence proved the helper semantics were too coarse.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776159582066.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To: separating true replay from active-intent reuse
- Verification: verified in runtime

- Source: `kiko-api/src/services/copytrade-v2/buy/buyConfirmationMirrorSellRelease.ts`
- Kind: repo doc
- Retrieved: 2026-04-14
- Applied To: release helper result-shape correction
- Verification: verified in code

- Source: `kiko-api/src/services/copytrade-v2/runtime/historicalTargetSellGhostPositionReconciler.ts`
- Kind: repo doc
- Retrieved: 2026-04-14
- Applied To: monitor-side repaired-vs-replayed semantics
- Verification: verified in code

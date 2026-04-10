# Fix Log: Buy Confirmation Target-Sell Replay Gap

Updated: 2026-04-10

## Problem

A copytrade position could stay `open` forever when the target sell webhook was
persisted before follower buy confirmation finished, but no pending lot or
canonical order metadata carried that sell into the buy-confirmation owner path.

The result was a silent "open with no exit intent" position that later kept
re-entering TP/SL monitoring and repeatedly logged
`TP/SL check skipped: Price not available`.

## Root Cause

`applyBuyConfirmationTransition()` only merged mirror-sell intent from:

- pending attributed lot / active exit intent
- canonical order metadata

It did **not** replay durable `TargetSellEvent` history when those two direct
signals were missing.

This made the buy-confirmation owner layer incomplete: the system had already
persisted evidence that the target sold, but the owner responsible for turning a
confirmed buy into durable open exposure never consumed that evidence.

## Target Behavior

- Buy confirmation must check durable historical target-sell evidence when
  direct pending/order intent is absent.
- If replayable sell history exists, buy confirmation must release it into the
  same durable exit-intent scheduler used by live sell webhooks.
- Positions should not fall back into passive open monitoring when a sell was
  already durably observed for the same buy lifecycle.

## Files Corrected

- `kiko-api/src/services/copytrade-v2/buy/buyConfirmationTransition.ts`
- `kiko-api/src/services/copytrade-v2/positions/buySellRaceCoordinator.ts`
- `kiko-api/src/services/copytrade-v2/buy/buyConfirmationMirrorSellRelease.ts`
- `kiko-api/src/services/copytrade-v2/exit/targetSellEventStore.ts`

## Related Entries

- [Fix Log: Terminal Exit Ghost Position](./2026-04-08-terminal-exit-ghost-position.md)

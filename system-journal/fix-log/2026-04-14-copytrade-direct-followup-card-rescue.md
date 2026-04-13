# 2026-04-14 Copytrade Direct Followup Card Rescue

## Summary

Confirmed copy-trade execution could succeed on the backend while the current
chat session still showed only plain text. The live `strategy-card` did not
appear until the session was reopened.

## Root Cause

- Owner: `kiko-api/src/jobs/chat/tradeFollowupExecutor.ts`
- The confirmation turn executes `create_copy_trade_config` through the direct
  follow-up path, then relies on `ChatStreamBroker.recordToolResult()` to emit
  the generic `show_strategy_card` client action.
- Runtime logs from `logs.1776097267399.json` showed confirmed
  `create_copy_trade_config` execution traces, but no `show_strategy_card` or
  `client_action` entries at all.
- Transaction status cards already had an explicit rescue broadcast inside
  `tradeFollowupExecutor`, but strategy cards did not.
- Result: if the generic broker side-effect path lagged or silently missed
  websocket emission, the direct follow-up turn completed without a live card.

## Correction

- Added an explicit strategy-card rescue path in
  `tradeFollowupExecutor.broadcastClientAction()`.
- Confirmed copy-trade execution now:
  - best-effort updates the current assistant message to `strategy-card`
  - explicitly broadcasts `show_strategy_card` to the current session
- This keeps direct follow-up behavior aligned with the existing transaction
  card rescue model.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776097267399.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To: confirming that confirmed copy-trade execution completed without
  any emitted live `show_strategy_card` or `client_action` trace.
- Verification: partially verified

- Source: `kiko-api/src/jobs/chat/tradeFollowupExecutor.ts`
- Kind: repo doc
- Retrieved: 2026-04-14
- Applied To: confirming that direct follow-up already contained a transaction
  card rescue branch but had no equivalent strategy-card rescue branch.
- Verification: verified in code

## Verification

- `npx tsx --test src/jobs/chat/tradeFollowupExecutor.test.ts`

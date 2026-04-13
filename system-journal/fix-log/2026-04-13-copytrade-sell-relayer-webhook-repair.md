# 2026-04-13 Copytrade Sell Relayer Webhook Repair

## Summary

Webhook ingress was dropping a real Base target sell because the tracked wallet submitted an on-chain Permit2 approval first and a relayer contract executed the actual swap in a second transaction. The old ingress rule replaced all EVM candidates with `tx.from`, so the relayer address overwrote the tracked wallet and the sell never reached swap decode.

## What Changed

- `kiko-api/src/routes/webhook.ts`
  - Added `CONTEXT MEMORY` for EVM webhook ownership.
  - Added calldata address extraction for EVM full transactions.
  - When `tx.from` is not itself a tracked wallet, webhook now supplements candidate resolution with addresses explicitly encoded in full transaction calldata.
  - Added a narrow bypass so relayer-attributed tracked wallets are not skipped by the early `tx_from_only` short-circuit.
- `kiko-api/src/services/copytrade-v2/__tests__/webhookRecovery.test.ts`
  - Added regression tests for calldata candidate extraction and relayer-binding bypass.

## Why

The runtime evidence showed a two-step sell:

1. `0xcd971b188835a737db9c1fac1dbbc6cbf85ea7cbada4d1a99ab33a61349a479f`
   - `from = tracked wallet`
   - `to = token contract`
   - selector `0x095ea7b3`
   - logs contained only `Approval`
   - this was an `approve(Permit2)` transaction, not the sell itself
2. `0x054ea6afaa4dff582cc72e827e907539944a7ebfbb6af74b90f8dbf686b530d8`
   - `from = relayer`
   - `to = router/executor`
   - calldata encoded the tracked wallet address as the first argument
   - receipt contained the real swap logs and token/native transfers

Before this fix, webhook resolved `sourceTxFrom = relayer` and replaced all candidates with that address, so tracked-wallet resolution became empty and the tx was ignored before swap decoding.

## Design Boundary

- `tx.from` remains the canonical first-pass owner signal.
- Calldata fallback is only used when `tx.from` is not itself a tracked wallet.
- Relayer mismatch is tolerated only for wallets explicitly recovered from calldata.
- This is not a rollback to broad multi-wallet matching.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776050120896.json`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: identifying the missed sell as a webhook ingress attribution failure
- Verification: verified in runtime

- Source: Base transaction replay for
  - `0xcd971b188835a737db9c1fac1dbbc6cbf85ea7cbada4d1a99ab33a61349a479f`
  - `0x054ea6afaa4dff582cc72e827e907539944a7ebfbb6af74b90f8dbf686b530d8`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: proving the first tx was only approval and the second tx carried the tracked wallet inside calldata
- Verification: verified in runtime via configured Base RPC

## Verification

- `npx tsx --test --test-force-exit src/services/copytrade-v2/__tests__/webhookRecovery.test.ts`
- `npx tsc --noEmit`

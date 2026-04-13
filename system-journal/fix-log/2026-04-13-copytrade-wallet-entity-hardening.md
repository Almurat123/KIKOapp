# 2026-04-13 Copytrade Wallet Entity Hardening

## Problem

Copy-trade chat execution accepted malformed target wallets for BSC configs.
The user's literal wallet strings in chat were correct, but malformed wallet
strings still reached `create_copy_trade_config`, then persisted into
`CopyTradeConfig.targetWallet`.

Two concrete failures were verified from chat transcript, logs, and production
database rows:

- `0xbd708164137146ac234aceb75d3981cd3599e21a` became
  `0xbd708164137146ac234aceb75d3981cd359e21a` (missing `9`)
- `0x077b9981bc8a2ca417cea41861111da63266988b` became
  `0x077b9981bc8a2ca417cea418611da63266988b` (missing `11`)

## Root Cause

This was not a database truncation bug.

The malformed wallet strings already existed before persistence:

1. The chat canonical-intent path allowed malformed `walletAddresses` from LLM
   normalization to survive entity normalization.
2. The copy-trade trading-intent path preferred
   `normalizedIntent.entities.walletAddresses[0]` over the exact wallet address
   extracted from the user's literal message/history.
3. `validateAddress()` used a loose EVM check and incorrectly accepted partial
   `0x...` strings of length 40/41 because they still satisfied the fallback
   "32-44 characters" branch.

## Fix

- Filter malformed `walletAddresses` out of canonical-intent entities.
- Resolve copy-trade `target_wallet` from the latest literal user wallet first.
- Add a final tool-execution repair step for `create_copy_trade_config` so an
  invalid tool arg is replaced by the exact literal wallet when one is present.
- Tighten `validateAddress()` to strict EVM/Solana regex validation.

## Verification

- Verified the malformed addresses in production logs and database rows.
- Verified that the malformed wallet already appeared in `tool_create` /
  `signedPayload.targetWallet`, proving persistence was not the corruption step.
- Added unit tests for:
  - canonical-intent malformed wallet filtering
  - copy-trade target resolution preferring the literal user wallet
  - tool-execution repair before confirmation gating
  - strict wallet validation rejecting truncated EVM addresses

## Guardrail

For copy-trade wallet identity, exact user-provided wallet strings outrank LLM
wallet entities. Malformed wallet entities must be discarded before they can
shape tool arguments or confirmation payloads.

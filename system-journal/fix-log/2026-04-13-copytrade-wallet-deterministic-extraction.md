# 2026-04-13 Copytrade Wallet Deterministic Extraction

## Problem

LLM-normalized wallet entities are not safe as the authoritative source for
copy-trade target wallets. The model can drop repeated characters when
rewriting long identifiers, and a prompt-only reminder cannot make that path
funds-safe.

## Root Cause

The previous hardening made literal user wallets outrank LLM entities, but the
literal extraction logic still lived in more than one owner and did not make
multi-wallet ambiguity explicit. That left future code at risk of reintroducing
a local regex and letting the model choose between multiple wallet candidates.

## Fix

- Added `walletAddressExtraction.ts` as the deterministic EVM/Solana wallet
  literal extractor.
- `tradingIntentResolver` now marks copy-trade target wallets ambiguous when the
  latest user message contains more than one wallet literal.
- `ToolExecutionEngine` blocks `create_copy_trade_config` with
  `AMBIGUOUS_COPY_TRADE_TARGET_WALLET` when multiple latest-message wallets are
  present.
- Added a Postgres partial unique index for active copy-trade configs:
  `userId + chainId + lower(targetWallet)` where `status = active`.

## Verification

- Added tests for EVM/Solana text extraction, truncated EVM rejection, ambiguous
  copy-trade intent slots, and ambiguous tool execution blocking.
- The production rows for the known corrupted active BSC configs were repaired
  before applying the database-level uniqueness invariant.

## Guardrail

LLM output can describe the intent, but exact wallet identity must come from a
deterministic extractor or an already-confirmed signed payload. Multiple wallet
literals require user disambiguation; the model must not choose one.

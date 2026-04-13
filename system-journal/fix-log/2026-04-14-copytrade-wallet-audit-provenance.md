# 2026-04-14 Copytrade Wallet Audit Provenance

## Problem

The runtime fix prevents malformed copy-trade target wallets, but future
incident response still needs durable evidence showing where the final wallet
came from. Chat history and model traces are not stable enough as the only
source of truth for funds-sensitive wallet identity.

## Root Cause

The previous copy-trade create flow wrote only the final config row. It did not
persist:

- raw user message containing the wallet
- deterministic wallet candidates extracted from that message
- LLM/tool target wallet argument before deterministic override
- final wallet sent to persistence
- written wallet from the resulting config row

Without those fields, a later investigation must reconstruct provenance from
logs and transient chat state.

## Fix

- Added `CopyTradeWalletAudit` storage.
- Added `copyTradeWalletAuditService` for best-effort append-only audit writes.
- `ToolExecutionEngine` attaches copy-trade wallet-binding provenance to the
  confirmation payload without adding it to public executable args.
- `conversationStateResolver` preserves that provenance through the later
  confirmation turn.
- `tradeFollowupExecutor` forwards preserved provenance in tool context.
- Chat tool and signed HTTP create paths record audit rows for created,
  already-existing, and database-unique-race outcomes.

## Verification

- Added unit coverage for audit row parameter construction.
- Added confirmation-state coverage proving wallet-binding provenance survives
  preflight-to-confirm.
- Existing copy-trade duplicate and address hardening tests still pass.

## Guardrail

Audit write failures must not block copy-trade creation. Execution correctness
still belongs to deterministic extraction, strict validation, confirmation token
binding, and the database active uniqueness index.

# 2026-04-16 Copytrade Entry Deviation Unreliable Bypass Block

## Problem

Production logs showed a turbo Four.meme buy passing copytrade admission even though its entry-deviation bps exceeded the configured turbo threshold. The pass happened because the runtime treated an unreliable market/reference price as permission to bypass the exceeded entry-deviation guard.

Observed runtime sample:

- Log source: `/Users/almurat/Downloads/logs.1776331932518.json`
- Token: `0x150c567d9bca2ac9e6a6aaef706ca253c86b4444`
- Trace: `6b5901e5-20f3-44b1-9cab-70e51dfbf89f`
- Mode: `turbo`
- Deviation: `12038.76 bps`
- Limit: `3000 bps`
- Guard result before this fix: `price_deviation_unreliable_price_bypass`
- Final outcome: Four.meme buy reverted with `Slippage: Slippage`

## Root Cause

The runtime inverted the safety meaning of unreliable pricing evidence. Once entry deviation exceeded the configured ceiling, an unreliable price/liquidity anchor should have made the system more conservative. Instead, the old logic emitted a pass and allowed the order to reach launchpad execution.

The submission path also forwarded `allowFallbackEntryDeviationBypass=true` when the price was considered unreliable, leaving a second bypass channel for fallback pricing guards.

## Fix

- Added a deterministic entry-deviation excess decision that skips when deviation exceeds the configured limit.
- Split skip reasons between reliable reference excess and unreliable reference excess.
- Removed the unreliable-price bypass from the runtime buy admission path.
- Stopped forwarding fallback entry-deviation bypass permission into EVM copytrade buy submission.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776331932518.json`
- Kind: runtime observation
- Retrieved: 2026-04-16
- Applied To: copytrade turbo/Four.meme buy admission and fallback pricing guard context
- Verification: verified in code and targeted unit tests

## Guardrails

- Do not let missing or unreliable liquidity/price evidence become permission to buy after entry-deviation limits are already exceeded.
- Do not let launchpad contract reverts become the first effective price guard.
- Keep Four.meme pre-graduation failures terminal unless a graduation signal explicitly proves standard routing is valid.

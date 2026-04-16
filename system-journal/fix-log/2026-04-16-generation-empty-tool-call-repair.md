# 2026-04-16 Generation Empty Tool Call Repair

## Summary

The generation stream could emit a tool call delta with structured arguments but
an empty function name. That produced noisy `ignoring_empty_tool_call` warnings
even when the argument shape clearly matched exactly one allowed tool.

## What Changed

- Added `kiko-python/generation/tool_call_repair.py` with deterministic
  tool-name inference from declared function-tool schemas and argument keys.
- Updated both:
  - `kiko-python/generation/app.py`
  - `kiko-python/orchestration/service.py`
- Empty-name tool calls are now repaired when the schema match is strong enough;
  otherwise they are still ignored.

## Why

Dropping a structurally valid tool call is the wrong default when the system
already has the allowed tool schema in hand. This repair keeps the system
conservative while eliminating a known noisy failure mode.

## Document Provenance

- Source: production/runtime log showing an empty-name tool call with
  `address`, `chain`, `chain_id`, and `days` for a Base wallet PnL request
- Kind: runtime observation
- Retrieved: 2026-04-16
- Applied To: generation and orchestration empty tool-call repair
- Verification: verified in runtime logs, code, and targeted tests

## Verification

- Added Python test coverage for wallet PnL argument-key inference

## Owner Boundaries

- The provider owns raw stream deltas.
- `generation/app.py` owns translation from provider deltas into generation SSE.
- `orchestration/service.py` owns the same repair when it handles gateway rounds
  directly.

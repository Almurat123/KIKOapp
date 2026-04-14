# 2026-04-14 Copytrade BSC Four.meme Direct-Only Exit

## Problem

Copytrade BSC mirror-sell execution for four.meme tokens was modeled as
`direct_primary`, which still left an external retry branch available later in
the immediate retry sequence. For pre-graduation four.meme tokens this is
unsafe: sell execution must stay on the launchpad path and must not drift to 0x
or other standard EVM routing until DEX graduation is explicitly known.

## Root Cause

- Exit planning encoded four.meme sells as `direct_primary`.
- Exit execution interpreted `direct_primary` as "direct first, external retry
  allowed later".
- `MainSwapService` also allowed four.meme fallback to standard EVM swap based
  generic launchpad fallback text, without distinguishing buy-side vs sell-side
  semantics.

## Fix

- Added `direct_only` to copytrade exit route policy.
- Four.meme exit plans now select `direct_only`.
- Immediate exit retries for `direct_only` never include external retry steps.
- `MainSwapService` no longer falls back to standard EVM routing when a
  four.meme sell reverts on the launchpad path.
- Follow-up correction: if the Four.Meme sell path itself returns explicit
  graduation evidence (`Liquidity already added to DEX`, `Use aggregator
  instead`, or `graduated`), `MainSwapService` may switch that sell to the
  standard EVM aggregator path. This is not a generic fallback; it is a
  graduation-proof escape from the bonding-curve owner.

## Document Provenance

- Source: production log `logs.1776101245961.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - four.meme copytrade exit route policy
  - four.meme sell fallback prohibition in MainSwapService
- Verification: verified in runtime, code review, and targeted tests

- Source: `/Users/almurat/Downloads/logs.1776169106790.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - allowing Four.Meme graduated sell fallback to the 0x-only EVM route
  - preserving main swap runtime tx hash before `[OrderRuntime] main-swap-finish`
- Verification: verified in logs and targeted tests

## Guardrails

- BSC four.meme pre-graduation sells are launchpad-owned flows.
- Direct-only means every immediate retry attempt remains direct.
- Standard EVM / 0x fallback requires explicit graduation evidence, not a
  generic launchpad revert string.
- Graduation evidence is message-level evidence from the launchpad execution
  owner; ordinary bonding-curve reverts such as `GW: GW` must still fail safely
  and must not enter 0x.

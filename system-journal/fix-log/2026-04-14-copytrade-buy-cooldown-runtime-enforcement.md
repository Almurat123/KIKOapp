# 2026-04-14 Copytrade Buy Cooldown Runtime Enforcement

## Problem

Production incident `logs.1776155212543.json` showed the same user/config/token on
BSC re-entering within the configured 60-minute cooldown window. The guard audit
reported `cooldown.enabled = true`, but the runtime still created a fresh buy.

## Root Cause

- `legacyCopytradeBuyRuntime` only enforced `buildDuplicateTradeWhere(...)`
  before creating the pending position.
- That duplicate query only protected pending-position states and did not check
  recent strategy activity within the configured cooldown window.
- The correct owner already existed in `buy/exposurePreflight.ts`, but it was
  not wired into the actual runtime buy admission path.

## Fix

- Injected `evaluateCopytradeExposurePreflight()` into the legacy copytrade buy
  runtime dependencies.
- The buy runtime now vetoes entry before pending-position creation when either:
  - active exposure is still present for the same user/config/token/chain
  - recent strategy activity exists within the configured cooldown window
- Canonical order state and guard audit now record:
  - `entry_policy_block_active_exposure`
  - `cooldown_recent_strategy_activity`

## Document Provenance

- Source: /Users/almurat/Downloads/logs.1776155212543.json
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - enforcing same-token cooldown in the actual runtime buy admission owner
  - stopping repeated buys inside the configured cooldown window
- Verification: verified in logs and unit tests

## Guardrails

- Cooldown audit fields are not evidence of enforcement by themselves.
- Runtime buy admission must enforce both:
  - pending-position duplicate lock
  - recent strategy cooldown / active exposure preflight
- Future refactors must not leave `evaluateCopytradeExposurePreflight()` orphaned
  outside the real buy path.

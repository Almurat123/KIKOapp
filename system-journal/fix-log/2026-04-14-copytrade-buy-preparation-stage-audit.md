# 2026-04-14 Copytrade Buy Preparation Stage Audit

## Problem

Runtime logs showed `buy_dispatch_gate` recording roughly 2.5 seconds of delay
before buy execution on BSC, but the owner layer did not expose which
preparation stage consumed that time.

## Root Cause

- `handleTargetBuy()` performed several synchronous preparation stages before
  entering `processBuyWithInfo()`:
  - config fetch and target-wallet filtering
  - shared warmup
  - config materialization and signature filtering
  - launchpad detection setup
  - token info fetch and fallback resolution
- The code only emitted coarse start logs, so latency attribution collapsed
  onto the downstream `buy_dispatch_gate` observation.

## Fix

- Added a buy preparation audit context in `autoTradeService.ts`.
- `handleTargetBuy()` now records named stage durations for:
  - raw config fetch
  - target-wallet filter
  - shared warmup
  - config materialization
  - signature filter
  - dedupe
  - launchpad detection start
  - turbo metadata fallback
  - token info fetch
  - launchpad resolve
  - RPC metadata-only fallback
- Every return path now flushes a single `[CopyTradeTiming] buy preparation stages`
  log with the total preparation time and stage breakdown.

## Document Provenance

- Source: /Users/almurat/Downloads/logs.1776151885257.json
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - attributing copytrade buy latency before `processBuyWithInfo()`
  - preventing downstream guards from absorbing upstream timing blame
- Verification: verified in code review; runtime verification pending deploy

## Guardrails

- Preparation audit is observational only and must not change buy admission.
- Future latency work should use stage evidence first, not infer blame from the
  first downstream gate that logs elapsed time.
- New synchronous preparation work must add a named stage instead of hiding in
  an unlabeled elapsed log.

# Fix Log: 2026-04-14 Copytrade Target-Signal Cooldown And Exit Finality

## Summary

This fix closes three regressions observed in `logs.1776165812688.json`:

- Same-token cooldown now considers recent target-wallet buy signals, not only
  follower `Position` rows.
- Mixed turbo/normal copytrade buy batches no longer let normal-mode liquidity
  preparation block turbo-mode dispatch.
- Mirror-sell exits that return a successful `requireConfirmedTx` swap result
  are persisted as confirmed exits instead of `exit_finality_pending`.

## Root Cause

- Cooldown enforcement was scoped to `userId + configId + chainId + token` in
  follower positions. If the previous signal had skipped, failed before a
  position existed, or closed quickly, the target-wallet same-token signal itself
  was not considered cooldown evidence.
- `autoTradeService.processBuyWithInfo()` prepared liquidity for the entire
  mixed batch before turbo dispatch. One normal follower could therefore keep
  turbo followers behind full liquidity preparation.
- `copytrade-v2/exit/executor.ts` adjudicated finality from runtime/lifecycle
  state only. For direct exits where `submitCopytradeExit()` was called with
  `requireConfirmedTx: true`, a successful swap result with a tx hash is already
  confirmed evidence unless an explicit failed state exists.

## What Changed

- `buy/exposurePreflight.ts` now accepts recent target-signal orders and queries
  canonical `copytrade_orders` for recent same-user/config/target-wallet/token
  buy signals inside the cooldown window.
- `legacyCopytradeBuyRuntime.ts` passes `targetWallet` and source leader tx hash
  into exposure preflight so the current signal can be excluded while prior
  signals still block.
- `autoTradeService.ts` splits `turboConfigs` from `normalConfigs`, dispatches
  turbo with `skipLiquidityScan: true`, and only then prepares full liquidity
  for normal configs.
- `exit/executor.ts` trusts `swapResult.success === true` with canonical tx hash
  as confirmed success, after preserving explicit failed lifecycle precedence.

## Guardrails

- Cooldown protects strategy admission, not only open follower exposure.
- Current leader tx must be excluded from recent target-signal cooldown checks.
- Turbo followers must not wait for normal-mode liquidity scans.
- `requireConfirmedTx` success must not be downgraded to pending visibility
  unless there is explicit failed evidence.

## Verification

- Added unit tests for target-signal cooldown admission.
- Added runtime test coverage that `targetWallet` and `sourceTxHash` reach the
  exposure preflight owner.
- Added finality tests for confirmed swap success and explicit failed lifecycle
  precedence.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776165812688.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - same-token target-wallet signal cooldown
  - mixed turbo/normal buy hot-path separation
  - mirror-sell finality normalization
- Verification: verified in logs, targeted tests for cooldown/finality, and
  `tsc` for the mixed-path split

- Source: `system-journal/design-language/copytrade-buy-hot-path-refactor-todo.md`
- Kind: repo doc
- Retrieved: 2026-04-14
- Applied To: preserving the hot-path boundary that keeps non-essential context
  enrichment out of turbo buy dispatch
- Verification: verified in code design review

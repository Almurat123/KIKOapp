# Fix Log: 2026-04-14 Copytrade Turbo Preparation Skip

## Summary

Turbo-only copytrade buy batches no longer block pre-send execution on shared
liquidity scans or synchronous Solana market-cap supply hydration.

The hot path now uses the existing shared-preparation policy:

- `allTurbo = true`
- `skipLiquidityScan = true`
- `skipMarketCapDerivation = true`

This keeps guarded/normal modes unchanged while preventing turbo-only buys from
paying for preparation work that is not required before transaction submission.

## Why

The buy hot-path refactor identified that `processBuyWithInfo()` still executed
`preparePerConfigBuyLiquidity()` before dispatching turbo buys. That contradicted
the existing policy language in `sharedPreparationPolicy.ts`, where turbo-only
batches were already classified as eligible to skip shared preparation.

## What Changed

- `perConfigBuyLiquidity.ts` now accepts `skipLiquidityScan`.
- When skipped, the helper returns a deterministic unavailable snapshot with
  `metadata.mode = turbo_skip_liquidity_scan`.
- `autoTradeService.processBuyWithInfo()` resolves the shared-preparation policy
  once per batch and passes `skipLiquidityScan` into liquidity preparation.
- Synchronous Solana supply-based market-cap hydration is skipped for turbo-only
  batches.

## Boundary Correction

- Turbo buy hot path owns transaction admission and submission speed.
- Liquidity enrichment owns guarded mode prefilter accuracy.
- Market-cap derivation owns analytics/safety enrichment, not turbo buy dispatch.

## Verification

- `npx tsc --noEmit`
  - Passed
- `npm test -- src/services/copytrade-v2/__tests__/legacyCopytradeBuyRuntime.test.ts src/services/copytrade-v2/__tests__/tradeHotPathSupport.test.ts`
  - Passed
- `npm test -- src/services/copytrade-v2/__tests__/perConfigBuyLiquidity.test.ts`
  - Passed after adding a regression test for `skipLiquidityScan`.

## Document Provenance

- Source: `system-journal/design-language/copytrade-buy-hot-path-refactor-todo.md`
- Kind: repo doc
- Retrieved: 2026-04-14
- Applied To: separating non-essential context enrichment from turbo-only buy send path
- Verification: verified in code design review

- Source: `kiko-api/src/services/copytrade-v2/buy/sharedPreparationPolicy.ts`
- Kind: repo code
- Retrieved: 2026-04-14
- Applied To: connecting the existing skip policy to the runtime liquidity preparation call
- Verification: verified in code

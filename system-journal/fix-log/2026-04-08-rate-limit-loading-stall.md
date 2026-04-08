# Fix Log: Rate Limit Loading Stall

Updated: 2026-04-08

## Problem

The platform sometimes opened into a long loading state, showed stale data, or
appeared frozen. Console evidence showed repeated HTTP 429 responses on
`/api/tokens/trending/live`, copy-trade config reads, and some real-time update
channels.

## Root Cause

1. `TokensPage` fanned out seven chain reads in parallel and also triggered a
   second refresh shortly after mount.
2. `tokenApi.getTrendingLive()` appended a timestamp nonce, which defeated
   request dedupe and app-level caching.
3. Shared read helpers treated 429s as hard failures instead of reusing the last
   valid snapshot.
4. `useStrategies()` used a single `Promise.all`, so one throttled source could
   drop the rest of the merged strategy view.

## Target Behavior

- First paint should prefer a recovered snapshot over a blank loader.
- Read fan-out should be bounded and dedupable.
- 429s should degrade to stale-but-present data when possible.
- One failing source must not erase the rest of the strategy list.

## Files Corrected

- `kiko-web/src/services/api.ts`
- `kiko-web/src/utils/apiCache.ts`
- `kiko-web/src/pages/TokensPage.tsx`
- `kiko-web/src/hooks/useStrategies.ts`
- `kiko-web/src/services/copyTradeApi.ts`
- `kiko-web/src/services/polymarketCopyApi.ts`


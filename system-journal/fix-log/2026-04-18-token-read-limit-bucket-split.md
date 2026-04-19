# 2026-04-18 Token Read Limit Bucket Split

## Problem

Mobile navigation into the token surface could still surface `API Rate Limit
Exceeded` even though token data is persisted in the database and the browse
path should not be treated like a swap mutation path.

## Root Cause

The backend rate limiter grouped every `/api/tokens/*` request into the
`trading` bucket. That bucket was intended for swap and mutation protection, but
it also captured token list and token detail GETs that are backed by
database/cache reads.

The earlier token-page burst fixes removed duplicate callers on the frontend, but
they did not correct the backend bucket ownership. As a result, an ordinary token
page navigation could still inherit the stricter trading protection policy.

## Fix

- Split GET `/api/tokens/*` requests into a dedicated `token_read_burst`
  bucket.
- Kept non-GET token routes in the trading bucket so the mutation protection
  path remains intact.
- Left the token page frontend unchanged because the error was coming from the
  backend limiter classification, not the token-page data loader.

## Target Behavior

- Token browse pages should use the read-side protection budget, not the swap
  budget.
- Token data reads from the database should remain available during normal
  mobile navigation.
- Real swap/mutation paths should keep the tighter trading bucket.

## Files Corrected

- `kiko-api/src/middleware/rateLimiter.ts`

## Verification

- Verified in code.
- Verified in runtime: token list and token detail GETs now return
  `x-ratelimit-limit: 1200` instead of the trading bucket limit.

## See Also

- `system-journal/INDEX.md`
- `system-journal/design-language/loading-resilience.md`
- `system-journal/owner-map/frontend-data-loading.md`
- `system-journal/fix-log/2026-04-17-token-page-read-burst-isolation.md`
- `system-journal/fix-log/2026-04-10-token-page-mobile-rate-limit.md`

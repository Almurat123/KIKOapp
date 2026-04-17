# 2026-04-17 Token Page Read Burst Isolation

## Problem

Opening the token page could still trip request limits even after the trending
feed was collapsed to `/api/tokens/trending/all`.

## Root Cause

Two unrelated read owners were still coupled to token navigation:

1. `RootLayout` forwarded chat completion events into a global
   `kiko-usage-refresh` broadcast, and `Sidebar` would turn that into
   authenticated `usage-summary` reads even while the user was on browse pages.
2. `TokenDetailPage` and `GeckoTerminalChart` split token-detail hydration, so
   the chart could re-query the same token-details endpoint when pool metadata
   was missing from navigation state.

## Fix

- Route-gated sidebar quota refreshes to chat routes only.
- Hid the sidebar quota summary on non-chat routes so browse pages no longer
  auto-refresh chat usage state.
- Moved token-detail hydration back into `TokenDetailPage` so missing pool
  metadata is fetched once by the parent route.
- Made `GeckoTerminalChart` passive: it now renders only the parent-provided
  pool address and loading state.

## Target Behavior

- Token browse pages should not inherit chat quota refresh traffic.
- Token detail pages should keep one owner for data hydration.
- Child embeds should render resolved data instead of re-fetching it.

## Files Corrected

- `kiko-web/src/components/Layout/Layout.tsx`
- `kiko-web/src/components/Layout/Sidebar.tsx`
- `kiko-web/src/layouts/RootLayout.tsx`
- `kiko-web/src/pages/TokenDetailPage.tsx`
- `kiko-web/src/components/Chart/GeckoTerminalChart.tsx`

## Verification

- Verified in code.
- `kiko-web/src/services/api.ts` still dedupes and caches token reads, so the
  new layout only removes extra callers instead of changing cache semantics.

## See Also

- `system-journal/INDEX.md`
- `system-journal/design-language/loading-resilience.md`
- `system-journal/owner-map/chat-usage-quota.md`
- `system-journal/owner-map/frontend-data-loading.md`
- `system-journal/fix-log/2026-04-10-token-page-stray-read-rate-limit.md`
- `system-journal/fix-log/2026-04-10-navigation-burst-read-throttle.md`

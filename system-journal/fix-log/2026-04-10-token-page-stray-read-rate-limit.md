# 2026-04-10 Token Page Stray Read Rate Limit

## Problem

Opening the token page on mobile could surface multiple unrelated 429s in the
same window:

- `/api/billing/usage-summary`
- `/api/users/settings`
- `/api/polymarket/copy/configs`
- `/api/tokens/trending/all`

That made the token page feel unreliable even when only one page was actively in view.

## Root Cause

The rate-limit symptoms were coming from different frontend owners at once:

- Sidebar was reading billing usage even when the mobile sidebar was hidden.
- Chat-related surfaces were re-reading `/api/users/settings` on separate mounts
  without a shared cache.
- Shared read plumbing had no short cooldown after a 429, so remount churn could
  immediately retry the same throttled read.
- The aggregate token feed cache window was short enough that ordinary route
  churn could still re-hit the backend sooner than necessary.

## Fix

- Gated sidebar usage-summary reads on actual sidebar visibility.
- Added shared in-memory cache and in-flight dedupe for `/api/users/settings`.
- Added a short read-side 429 cooldown in the shared API layer.
- Extended `/api/tokens/trending/all` cache reuse in the shared API layer.

## Guardrail

A page entering view must not trigger authenticated reads for hidden UI chrome,
and a 429 must not immediately cause the same owner chain to hammer the same
endpoint again.

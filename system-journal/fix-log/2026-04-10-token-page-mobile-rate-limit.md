# 2026-04-10 Token Page Mobile Rate Limit

## Problem

Opening the site on mobile and navigating into the token page could immediately
trip rate limits on `/api/tokens/trending/all`, even during normal user
navigation.

## Root Cause

The token page owner layer in `kiko-web/src/pages/TokensPage.tsx` still relied
on a module-only cache. That cache disappeared on full reload, which is common
on mobile. The page also treated a cached render as a reason to schedule
another aggregate trending read almost immediately.

This produced a bad interaction pattern:

1. Mobile user reopened the site, losing the module cache.
2. Entering the token page triggered a fresh aggregate trending request.
3. Returning to the page or reopening the site repeated the same read without a
   durable snapshot to absorb the navigation churn.

## Fix

- Added a persistent token-page snapshot in `localStorage`.
- Increased token-page snapshot freshness so normal revisits reuse the last
  successful aggregate payload instead of reloading immediately.
- Added page-level in-flight dedupe for aggregate token loads.
- Removed the automatic "cached page then refresh again in 500ms" behavior.
- Deferred favorites loading until the user actually opens the favorites tab.

## Guardrail

The token page should prefer stale-but-present data over immediate re-fetches
when the user is simply navigating back to the page. Freshness can recover in
polling or manual retry paths, but mobile route churn must not behave like a
hard refresh storm.

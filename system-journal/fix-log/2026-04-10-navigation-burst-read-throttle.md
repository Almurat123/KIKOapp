# 2026-04-10 Navigation Burst Read Throttle

## Problem

Quick navigation between wallet, trade, tokens, and chat-adjacent screens could
reissue the same authenticated reads within seconds. Users saw throttling and
follow-on failures after opening a few pages and coming back.

## Root Cause

- `useStrategies()` refetched copy-trade configs, positions, and Polymarket copy
  configs on every remount with no hook-level snapshot reuse.
- `walletApi.ts` used raw fetches for wallet reads, so route switches did not
  share in-flight requests or a short-lived balance snapshot.
- `billingApi.ts` usage summary was refreshed on focus/visibility and always hit
  the network.
- `/api/tokens/trending/all` only had a 3-second client cache window, which was
  too short for normal route churn.

## Fix

- Added a shared 15-second snapshot and in-flight dedupe for `useStrategies()`.
- Added short-lived in-memory cache and request sharing for wallet balance,
  all-balances, and transactions reads.
- Added usage-summary cache and in-flight dedupe for sidebar billing reads.
- Increased the client cache window for `/api/tokens/trending/all` to absorb
  remount churn without visibly staling the list.

## Guardrail

If a screen can remount during ordinary navigation, its read path must reuse a
recent snapshot or an existing in-flight request. Do not assume route switches
are rare enough to justify unconditional refetches.

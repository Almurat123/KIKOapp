# Fix Log: X Auth Rate Limit Bypass

Updated: 2026-04-09

## Problem

The operator-only X bot authorization flow was passing through the same global
API rate limiter as normal product traffic. During active sessions, unrelated
read endpoints could exhaust the per-user or per-IP bucket and block
`/api/auth/x/start` with `429 Too Many Requests`.

## Root Cause

1. The global `onRequest` limiter ran before route-level auth and had no special
   case for privileged bootstrap routes.
2. X bot authorization is a one-time operator action, not high-volume end-user
   traffic, so it did not belong in the generic request bucket.

## Target Behavior

- `GET /api/auth/x/start`
- `GET /api/auth/x/callback`

must bypass the generic rate limiter so the official-account authorization flow
can complete deterministically even when the rest of the app is busy.

## Files Corrected

- `kiko-api/src/middleware/rateLimiter.ts`

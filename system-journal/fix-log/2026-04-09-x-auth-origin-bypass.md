# Fix Log: X Auth Origin Bypass

Updated: 2026-04-09

## Problem

The X OAuth callback was reaching the API correctly, but the global bootstrap
security preHandler rejected it with `ORIGIN_NOT_ALLOWED` before the callback
route could consume the code and state.

## Root Cause

1. `/api/auth/x/start` and `/api/auth/x/callback` were still passing through the
   generic origin + app-key gate in `index.ts`.
2. X redirects do not come from `kikoapp.app`, so the callback's `Referer` /
   `Origin` could not satisfy the first-party browser restrictions.
3. These routes already have stronger route-specific protections:
   authenticated operator allowlist on `/start`, and PKCE/state validation on
   `/callback`.

## Target Behavior

- `/api/auth/x/start` should bypass the generic origin/app-key gate and rely on
  its end-user auth allowlist.
- `/api/auth/x/callback` should bypass the generic origin/app-key gate and rely
  on PKCE/state validation.
- The rest of the API should continue using the normal origin + app-key checks.

## Files Corrected

- `kiko-api/src/index.ts`

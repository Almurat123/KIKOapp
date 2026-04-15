# Fix Log: 2026-04-15 X OAuth Start CORS Repair

## What Changed

- Added a narrow CORS fallback for `/api/auth/x/*` routes in the API bootstrap.
- First-party browser calls from `https://kikoapp.app` and
  `https://www.kikoapp.app` now receive explicit auth-route CORS headers for:
  - `Authorization`
  - `Content-Type`
  - credentials
  - `GET`
  - `OPTIONS`
- `OPTIONS /api/auth/x/*` now returns `204` before normal auth handlers run.

## Why

The operator needed to reauthorize the official X bot after X rejected the stored
refresh token as invalid. Direct browser navigation to `/api/auth/x/start`
failed because the route requires an `Authorization: Bearer` header. Browser
console `fetch` with that header then failed CORS before the route could return
the JSON authorize URL.

The fix is intentionally narrow: only X auth repair routes get the fallback
headers. General API routes keep the existing origin/app-key enforcement.

## Product Rule

- Bot OAuth repair must be possible from the first-party KIKO web app without
  requiring raw token handling or unsafe URL-token workarounds.
- The CORS fallback must not be generalized to unrelated API endpoints.

## Document Provenance

- Source: browser runtime failure while calling
  `https://api.kikoapp.app/api/auth/x/start?json=1` from KIKO web console
- Kind: runtime observation
- Retrieved: 2026-04-15
- Applied To: adding `/api/auth/x/*` preflight and credentialed CORS fallback
- Verification: partially verified

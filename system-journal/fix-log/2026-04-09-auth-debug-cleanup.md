# Fix Log: Auth Debug Cleanup

Updated: 2026-04-09

## Problem

Temporary X / Privy browser debugging remained enabled in the frontend root and
token bridge after the auth flow was stabilized. That left noisy console output,
browser-wide fetch/XHR monkey patches, and a special StrictMode escape hatch in
normal development.

## Root Cause

1. Debug instrumentation added for one-time OAuth diagnosis was left attached to
   the regular frontend boot path.
2. `AuthTokenBridge` mixed normal token-provider ownership with browser-side
   tracing concerns.
3. `main.tsx` kept a dev-only StrictMode override after the underlying auth
   issue had been corrected.

## Target Behavior

- Normal frontend boot should use one predictable StrictMode path.
- Auth token bridging should stay silent unless a future owner explicitly adds a
  new diagnostics layer.
- Browser-wide auth instrumentation should not ship as part of the default app
  startup path.

## Files Corrected

- `kiko-web/src/components/AuthTokenBridge.tsx`
- `kiko-web/src/main.tsx`

## Removed

- `kiko-web/src/utils/authDebug.ts`
- `kiko-web/src/utils/fetchInterceptor.ts`

## Follow-up

If auth debugging is needed again, reintroduce it as an explicit opt-in tool
outside the normal boot path instead of a default side-effect import.

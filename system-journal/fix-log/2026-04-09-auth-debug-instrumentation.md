# Fix Log: Auth Debug Instrumentation

Updated: 2026-04-09

Status: Retired by `2026-04-09-auth-debug-cleanup.md`.

## Problem

X / Privy login failures were difficult to localize because browser evidence was
split across callback URL params, Privy state transitions, token bridge calls,
and network requests. Existing logs either hid the failing phase or risked
printing sensitive OAuth values.

## Root Cause

1. The browser had no single owner for auth diagnostics.
2. Fetch instrumentation existed only as a placeholder and did not record auth
   request timing or status.
3. Privy state transitions and `getAccessToken()` failures were invisible unless
   developers manually instrumented ad hoc logs.

## Target Behavior

- Local debugging should show whether OAuth returned to the app.
- Privy readiness and signed-in state changes should be visible from one place.
- Token fetches should log success/failure with JWT summaries, not raw tokens.
- Auth-related fetch and XHR requests should log URL summaries, status, and timing.

## Files Corrected

- `kiko-web/src/utils/authDebug.ts`
- `kiko-web/src/components/AuthTokenBridge.tsx`
- `kiko-web/src/utils/fetchInterceptor.ts`

## Follow-up

This instrumentation was intentionally removed from the default frontend boot
path once the X / Privy flow was stabilized. See
`2026-04-09-auth-debug-cleanup.md` for the cleanup decision.

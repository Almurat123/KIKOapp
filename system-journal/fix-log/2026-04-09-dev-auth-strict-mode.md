# Fix Log: Dev Auth StrictMode

Updated: 2026-04-09

Status: Retired by `2026-04-09-auth-debug-cleanup.md`.

## Problem

Local X / Privy OAuth debugging produced misleading failures because the auth
callback page mounted twice under React StrictMode. One-time callback side
effects such as code exchange were replayed, causing a follow-up invalid-code
path after the original failure.

## Root Cause

1. The frontend root always rendered under `React.StrictMode`, including OAuth
   callback returns.
2. Privy's callback/session bootstrap path includes one-time side effects, so a
   development-only double mount could replay `oauth/authenticate`.
3. Browser logs then showed a mixed `500` followed by `401`, obscuring the
   first real failure.

## Target Behavior

- Production should keep StrictMode-safe provider composition unchanged.
- Local auth callback debugging should be able to run through a single mount.
- OAuth callback repros should show one clean `oauth/authenticate` attempt.

## Files Corrected

- `kiko-web/src/main.tsx`

## Follow-up

The temporary StrictMode relaxation path was removed after the auth flow was
stabilized. See `2026-04-09-auth-debug-cleanup.md` for the current rule.

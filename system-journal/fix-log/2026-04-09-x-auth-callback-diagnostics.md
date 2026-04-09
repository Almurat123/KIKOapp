# Fix Log: X Auth Callback Diagnostics

Updated: 2026-04-09

## Problem

When the X OAuth callback failed, the API only returned `x_oauth_failed`, which
forced operators to inspect server logs to learn whether the failure came from
token exchange, user lookup, bot identity validation, or credential storage.

## Root Cause

1. The callback handler collapsed multiple failure modes into one generic 500.
2. Operators had no direct route-level visibility into the failing phase during
   live authorization attempts.

## Target Behavior

- Failed X OAuth callbacks should return a minimal diagnostic payload that names
  the failing stage and a truncated reason.
- Diagnostics must stay small and avoid exposing raw tokens or full payloads.

## Files Corrected

- `kiko-api/src/routes/xAuth.ts`

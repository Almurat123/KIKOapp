# Fix Log: X Auth Allowlist Diagnostics

Updated: 2026-04-09

## Problem

When `/api/auth/x/start` returned `403`, operators could not tell whether the
running API instance had loaded the expected Privy DID allowlist or whether the
caller identity itself was mismatched.

## Root Cause

1. The route returned a generic authorization error without any instance-level
   diagnosis.
2. Deployment issues such as stale env vars or wrong service instances were
   indistinguishable from a true caller mismatch.

## Target Behavior

- Authenticated callers rejected by the X bot allowlist should receive a minimal
  redacted diagnostic payload.
- The payload must reveal the caller DID fingerprint and the loaded allowlist
  count/samples without exposing full identifiers.
- If two DIDs look identical after redaction, the payload must still expose
  enough length/fingerprint detail to detect hidden-character mismatches.

## Files Corrected

- `kiko-api/src/routes/xAuth.ts`

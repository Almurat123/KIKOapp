# Fix Log: 2026-04-10 X OAuth2 Refresh Runtime

## What changed

- Updated `/Users/almurat/KiKo/kiko-api/src/services/x/xCredentialsService.ts`
  to refresh the stored OAuth2 bot bearer token with the saved refresh token.
- Updated `/Users/almurat/KiKo/kiko-api/src/services/x/xApiClient.ts`
  to refresh on demand before outbound requests and retry once after a `401`.

## Why

The official X bot OAuth2 access token was expiring in production while DM and
reply delivery still depended on the stale cached bearer token. The runtime had
the refresh token but never used it, so outbound X writes failed with
`401 Unauthorized`.

## Runtime boundary

- OAuth2 refresh belongs to the credential owner layer.
- X outbound callers should not own token lifecycle or refresh decisions.
- Outbound requests may retry once after a refresh, but no caller should loop.

## What must not be casually changed

- Do not bypass the shared credential service and inject ad hoc bearer tokens
  into X reply/DM flows.
- Do not add multi-retry loops in outbound X callers.
- Do not persist refreshed OAuth2 tokens without updating `expiresAt`.

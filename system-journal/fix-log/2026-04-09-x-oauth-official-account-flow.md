# Fix Log: X OAuth Official Account Flow

Updated: 2026-04-09

## Problem

KIKO needed a way to authorize the official X account once and then reuse that
identity for mentions, DMs, webhook handling, and outbound bot replies without
binding the runtime to a developer personal account.

## Root Cause

1. The previous X runtime path had no first-class OAuth2 callback route for the
   official bot account.
2. Bot credentials were not persisted as a dedicated owner-layer record.
3. Startup and runtime code had to guess whether to use env credentials or a
   cached bot identity, which made the bot account flow brittle.

## Target Behavior

- The KIKO official X account should authorize the existing app through a
  standard OAuth2 PKCE flow.
- The callback should exchange `code` for bot tokens and persist the official
  bot identity safely.
- Runtime X workers should resolve credentials from the shared credential
  service instead of hard-coding a personal account.
- Webhook ingress should continue to treat the official bot identity as the
  source of truth for inbound filtering.

## Files Corrected

- `kiko-api/src/routes/xAuth.ts`
- `kiko-api/src/services/x/xCredentialsService.ts`
- `kiko-api/src/services/x/xApiClient.ts`
- `kiko-api/src/services/x/xIngressWorker.ts`
- `kiko-api/src/routes/xWebhook.ts`
- `kiko-api/src/index.ts`
- `kiko-api/src/config/env.ts`
- `kiko-api/prisma/schema.prisma`
- `kiko-api/prisma/migrations/20260409104000_add_x_oauth_credentials/migration.sql`

## Follow-up

The official account flow now has a dedicated auth start endpoint and callback
path, plus a persisted credential table for the bot identity. The remaining
manual step is to authorize the KIKO official X account against the existing
app and then confirm the returned `X_BOT_USER_ID` and token storage.

## Security Hardening

- `/api/auth/x/start` is no longer safe as a generic end-user endpoint. It must
  be restricted to an explicit Privy DID allowlist for the operator who is
  allowed to bind the official X bot account.
- OAuth callback completion must be tied to the same browser that initiated the
  flow, not just the `state` value alone.
- Bot access tokens must not be stored in plaintext; production must provide a
  valid `ENCRYPTION_KEY`, and callback storage should fail closed otherwise.
- `/api/users/x/sync` must not trust client-supplied `xUserId` or `username`.
  User X linkage must be resolved from Privy's server-side linked account data,
  otherwise an attacker can claim another person's X identity inside KIKO.
- Structured and file-based logging must redact tokens, secrets, cookies, and
  auth headers by default so Railway/runtime logs do not become a credential
  exfiltration path.
- Docker builds for `kiko-api` must exclude `.env` and related secret files from
  the build context; `.gitignore` alone is not sufficient.

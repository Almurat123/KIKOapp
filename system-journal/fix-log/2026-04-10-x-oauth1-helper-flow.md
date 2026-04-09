# Fix Log: 2026-04-10 X OAuth1 Helper Flow

## What changed

- Added OAuth1 helper routes to `/Users/almurat/KiKo/kiko-api/src/routes/xAuth.ts`:
  - `GET /api/auth/x/oauth1/start`
  - `GET /api/auth/x/oauth1/callback`
- Extended `/Users/almurat/KiKo/kiko-api/prisma/schema.prisma` and
  `/Users/almurat/KiKo/kiko-api/src/db/schema.sql` to store:
  - `oauth1_access_token`
  - `oauth1_access_token_secret`
  - `oauth1_authorized_at`
- Added migration:
  - `/Users/almurat/KiKo/kiko-api/prisma/migrations/20260410013000_add_x_oauth1_credentials/migration.sql`
- Updated `/Users/almurat/KiKo/kiko-api/src/services/x/xCredentialsService.ts`
  to persist and load OAuth1 bot credentials.
- Updated `/Users/almurat/KiKo/kiko-api/src/scripts/manageXWebhook.ts`
  to prefer stored OAuth1 credentials for `subscriptions/all`.

## Why

The existing OAuth2 PKCE flow was enough for bot DM/reply activity but not for
Account Activity subscription setup. X requires OAuth 1.0a user context for the
subscribed account. The previous operator path incorrectly implied that the
developer-console token generator could produce another account's OAuth1 token.
That was wrong.

## Flow boundary

- OAuth2 PKCE remains the bot runtime path for bearer-token actions.
- OAuth1 3-legged now exists only to obtain the official bot account's
  OAuth1 access token + secret for webhook subscription setup.

## What must not be casually changed

- Do not assume the developer console's generated OAuth1 token can represent an
  arbitrary target account.
- Do not route `subscriptions/all` through OAuth2 bearer auth.
- Do not store OAuth1 credentials without encryption.

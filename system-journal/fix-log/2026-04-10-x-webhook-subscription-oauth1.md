# Fix Log: 2026-04-10 X Webhook Subscription OAuth1

## What changed

- Updated `/Users/almurat/KiKo/kiko-api/src/scripts/manageXWebhook.ts` so
  webhook creation still uses app bearer auth, but Account Activity subscription
  creation/checking now uses OAuth 1.0a user context.
- Added required env documentation:
  - `X_CONSUMER_KEY`
  - `X_OAUTH1_ACCESS_TOKEN`
  - `X_OAUTH1_ACCESS_TOKEN_SECRET`

## Why

The X Account Activity API does not allow `subscriptions/all` to be created with
OAuth2 bearer auth. Official docs require OAuth 1.0a 3-legged user context for
the user being subscribed. Using the stored OAuth2 bot bearer token will always
fail with `401 Unauthorized`.

## What must not be casually changed

- Do not switch `subscriptions/all` back to bearer auth.
- Do not use personal-account OAuth1 access tokens if the bot account being
  subscribed is the official project account.

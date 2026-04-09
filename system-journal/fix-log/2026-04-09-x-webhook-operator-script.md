# Fix Log: 2026-04-09 X Webhook Operator Script

## What changed

- Added `/Users/almurat/KiKo/kiko-api/src/scripts/manageXWebhook.ts`.
- Added npm scripts:
  - `npm run x:webhook:ensure`
  - `npm run x:webhook:list`
- Added `X_WEBHOOK_CALLBACK_URL` to `/Users/almurat/KiKo/kiko-api/env.example`.

## Why

The repository already had the inbound X webhook receiver, but not the operator
path to create the webhook on X and attach the official bot subscription.
Without that second layer, the code could compile and deploy while still
receiving zero mention or DM events.

## Operator contract

- Webhook registration uses `X_APP_BEARER_TOKEN`.
- Bot subscription uses the official bot bearer token already stored in
  `x_oauth_credentials` after the OAuth callback succeeds.
- The script reuses an existing webhook by callback URL instead of blindly
  creating duplicates.

## What must not be casually changed

- Do not switch webhook management to the bot bearer token. X webhook
  management and user subscription are separate authority boundaries.
- Do not assume webhook creation alone is enough. Account Activity delivery
  still needs a user subscription step.
- Do not move this into runtime server startup. Webhook registration is an
  operator action, not a per-boot side effect.

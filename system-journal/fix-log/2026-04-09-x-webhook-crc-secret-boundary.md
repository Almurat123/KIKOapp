# Fix Log: 2026-04-09 X Webhook CRC Secret Boundary

## What changed

- Removed the dangerous fallback from `X_WEBHOOK_SECRET` to `X_CLIENT_SECRET` in
  `/Users/almurat/KiKo/kiko-api/src/config/env.ts`.
- Clarified in `/Users/almurat/KiKo/kiko-api/env.example` that
  `X_WEBHOOK_SECRET` must be the X app API Secret / Consumer Secret, not the
  OAuth2 Client Secret.

## Why

X webhook CRC validation and webhook signature verification use the app-level
 API/consumer secret boundary. OAuth2 `Client Secret` belongs to the login flow.
 Treating them as interchangeable causes `Invalid response_token` failures
 during `POST /2/webhooks` registration even when the receiver URL is otherwise
 reachable.

## What must not be casually changed

- Do not restore a fallback from `X_WEBHOOK_SECRET` to `X_CLIENT_SECRET`.
- Do not collapse X OAuth secrets and webhook CRC secrets into one env just
  because they are both named “secret” in the X dashboard.

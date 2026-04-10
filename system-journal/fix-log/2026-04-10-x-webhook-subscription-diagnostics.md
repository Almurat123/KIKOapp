# Fix Log: 2026-04-10 X Webhook Subscription Diagnostics

## What changed

- Added `/Users/almurat/KiKo/kiko-api/src/scripts/diagnoseXWebhookSubscription.ts`
- Added npm script:
  - `npm run x:webhook:diagnose`

## Why

The operator path reached a point where webhook creation succeeded and OAuth1
credentials existed in storage, but `subscriptions/all` still returned `401`.
At that point, the right move was to inspect the exact stored OAuth1 identity,
check whether `/2/users/me` works with the same signature path, and compare that
against the webhook/subscription state.

## Output contract

The diagnostic script prints:

- matched webhook for the configured callback URL
- stored OAuth1/OAuth2 presence
- OAuth1 `/2/users/me` status/body
- OAuth1 `GET subscriptions/all` status/body
- app-bearer `GET subscriptions/all/list` status/body

## What must not be casually changed

- Do not mutate subscription state from this diagnostic script by default.
- Do not replace stored-credential diagnosis with copied shell tokens.

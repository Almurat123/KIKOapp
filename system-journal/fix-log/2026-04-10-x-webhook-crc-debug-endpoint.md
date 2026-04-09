# Fix Log: 2026-04-10 X Webhook CRC Debug Endpoint

## What changed

- Added `/api/auth/x/debug/webhook-crc` in
  `/Users/almurat/KiKo/kiko-api/src/routes/xAuth.ts`.

## Why

Webhook creation was blocked by repeated CRC mismatches with no trustworthy way
to confirm what the live server was actually using for `X_WEBHOOK_SECRET`.
Operator-safe fingerprint output is enough to validate the active secret
boundary without leaking the secret itself.

## Endpoint contract

- Requires end-user auth.
- Requires the caller to be in `X_BOT_AUTHORIZED_PRIVY_DIDS`.
- Returns:
  - whether `X_WEBHOOK_SECRET` is present
  - secret length
  - secret fingerprint
  - `response_token` for a supplied `crc_token`

## What must not be casually changed

- Do not return the raw webhook secret.
- Do not make this endpoint public.

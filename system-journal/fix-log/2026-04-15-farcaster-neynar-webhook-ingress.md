# Fix Log: 2026-04-15 Farcaster Neynar Webhook Ingress

## What Changed

- Added a dedicated Neynar webhook callback route at `/api/webhook/neynar`.
- Added Neynar webhook CRUD helpers plus an operator script to list, create, or
  update the callback registration by target URL.
- Added explicit `NEYNAR_WEBHOOK_SECRET`, `NEYNAR_WEBHOOK_CALLBACK_URL`, and
  `NEYNAR_WEBHOOK_NAME` env boundaries.
- Switched the Farcaster ingress worker to webhook-first mode when the Neynar
  webhook is enabled, leaving notification polling as the fallback only.

## Why

The paid Neynar plan was now available, and the previous polling-only ingress
was still spending read quota and depended on unstable public Hub behavior.
The webhook path is the cleaner operator-visible registration that should show
up in the Neynar developer portal.

## Product Rule

- If Neynar webhook ingress is enabled, the worker must not keep polling
  notifications in the background.
- The webhook route must reject unsigned or malformed deliveries.
- The webhook operator script must reuse the configured callback URL instead of
  creating duplicate registrations.

## Verification

- `npm run build` not yet rerun after the webhook ingress patch.
- No live Neynar webhook creation has been run from this local machine because
  the active shell does not expose a `NEYNAR_API_KEY`.

## Document Provenance

- Source: Neynar Documentation, Webhooks in Dashboard
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: target URL, cast.created mention/reply delivery, and callback
    setup guidance
  - Verification: verified in docs
- Source: Neynar Documentation, Programmatic Webhooks
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: webhook list/create/update endpoints
  - Verification: verified in docs
- Source: Neynar Documentation, Verify Webhooks with HMAC Signatures
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: X-Neynar-Signature validation details
  - Verification: verified in docs

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/conflicts.md


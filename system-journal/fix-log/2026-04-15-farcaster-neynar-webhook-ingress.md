# Fix Log: 2026-04-15 Farcaster Neynar Webhook Ingress

## What Changed

- Added a dedicated Neynar webhook callback route at `/api/webhook/neynar`.
- Added a safe pre-auth ingress marker plus explicit failure logs for disabled
  ingress, missing secret, bad signature, and invalid JSON so webhook delivery
  gaps are observable instead of silent.
- Added a server-level pre-routing tap in bootstrap for `/api/webhook/neynar`
  so delivery attempts still show up even when Fastify route matching fails or
  the request never reaches route-local logging.
- Hardened webhook normalization for reply-thread mentions so accepted
  deliveries can identify the bot through `mentioned_profiles`,
  `mentioned_fids`, or `mentions` instead of depending on one Neynar payload
  shape.
- Re-enabled notification polling as a low-frequency safety net even when the
  Neynar webhook is enabled, because runtime evidence showed the webhook can be
  configured and active while reply-thread mention deliveries still do not
  arrive.
- Added Neynar webhook CRUD helpers plus an operator script to list, create, or
  update the callback registration by target URL.
- Added an explicit `--api-key` override on the operator script so the online
  paid key can be used even when the local workspace `.env` contains a stale
  or limited key.
- Added a narrow `@botHandle` text-regex fallback to the `cast.created`
  subscription while keeping `mentioned_fids` and `parent_author_fids`, because
  production runtime evidence showed Neynar had indexed a real @kikoapp cast
  with `mentioned_profiles` but did not deliver it to the active
  `mentioned_fids` webhook.
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

- The webhook route must emit a safe ingress marker before auth so delivery
  failures can be distinguished from signature failures.
- Bootstrap must also emit a pre-routing request tap for `/api/webhook/neynar`
  because route-local diagnostics cannot explain 404 or method mismatch cases.
- Reply-thread `@bot` casts must be admitted when Neynar exposes the mentioned
  identity as profile objects, raw fid arrays, or mention objects.
- The subscription should keep `mentioned_fids` as the canonical mention
  filter, but also include `(?i)@botHandle\b` as a delivery fallback; the route
  must still perform fid-based admission so text-only false positives are ACKed
  but not enqueued.
- If Neynar webhook ingress is enabled, webhook deliveries remain preferred, but
  the worker must keep the env-driven polling fallback running to avoid total
  ingress loss when Neynar delivery is delayed or absent.
- The webhook route must reject unsigned or malformed deliveries.
- The webhook operator script must reuse the configured callback URL instead of
  creating duplicate registrations.

## Verification

- `npm run build` passed after the ingress diagnostics patch.
- `npx tsx --test src/services/farcaster-agent/neynarWebhookService.test.ts`
  passed after adding reply-thread mention payload compatibility.
- `npm run build` passed after adding reply-thread mention payload
  compatibility.
- Runtime log `/Users/almurat/Downloads/logs.1776249263537.json` showed
  `webhookEnabled=true` and no real Neynar ingress after repeated mention tests,
  while a manual unsigned POST reached the route and produced invalid-signature
  diagnostics.
- Neynar API lookup for `almurat` fid `877398` showed cast
  `0x329a207af24579e6854fd038af4276757651ea48` with text `@kikoapp hi`,
  parent `0x5908a8fe5d7f7d0d648bb92cb02db75425483a86`, and
  `mentioned_profiles: [{ fid: 1576616, username: "kikoapp" }]`.
- A locally generated webhook payload for the same cast, signed with the active
  Neynar webhook secret using HMAC-SHA512 hex, returned `200` from
  `https://api.kikoapp.app/api/webhook/neynar` with `accepted: 1`. This verifies
  the callback route, secret, raw-body signature check, normalization, and
  enqueue path for the exact cast shape.
- Neynar webhook list with the online paid key showed webhook
  `01KP87ZA871Y7PASQ67STDSZFK` active at
  `https://api.kikoapp.app/api/webhook/neynar` with `mentioned_fids` and
  `parent_author_fids` set to `1576616`.

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
- Source: Neynar OpenAPI `WebhookSubscriptionFiltersCast`
  - Kind: official API doc / local SDK generated types
  - Retrieved: 2026-04-15
  - Applied To: treating cast filters other than `exclude_author_fids` as OR
    and adding a text-regex fallback without removing mention/reply filters
  - Verification: verified in docs
- Source: Production signed replay of cast
  `0x329a207af24579e6854fd038af4276757651ea48`
  - Kind: runtime observation
  - Retrieved: 2026-04-15
  - Applied To: proving KIKO callback accepts correctly signed Neynar-shaped
    mention payloads
  - Verification: verified in runtime

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/conflicts.md

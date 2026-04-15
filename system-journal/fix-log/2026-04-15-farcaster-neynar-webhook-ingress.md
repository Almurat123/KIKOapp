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
- Corrected the operator-created `cast.created` subscription to match Neynar's
  official bot-mentions guide by configuring both `mentioned_fids` and
  `parent_author_fids` on the same webhook filter.
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
- The subscription should use Neynar's documented FID-based `OR` filters in the
  same `cast.created` object:
  - `mentioned_fids` for direct `@bot` mentions
  - `parent_author_fids` for replies to the bot
- The route must still perform fid-based admission on received payloads.
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
- Official doc re-check on 2026-04-15 confirmed that the bot-mentions webhook
  should combine `mentioned_fids` and `parent_author_fids` under the same
  `cast.created` filter using OR semantics. The local builder and test fixture
  were updated to match that documented contract. Runtime delivery with the
  corrected filter mix has not yet been re-verified.
- After confirming the Railway public networking domain
  `https://kiko-api-production.up.railway.app`, the live Neynar webhook target
  was moved off the Cloudflare-fronted custom domain and onto the Railway
  origin URL to isolate edge-proxy interference from Neynar delivery issues.
- Runtime log `/Users/almurat/Downloads/logs.1776249263537.json` showed
  `webhookEnabled=true` and no real Neynar ingress after repeated mention tests,
  while a manual unsigned POST reached the route and produced invalid-signature
  diagnostics.
- Neynar API lookup for `almurat` fid `877398` showed cast
  `0x329a207af24579e6854fd038af4276757651ea48` with text `@kikoapp hi`,
  parent `0x5908a8fe5d7f7d0d648bb92cb02db75425483a86`, and
  `mentioned_profiles: [{ fid: 1576616, username: "kikoapp" }]`.
- Runtime log `/Users/almurat/Downloads/logs.1776252088483.json` showed no
  webhook ingress for cast
  `0x5a3c65ab14bfa4332a393bc0db807e08c6474d3e`, while Neynar cast lookup for
  the same URL returned text `@kikoapp hi` and
  `mentioned_profiles: [{ fid: 1576616, username: "kikoapp" }]`. The cast was
  eventually handled by the polling fallback and replied via Neynar at
  `2026-04-15T11:20:32Z`, proving publication worked while webhook delivery did
  not.
- A locally generated webhook payload for the same cast, signed with the active
  Neynar webhook secret using HMAC-SHA512 hex, returned `200` from
  `https://api.kikoapp.app/api/webhook/neynar` with `accepted: 1`. This verifies
  the callback route, secret, raw-body signature check, normalization, and
  enqueue path for the exact cast shape.
- Neynar's official bot-mentions guide explicitly documents that
  `mentioned_fids` and `parent_author_fids` should be configured together on the
  same webhook when the bot must receive both direct mentions and replies.
- Neynar API `PUT /v2/farcaster/webhook/` returned `200` for webhook
  `01KP8NFS384Q137T2QXF1ZRJV3` after updating `target_url` to
  `https://kiko-api-production.up.railway.app/api/webhook/neynar` while keeping
  the bot filters unchanged.

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
- Source: Neynar Documentation, Listen for @bot Mentions
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: correcting the provider-side subscription back to
    `mentioned_fids` + `parent_author_fids`
  - Verification: verified in docs
- Source: Neynar Documentation, Verify Webhooks with HMAC Signatures
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: X-Neynar-Signature validation details
  - Verification: verified in docs
- Source: Railway networking screenshot showing public domain
  `kiko-api-production.up.railway.app`
  - Kind: runtime/operator observation
  - Retrieved: 2026-04-15
  - Applied To: moving the live webhook target off the Cloudflare custom domain
    to isolate delivery-path issues
  - Verification: verified in operator UI
- Source: Production signed replay of cast
  `0x329a207af24579e6854fd038af4276757651ea48`
  - Kind: runtime observation
  - Retrieved: 2026-04-15
  - Applied To: proving KIKO callback accepts correctly signed Neynar-shaped
    mention payloads
  - Verification: verified in runtime
- Source: Production log and Neynar lookup of cast
  `0x5a3c65ab14bfa4332a393bc0db807e08c6474d3e`
  - Kind: runtime observation
  - Retrieved: 2026-04-15
  - Applied To: identifying that delivery was still absent even when the cast
    clearly mentioned the bot
  - Verification: verified in runtime

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/conflicts.md

# Generated Image Billing

Updated: 2026-04-24

## Purpose

Generated-image billing is separate from chat token billing because image
generation has a stricter abuse surface: free allowances must be enforced on
the backend per authenticated user, unavailable model variants must fail
closed, and paid image generation must not start until the request is bound to
server-owned context and billing consent.

## Canonical Rules

1. Generated-image usage must be stored in a dedicated ledger, not
   `billing_usage_ledger`.
2. Free generated-image allowance is counted on the backend per authenticated
   user as a Cloudflare FLUX.2 Klein 4B daily request bucket, controlled by
   `CREDITS_DAILY_FREE_CLOUDFLARE_IMAGE_REQUESTS`.
3. Reservation rows in `reserved` or `completed` state count against the
   Cloudflare daily free bucket so concurrent requests cannot oversubscribe it.
4. Paid generated-image runs reserve credits before the provider call starts.
5. Only completed paid generated-image rows may capture reserved credits.
6. Paid image models do not receive free generated-image requests.

## Forbidden Local Patch Patterns

- Do not reuse chat `assistant_message_id` billing ids for generated images.
- Do not trust frontend local state or localStorage for image free counts.
- Do not allow a paid generated-image call to proceed before credits are
  reserved.
- Do not capture credits for reserved, failed, or cancelled image rows.
- Do not give GPT, Grok, or Runware image models free generated-image requests.
- Do not charge Cloudflare FLUX.2 Klein 4B; block it after the daily free
  bucket is exhausted.

## Current Product Policy

- `cloudflare-flux-2-klein-4b`: enabled through Cloudflare Workers AI, free for
  `CREDITS_DAILY_FREE_CLOUDFLARE_IMAGE_REQUESTS` requests per user per UTC day,
  then blocked until the next day.
- `gpt-image-1-mini`: enabled through OpenAI, credits-only from the first
  request.
- `gpt-image-2`: enabled through OpenRouter when configured, credits-only from
  the first request.
- `grok-imagine-image`: enabled through xAI, credits-only from the first
  request.
- `grok-imagine-image-pro`: enabled through xAI, credits-only from the first
  request.
- `runware-flux-2-klein-9b-kv`: enabled through Runware, credits-only from the
  first request at the low-cost image price.

## Document Provenance

- Source: xAI Grok Imagine Image model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: normal-mode model id and price field `$n200000000`
  - Verification: verified in docs
- Source: xAI Grok Imagine Image Pro model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: pro-mode model id and price field `$n700000000`
  - Verification: verified in docs
- Source: /Users/almurat/KiKo/kiko-api/src/config/env.ts
  - Kind: repo doc
  - Retrieved: 2026-04-24
  - Applied To: `CREDITS_DAILY_FREE_CLOUDFLARE_IMAGE_REQUESTS` parsing and
    default fallback
  - Verification: verified in code
- Source: /Users/almurat/KiKo/kiko-api/src/services/generatedImageBilling.ts
  - Kind: repo doc
  - Retrieved: 2026-04-24
  - Applied To: the Cloudflare-only daily free bucket and credits-only image
    billing
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-free-allowance-env-control.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md

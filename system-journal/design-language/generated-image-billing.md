# Generated Image Billing

Updated: 2026-04-18

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
   user and UTC day.
3. Reservation rows in `reserved` or `completed` state count against free-image
   allowance so concurrent requests cannot oversubscribe the quota.
4. Paid generated-image runs require active billing consent before the provider
   call starts.
5. Only completed paid generated-image rows may enter daily billing
   aggregation.
6. GPT image variants may stay visible in the UI while disabled in backend
   policy.
7. Grok Pro may stay visible in the UI while disabled in backend policy.

## Forbidden Local Patch Patterns

- Do not reuse chat `assistant_message_id` billing ids for generated images.
- Do not trust frontend local state or localStorage for image free counts.
- Do not allow a paid generated-image call to proceed before consent exists.
- Do not aggregate reserved or failed image rows into daily paid billing.
- Do not silently treat disabled image models as selectable just because the UI
  can render them.

## Current Product Policy

- `gpt-image-1.5`: visible, disabled, no free allowance, no generation route
  enabled yet.
- `grok-imagine-image`: enabled, first 2 output images per user per UTC day are
  free.
- `grok-imagine-image-pro`: visible, disabled.

## Document Provenance

- Source: OpenAI GPT Image 1.5 model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: recognizing `gpt-image-1.5` as the future OpenAI image model id
  - Verification: verified in docs
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
- Source: operator requirement on 2026-04-18
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: GPT disabled, Grok normal free allowance, Grok Pro disabled,
    and consent-required paid fallback
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md

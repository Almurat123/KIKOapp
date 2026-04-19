# 2026-04-18 Generated Image Billing And Gating

## What Changed

- Added a dedicated generated-image usage ledger and schema entries:
  - `generated_image_usage_ledger`
- Added `kiko-api/src/services/generatedImageBilling.ts` as the owner for:
  - generated-image model availability normalization
  - daily free-image allowance decisions
  - billing-consent-required paid fallback
  - reservation / complete / fail lifecycle helpers
- Updated billing aggregates so completed paid generated-image rows are charged
  through the same daily billing job as chat usage.
- Marked image-model availability in the frontend catalog:
  - `gpt-image-1.5` visible but disabled
  - `grok-imagine-image` normal selectable
  - `grok-imagine-image-pro` visible but disabled
- Hardened local model restore so disabled image variants cannot become the
  active selection via `localStorage`.

## Why

Generated-image usage has different abuse and billing semantics than chat.
Chat billing is deduped by assistant message id after an assistant response
exists. Image generation needs a reservation step before provider execution, and
that reservation must be tied to an authenticated user plus server-owned
request context so frontend state cannot mint extra free runs.

## Product Rule

- GPT image stays disabled for now and has no free allowance.
- Grok normal gets 2 free output images per user per UTC day.
- Grok Pro stays disabled.
- If a Grok normal request spills past remaining free allowance, billing consent
  is required before provider execution.
- Generated-image paid billing aggregates only from completed reservations.

## Verification

- Verified `generatedImageBilling.test.ts` for disabled GPT image, free Grok
  normal, consent-required paid spillover, and disabled Grok Pro.
- Verified in code that daily billing aggregates union chat usage ledger and
  completed paid generated-image reservations.
- Verified in code that frontend restore logic coerces disabled image variants
  to a selectable fallback.

## Document Provenance

- Source: OpenAI GPT Image 1.5 model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: `gpt-image-1.5` model id and temporary disabled policy
  - Verification: verified in docs
- Source: xAI Grok Imagine Image model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: `grok-imagine-image` model id and `$n200000000` per-image price field
  - Verification: verified in docs
- Source: xAI Grok Imagine Image Pro model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: `grok-imagine-image-pro` model id and `$n700000000` per-image price field
  - Verification: verified in docs
- Source: operator requirement on 2026-04-18
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: free normal allowance, disabled GPT/Pro, and consent-required paid fallback
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/services/generatedImageBilling.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: reservation and finalize owner boundary
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/owner-map/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md

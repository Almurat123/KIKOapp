# 2026-04-24 Low Cost Generated Image Models

## What Changed

- Added `cloudflare-flux-2-klein-4b` as an unmetered generated-image model.
- Added `runware-flux-2-klein-9b-kv` as a low-cost generated-image model.
- Wired Cloudflare Workers AI REST execution for `@cf/black-forest-labs/flux-2-klein-4b`.
- Wired Runware REST `imageInference` execution for `runware:400@6`.
- Exposed both models through web chat model selection and social `/image` commands.
- Added env example keys for Cloudflare Workers AI and Runware.

## Billing Policy

- `cloudflare-flux-2-klein-4b` is unmetered inside KiKo billing:
  - does not consume the shared lifetime generated-image free request pool
  - does not reserve or capture credits
  - records zero free images and zero billed images
- `runware-flux-2-klein-9b-kv` participates in the shared generated-image free request pool:
  - consumes one shared free request while the user still has free requests
  - charges credits after the free pool is exhausted
  - default provider cost is `0.00078 USD/image`
  - default credit charge is derived by the normal generated-image markup rule

## Why

The previous generated-image catalog had premium models and Grok options, but no
durable low-cost provider layer. Product policy now needs two separate cheap
paths: one genuinely free fallback that never touches user billing, and one
billable ultra-low-cost model that still obeys the existing free-request and
credits ledger rules.

## Behavior

- Web chat accepts both model ids for direct generated-image tasks.
- Social users can choose them with:
  - `/image cloudflare-flux-2-klein-4b`
  - `/image runware-flux-2-klein-9b-kv`
- Runware supports reference-image input through `seedImage`.
- Cloudflare reference-image input is intentionally not enabled in this
  integration yet; direct uploaded-image requests with that model fail closed
  instead of sending an undocumented request shape.

## Verification

- `npx tsx --test src/services/generatedImageBilling.test.ts src/services/creditBillingService.pricing.test.ts src/services/generatedImageProviders.test.ts src/services/socialSettingsCommandService.test.ts`
- `npx tsc --noEmit --pretty false` in `kiko-api`
- `npx tsc -b --pretty false` in `kiko-web`
- `git diff --check`

## See Also

- /Users/almurat/KiKo/kiko-api/src/services/generatedImageBilling.ts
- /Users/almurat/KiKo/kiko-api/src/services/generatedImageProviders.ts
- /Users/almurat/KiKo/kiko-api/src/config/creditPricingDefaults.ts
- /Users/almurat/KiKo/kiko-web/src/components/Chat/chatConstants.ts

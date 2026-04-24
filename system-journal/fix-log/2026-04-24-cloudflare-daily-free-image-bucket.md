# 2026-04-24 Cloudflare Daily Free Image Bucket

## Problem

The generated-image billing policy had drifted from the product direction:

- GPT Image, Grok Image, and Runware could consume a shared lifetime free image
  request pool.
- Cloudflare FLUX.2 Klein 4B was treated as unmetered and did not count toward
  any user-visible free bucket.

The desired policy is simpler: Cloudflare FLUX.2 Klein 4B is the only free
image model, limited to 3 free generations per user per UTC day by default.
All other image models require credits from the first request.

## Fix

- Replaced the shared lifetime image free pool with
  `CREDITS_DAILY_FREE_CLOUDFLARE_IMAGE_REQUESTS`.
- Made `cloudflare-flux-2-klein-4b` consume that daily free bucket and block
  with `DAILY_FREE_LIMIT_EXHAUSTED` after the bucket is used.
- Made GPT Image 1 Mini, GPT Image 2, Grok normal, Grok Pro, and Runware
  credits-only from the first request.
- Updated the credits summary to report Cloudflare 4B daily free usage.
- Updated the sidebar label from `Image Free` to `4B Free` to avoid implying
  every image model has free quota.

## Environment

Remove:

- `CREDITS_LIFETIME_IMAGE_FREE_REQUESTS`

Add:

- `CREDITS_DAILY_FREE_CLOUDFLARE_IMAGE_REQUESTS=3`

## Verification

- `npx tsx --test src/services/generatedImageBilling.test.ts src/services/creditBillingService.pricing.test.ts src/services/generatedImageProviders.test.ts src/services/socialSettingsCommandService.test.ts`
- `npx tsc --noEmit --pretty false`

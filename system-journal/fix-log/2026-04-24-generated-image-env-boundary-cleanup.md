# 2026-04-24 Generated Image Env Boundary Cleanup

## What Changed

- Removed the legacy `GENERATED_IMAGE_DAILY_FREE_OUTPUTS` boundary from the
  TypeScript env config and `env.example`.
- Kept generated-image free allowance under the credits runtime:
  `CREDITS_LIFETIME_IMAGE_FREE_REQUESTS`.
- Removed `OPENROUTER_GPT_IMAGE_1_MINI_MODEL` from the OpenRouter image
  adapter and `env.example`.
- Narrowed OpenRouter image execution to `gpt-image-2` only; `gpt-image-1-mini`
  remains on OpenAI.
- Updated generated-image billing docs from the older daily-free-output policy
  to the current shared lifetime free-request pool policy.

## Current Env Boundary

Required for the active generated-image catalog:

- `OPENAI_API_KEY`: prompt refinement and `gpt-image-1-mini`
- `OPENROUTER_API_KEY`: `gpt-image-2` via OpenRouter
- `XAI_API_KEY`: Grok Imagine normal/pro
- `CLOUDFLARE_WORKERS_AI_ACCOUNT_ID`: Cloudflare FLUX.2 Klein 4B
- `CLOUDFLARE_WORKERS_AI_API_TOKEN`: Cloudflare FLUX.2 Klein 4B
- `RUNWARE_API_KEY`: Runware FLUX.2 Klein 9B KV
- `CREDITS_LIFETIME_IMAGE_FREE_REQUESTS`: shared lifetime free generated-image
  request pool for billable image models

Optional generated-image env:

- `OPENROUTER_API_URL`
- `OPENROUTER_GPT_IMAGE_2_MODEL`
- `OPENROUTER_HTTP_REFERER`
- `OPENROUTER_TITLE`
- `GENERATED_IMAGE_PROVIDER_TIMEOUT_MS`
- `RUNWARE_API_URL`
- `RUNWARE_FLUX_2_KLEIN_9B_KV_MODEL`
- `CREDITS_IMAGE_PRICING_JSON`

No longer needed:

- `GENERATED_IMAGE_DAILY_FREE_OUTPUTS`
- `OPENROUTER_GPT_IMAGE_1_MINI_MODEL`

## Billing Policy

- Cloudflare FLUX.2 Klein 4B is unmetered and does not consume the shared free
  request pool.
- GPT Image 1 Mini, GPT Image 2, Grok Imagine, Grok Imagine Pro, and Runware
  FLUX.2 Klein 9B KV share `CREDITS_LIFETIME_IMAGE_FREE_REQUESTS`.
- After the shared free pool is exhausted, billable image models reserve and
  capture credits from `env.credits.imagePricing`.

## Verification

- `npx tsx --test src/services/generatedImageBilling.test.ts src/services/generatedImageProviders.test.ts src/services/socialSettingsCommandService.test.ts`
- `npx tsc --noEmit --pretty false` in `kiko-api`
- `git diff --check`


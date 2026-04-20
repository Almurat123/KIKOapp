# 2026-04-20 Generated Image Enabled Model Fallback

## What Changed

- Updated `/Users/almurat/KiKo/kiko-api/src/services/generatedImageBilling.ts`
  so generated-image preference normalization no longer returns disabled models.
- Added a shared `resolveAvailableGeneratedImagePreference(...)` helper that
  walks an ordered candidate list and returns the first enabled executable image
  model.
- Updated
  `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterChatBridge.ts`
  to use enabled-only fallback resolution for both saved generated-image
  preferences and chat-family-derived defaults.
- Updated
  `/Users/almurat/KiKo/kiko-api/src/skills/ImageGenerationSkill/tools/generateImageFromIntent.ts`
  so ordinary chat image generation follows the same enabled-only fallback
  policy.

## Why

Production logs showed Farcaster image requests were correctly being routed into
 generated-image execution, but the bridge still selected `gpt-image-1.5`.
 That model is currently disabled in the billing owner, so the task failed
 immediately with `MODEL_DISABLED`.

The bug was not in the model. The bug was that deterministic image-model
selection was looking at provider family and saved preference only, without
treating billing `enabled` state as a hard boundary.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776677976404.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: confirming that Farcaster generated-image routing had become
    correct but still selected disabled `gpt-image-1.5`
  - Verification: verified in runtime log and code
- Source: `/Users/almurat/KiKo/kiko-api/src/services/generatedImageBilling.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: making billing availability the owner for executable image-model
    fallback
  - Verification: verified in code and targeted tests

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npx tsc --noEmit`
- `cd /Users/almurat/KiKo/kiko-api && npm test -- src/services/generatedImageBilling.test.ts src/services/farcaster-agent/farcasterIngressWorker.test.ts src/skills/ImageGenerationSkill/tools/generateImageFromIntent.test.ts`

## Owner Boundaries

- `generatedImageBilling.ts` owns whether an image model is executable right
  now.
- `farcasterChatBridge.ts` and `generateImageFromIntent.ts` may express
  preference order, but they must never return a disabled image model to task
  execution.

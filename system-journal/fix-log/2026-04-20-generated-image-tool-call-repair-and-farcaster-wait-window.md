# 2026-04-20 Generated Image Tool-Call Repair And Farcaster Wait Window

## What Changed

- Added malformed tool-argument repair in:
  - `/Users/almurat/KiKo/kiko-python/generation/tool_call_repair.py`
  - `/Users/almurat/KiKo/kiko-python/generation/app.py`
- The generation SSE owner now repairs leading-comma JSON argument fragments
  before parsing and before empty-name tool-call inference.
- Added server-side `user_intent` synthesis from structured image fields in:
  - `/Users/almurat/KiKo/kiko-api/src/services/generatedImagePromptOptimizer.ts`
  - `/Users/almurat/KiKo/kiko-api/src/skills/ImageGenerationSkill/tools/generateImageFromIntent.ts`
- Extended the Farcaster assistant-reply wait window in:
  - `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterChatBridge.ts`

## Why

One production Farcaster image turn on NVIDIA-hosted `glm-5` showed three
linked failures:

1. the provider emitted a malformed image-tool argument fragment beginning with
   a leading comma and no braces
2. the image tool reached the server without `user_intent`, so prompt
   optimization failed before generated-image execution started
3. Farcaster publication timed out before that slow tool-first round finished,
   so a pending/fallback text reply could publish before the real result

The repair had to happen at both boundaries:

- Python generation SSE repair so malformed tool-call fragments become usable
  structured arguments
- TypeScript image-intent normalization so structured image fields can still
  execute even when `user_intent` is missing
- Farcaster wait-window extension so slow tool-first rounds do not publish
  premature fallback text

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776663333220.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: malformed image-tool argument repair, `user_intent`
    synthesis, and Farcaster wait-window extension
  - Verification: verified in runtime log, code, and targeted tests

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/generatedImagePromptOptimizer.test.ts src/skills/ImageGenerationSkill/tools/generateImageFromIntent.test.ts`
- `cd /Users/almurat/KiKo/kiko-python && python3 -m pytest tests/test_generation_tool_call_repair.py`

## Owner Boundaries

- `kiko-python/generation/app.py` owns provider-stream to SSE conversion and
  tool-call payload repair before emission.
- `kiko-api/src/services/generatedImagePromptOptimizer.ts` owns server-side
  normalization of image intent fields before provider prompting.
- `kiko-api/src/skills/ImageGenerationSkill/tools/generateImageFromIntent.ts`
  owns the same-turn handoff from tool call to generated-image execution.
- `kiko-api/src/services/farcaster-agent/farcasterChatBridge.ts` owns how long
  Farcaster waits for the shared chat worker before publishing a reply.

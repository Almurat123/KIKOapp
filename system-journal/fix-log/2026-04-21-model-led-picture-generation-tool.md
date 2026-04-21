# 2026-04-21 Model-Led Picture Generation Tool

## What Changed

- Removed Farcaster ingress regex routing that directly enqueued generated-image
  tasks from user wording.
- Farcaster mentions now always enter the ordinary agent task path; the model
  decides whether to call `generate_image_from_intent`.
- Kept English `picture` as an image-generation signal for skill/tool exposure,
  so the model can see the generated-image tool on concrete picture requests.
- Passed saved generated-image model and quality preferences through Farcaster
  tool context, so model-led image tool calls still honor the user's selected
  image provider.

## Why

Intent ownership belongs to the model, not the ingress regex. The backend should
provide context, tools, quota gates, and provider preferences, but it should not
decide that a natural-language Farcaster mention must become an image task before
the model has evaluated the turn.

## Invariants

- Farcaster ingress must not bypass the ordinary agent with regex-based image
  execution.
- Concrete image wording may expose the generated-image tool; exposure is not a
  forced tool call.
- Once the model calls `generate_image_from_intent`, the generated-image tool
  owns prompt optimization, safety, billing, and provider execution.
- Saved image model preferences must affect execution after the model chooses to
  generate.

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/skills/ImageGenerationSkill/tools/generateImageFromIntent.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/farcaster-agent/farcasterIngressWorker.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`

## Document Provenance

- Source: operator correction on 2026-04-21 that Farcaster image generation
  should be decided by the model
  - Kind: product instruction
  - Retrieved: 2026-04-21
  - Applied To: Farcaster mention routing and generated-image tool preference
    handoff
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-21-gpt-image-mini-free-allowance.md

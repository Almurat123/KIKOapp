# 2026-04-18 Chat V2 Model-Owned Image Generation Tool

## Summary

KiKo chat now allows the main chat model to decide when a user is explicitly
asking for a visual deliverable and to route that turn into transcript-native
generated-image execution without requiring the user to switch to a dedicated
image model first.

This change adds:

- an internal tool: `generate_image_from_intent`
- a server-owned prompt optimizer boundary
- a tool continuation contract for tool-owned terminal replies
- worker support for externally managed terminal turns
- frontend support for retagging an existing assistant placeholder as
  `generated-image` mid-turn

## Problem

Before this change, generated images were only available through the dedicated
`/generated-images` route and a user-selected image model path. Chat v2 could
not:

- let the main model decide to generate an image
- optimize the prompt first and then reuse the same transcript turn
- switch an already-created text assistant placeholder into a generated-image
  placeholder
- terminate a tool-managed image turn cleanly without triggering
  `EMPTY_ASSISTANT_RESPONSE`

## Decision

The model-visible contract stays intent-level, not provider-level.

The main model can now call `generate_image_from_intent` when the user is
explicitly asking for a new image/poster/cover/illustration/visual asset.

That tool:

1. rewrites the request into a structured image prompt spec
2. compiles a server-owned provider prompt
3. converts the current assistant row into `generated-image`
4. delegates execution to the existing generated-image task owner
5. returns a side-effect terminal continuation so orchestration ends without
   forcing a text answer

## Owner Boundaries

### Prompt optimizer

Owner:
- `kiko-api/src/services/generatedImagePromptOptimizer.ts`

Owns:
- structured image prompt normalization
- summary generation safe for chat history
- server-owned prompt controls and default negative constraints

Does not own:
- provider request shape
- moderation
- billing
- task execution

### Tool owner

Owner:
- `kiko-api/src/skills/ImageGenerationSkill/tools/generateImageFromIntent.ts`

Owns:
- tool schema exposed to chat v2
- same-turn assistant message conversion to `generated-image`
- handoff into the generated-image task owner

Does not own:
- provider adapters
- storage
- frontend rendering

### Generated-image task owner

Owner:
- `kiko-api/src/services/generatedImageChatTask.ts`

Change:
- now exposes an awaitable execution path so chat-v2 tools can reuse the same
  billing/safety/storage pipeline synchronously

### Orchestration / worker

Owners:
- `kiko-api/src/jobs/chat/toolExecutionEngine.ts`
- `kiko-api/src/jobs/chat/nodeOrchestrator.ts`
- `kiko-api/src/jobs/chat/chatV2TurnRunner.ts`
- `kiko-api/src/jobs/chatWorker.ts`

Change:
- added `complete_with_side_effect` continuation
- orchestration can terminate when a tool already handled the visible reply
- worker preserves externally managed task status instead of overwriting it as a
  successful text completion

### Frontend stream merge owner

Owner:
- `kiko-web/src/layouts/RootLayout.tsx`

Change:
- `message_start` can now retag an existing assistant message with new
  `type/data`, which is required when chat v2 upgrades a text placeholder into a
  generated-image placeholder mid-turn

## Verified Behavior

Verified in code:

- image-generation queries can expose `generate_image_from_intent`
- Chinese image-generation requests with modifiers between the action and asset
  noun, such as "做一张赛博朋克风的产品海报", still expose the image tool
- prompt-writing advice queries do not expose that tool by default
- tool execution can terminate a turn through `complete_with_side_effect`
- generated-image execution can now be awaited from the internal tool path
- existing assistant placeholders can be updated to `generated-image` on
  `message_start`

Not yet fully implemented:

- true image edit/reference-image execution
- provider-level aspect-ratio controls beyond the existing generated-image owner

## Document Provenance

- Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: tool contract, optimizer boundary, worker terminal-owner handoff
  - Verification: verified in code
- Source: targeted resolver test for Chinese image-generation routing
  - Kind: test evidence
  - Retrieved: 2026-04-18
  - Applied To: allowing Chinese style/use modifiers between image-generation verbs and visual-asset nouns
  - Verification: verified in targeted test
- Source: `system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: reusing the transcript-native generated-image task/message owner
  - Verification: verified in code

## See also

- [System Journal Index](../INDEX.md)
- [2026-04-18 Generated Image Chat Execution And UI](./2026-04-18-generated-image-chat-execution-and-ui.md)
- [Generated Image Safety](../design-language/generated-image-safety.md)
- [Generated Image Billing](../design-language/generated-image-billing.md)
- [Chat V2 Rewrite Plan](../adr/2026-04-17-chat-v2-rewrite-plan.md)

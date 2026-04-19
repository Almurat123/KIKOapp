# System Journal Conflicts

Updated: 2026-04-18

## Active Conflicts

### 2026-04-18 OpenAI GPT Image 1.5 streaming docs conflict

- Conflict:
  The OpenAI `gpt-image-1.5` model page currently says `Streaming: Not supported`,
  but the OpenAI Image generation guide and the `/v1/images/generations`
  OpenAPI spec both document `text/event-stream` responses with
  `image_generation.partial_image` and `image_generation.completed`.
- Current repo resolution:
  For the dedicated Images API owner, follow the Images guide plus endpoint
  OpenAPI spec, and treat the model page feature table as conflicting metadata
  rather than the operative contract for `/v1/images/generations`.
- Affected owners:
  - /Users/almurat/KiKo/kiko-api/src/services/generatedImageProviders.ts
  - /Users/almurat/KiKo/kiko-api/src/services/generatedImageChatTask.ts
  - /Users/almurat/KiKo/kiko-web/src/components/Chat/GeneratedImageMessage.tsx
- Retrieved: 2026-04-18
- Verification:
  verified in docs, not yet verified in production runtime

## Notes

Add an entry here only when code and long-lived journal guidance intentionally
diverge and the difference must remain visible until resolved.

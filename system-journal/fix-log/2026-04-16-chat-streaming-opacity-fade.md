# 2026-04-16 Chat Streaming Opacity Fade

## What Changed

- Switched assistant streaming bubbles away from per-chunk markdown parsing
  while a message is still `streaming`.
- Replaced the prior progressive reveal treatment with an opacity-only fade for
  newly appended streaming chunks.
- Kept full markdown and citation rendering for the completed assistant message.

## Why

The runtime pipeline was already forwarding text chunks immediately through the
backend websocket path, but the frontend bubble was still reparsing markdown on
every streaming update. The previous frontend-only reveal treatment also
changed the apparent chunk timing, which violated the requirement to preserve
streaming behavior and only restyle the arrival of new text.

## Product Rule

- Streaming assistant text should keep the existing chunk timing and insertion
  behavior.
- New streamed text may animate with opacity only.
- Markdown, citations, and heavier formatting belong to the completed render
  pass, not every intermediate streaming frame.
- Layout, spacing, line height, and text metrics must remain unchanged during
  the fade.

## Verification

- Verified in code that `ChatStreamBroker.pushText()` broadcasts visible text
  immediately before the throttled database persist path.
- Verified in code that `RootLayout` only batches websocket chunks to the next
  animation frame, so it was not intentionally buffering by sentence.
- Verified in code that `MessageBubble` now preserves chunk order and content
  while wrapping only newly appended suffixes in opacity-fade spans.

## Document Provenance

- Source: `kiko-api/src/jobs/chat/streamBroker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: confirming websocket text chunks are broadcast immediately
  - Verification: verified in code
- Source: `kiko-web/src/layouts/RootLayout.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: confirming frontend chunk batching only occurs at animation-frame granularity
  - Verification: verified in code
- Source: `kiko-web/src/components/Chat/MessageBubble.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: replacing progressive reveal with opacity-only chunk fade
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-runtime-plan-card-reasoning-separation.md
- /Users/almurat/KiKo/system-journal/conflicts.md

# 2026-04-18 Chat Streaming Markdown Restore

## What Changed

- Removed the frontend-only streaming fade path from
  `/Users/almurat/KiKo/kiko-web/src/components/Chat/MessageBubble.tsx`.
- Restored streaming assistant content and reasoning to the same
  `ReactMarkdown` and `CitationRenderer` path used by completed messages.
- Deleted the now-unused `.streamingChunk*` styles from
  `/Users/almurat/KiKo/kiko-web/src/components/Chat/Chat.module.css`.

## Why

The opacity-fade rollback target from 2026-04-16 still bypassed Markdown while
`message.status === 'streaming'`. That meant the visible assistant reply was
rendered as plain text spans during streaming, so newline handling, lists, code
blocks, and other Markdown structure no longer matched the original behavior.

## Product Rule

- Streaming assistant text must preserve the same Markdown and citation
  semantics as the completed assistant message.
- Frontend presentation must not replace streaming Markdown with plain-text
  chunk spans.
- If animation conflicts with formatting correctness, formatting correctness
  wins.

## Verification

- Verified in code that `MessageBubble` no longer branches to
  `useStreamingFadeSegments` during streaming.
- Verified in code that streaming reasoning uses `ReactMarkdown` directly.
- Verified in code that streaming assistant content uses `CitationRenderer`
  directly.
- Verified formatting with targeted Prettier on the touched files.
- Verified patch hygiene with `git diff --check` on the touched files.
- Targeted `npx eslint src/components/Chat/MessageBubble.tsx` still reports
  pre-existing file-level lint issues (`any` usage and `Date.now()` purity
  rules) that were not introduced by this rollback.

## Document Provenance

- Source: user report that streamed output was animating character-by-character
  and losing Markdown line breaks.
  - Kind: runtime observation
  - Retrieved: 2026-04-18
  - Applied To: removing the plain-text streaming animation path.
  - Verification: partially verified.
- Source: `git show 754ec8b6^:kiko-web/src/components/Chat/MessageBubble.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: restoring the pre-fade streaming Markdown render contract.
  - Verification: verified in code.
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/MessageBubble.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: confirming the fade path was bypassing Markdown during
    streaming.
  - Verification: verified in code.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-streaming-opacity-fade.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
- /Users/almurat/KiKo/system-journal/conflicts.md

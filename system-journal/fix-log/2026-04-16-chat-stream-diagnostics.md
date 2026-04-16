# 2026-04-16 Chat Stream Diagnostics

## Context

A local runtime test in `/Users/almurat/KiKo/test.txt` showed the GLM welcome
turn became fast after the direct assistant-intro fast path, but the visible
reply arrived as one block. Code inspection confirmed that fast path emitted the
entire deterministic response through one `broker.pushText(fullText)` call.

## Decision

Add full-chain streaming diagnostics and preserve visible streaming for direct
fast-path answers:

- `PythonGenerationClient` logs provider assistant/reasoning delta counts,
  lengths, forwarding decisions, and elapsed timing.
- `ChatStreamBroker` logs message start, content/reasoning chunks, suppressor
  tail emission, and message complete with per-message chunk counts.
- `ChatWebSocketService` logs session sequence numbers, payload sizes,
  connection counts, message ids, and chunk lengths.
- `chatWebSocket.ts` logs browser WebSocket receive timing and sequence ids.
- `RootLayout` logs chunk buffering and requestAnimationFrame flushes.
- `MessageBubble` logs render-layer segment counts and fresh segment counts.
- The direct assistant-intro fast path now splits deterministic copy into small
  chunks with a short delay so the browser can render incremental updates.
- Once the target assistant message exists in frontend state, `RootLayout`
  applies content/reasoning chunks immediately instead of waiting for a
  coalescing animation-frame flush.
- Streaming reasoning is shown inline while a response is still in progress,
  even after visible answer text has started.

## Clarification

`kimi-k2-5-instant` can still emit reasoning deltas during internal canonical
intent normalization. Those deltas belong to the hidden `:normalize` task, not
the user-visible assistant answer, so they should not be rendered as the public
assistant message.

## Diagnostic Gates

Backend diagnostics are enabled by default outside production. Production
requires `CHAT_STREAM_DEBUG=1` or `DEBUG_CHAT_STREAM=1`.

Frontend diagnostics are enabled by default in Vite development. Production can
enable them with `VITE_CHAT_STREAM_DEBUG=1`, `?chatStreamDebug=1`, or
`localStorage.setItem('kiko.chatStreamDebug', '1')`.

## Provenance

- Source: `/Users/almurat/KiKo/test.txt`
- Kind: runtime observation
- Retrieved: 2026-04-16
- Applied To: identifying the direct fast-path single-chunk behavior and adding
  backend/frontend stream diagnostics.
- Verification: verified in code; build/test verification is recorded in the
  task response.

## Owner Boundaries

- Backend provider delta parsing: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/pythonGenerationClient.ts`
- Backend broker emission: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/streamBroker.ts`
- Backend WebSocket delivery: `/Users/almurat/KiKo/kiko-api/src/services/chatWebSocket.ts`
- Frontend WebSocket receive: `/Users/almurat/KiKo/kiko-web/src/utils/chatWebSocket.ts`
- Frontend state merge: `/Users/almurat/KiKo/kiko-web/src/layouts/RootLayout.tsx`
- Frontend render: `/Users/almurat/KiKo/kiko-web/src/components/Chat/MessageBubble.tsx`

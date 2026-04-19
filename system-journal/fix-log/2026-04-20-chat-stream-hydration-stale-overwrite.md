# 2026-04-20 Chat Stream Hydration Stale Overwrite

## Context

`/Users/almurat/KiKo/test.txt` showed the backend emitted and broadcast a full
stream for assistant message `cmo60c9w1003fhdoyfzue1gza`: 121 content chunks and
`message_complete` with `contentLength=155`. The browser screenshot showed only
the first visible text segment, `可以`, until refresh. Refresh loaded the full
message from the database.

## Root Cause

The frontend had an in-flight `loadConversation()` during the stream. That
function captured local messages before `chatApi.getSession()` returned. While
the request was in flight, WebSocket chunks advanced the live assistant message.
When the stale hydration response returned, it merged using the old local
snapshot and overwrote the newer live message with a shorter same-id DB row.

`message_complete` does not include final assistant text; it only finalizes the
message status, usage, and citations. Therefore it cannot repair a message that
already has non-empty but truncated content.

## Decision

- Re-read the latest local conversation messages after `chatApi.getSession()`
  returns, not only before the request starts.
- When hydrating a same-id assistant row, preserve local text or reasoning if it
  is longer and has the DB text as its prefix.
- Keep the existing rich assistant-card preservation rules unchanged.

## Provenance

- Source: `/Users/almurat/KiKo/test.txt`
- Kind: runtime observation
- Retrieved: 2026-04-20
- Applied To: `kiko-web/src/hooks/useConversations.ts`
- Verification: verified in code; local typecheck result is recorded in the
  task response.

## Owner Boundaries

- Frontend hydration merge owner:
  `/Users/almurat/KiKo/kiko-web/src/hooks/useConversations.ts`
- Frontend WebSocket state owner:
  `/Users/almurat/KiKo/kiko-web/src/layouts/RootLayout.tsx`
- Backend stream emission owner:
  `/Users/almurat/KiKo/kiko-api/src/jobs/chat/streamBroker.ts`

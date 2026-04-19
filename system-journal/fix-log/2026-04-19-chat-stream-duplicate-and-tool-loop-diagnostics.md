# Fix Log: Chat Stream Duplicate And Tool Loop Diagnostics

Date: 2026-04-19
Author: Rowan

## Trigger

The operator reported that an Agent-mode Clanker deploy confirmation caused repeated assistant output and a long reasoning loop. Browser console evidence showed two `message_start` events for the same assistant message, repeated sync requests, repeated client actions, and a React Markdown DOM warning. Backend runtime logs for session `cmo5a4f1h03sjj5et046ndecy` confirmed the same assistant id received `message_start` at seq 2 from the chat route and again at seq 3 from `ChatStreamBroker`.

## Verified Runtime Evidence

- Session: `cmo5a4f1h03sjj5et046ndecy`
- First assistant message: `cmo5a4f3103spj5etgvtk39lj`
- Confirmation task: `cmo5acvwo05ecj5etns3eaqkd`
- Confirmation assistant message: `cmo5actx605e0j5et971i9xnr`
- Backend log showed `Chat route: task created`, then a route `message_start`, then `ChatStreamBroker: message_start broadcast` for the same assistant id.
- Confirmation task reached round 6. The trace summary showed round 5 called `deploy_clanker_token` with `ok:false`, so the deterministic receipt hook did not terminate the turn and the model opened another generation round before cancellation.
- Browser warning showed a block-level Markdown code renderer returning `<div>` inside a paragraph.

## Changes

- Text chat routes now broadcast only task status. `ChatStreamBroker` is the single text `message_start` owner.
- `ChatStreamBroker.start()` now suppresses accidental repeated starts from the same broker instance.
- Node orchestration logs each local tool execution result with safe metadata: ok/source/reason/error, result keys, receipt-field presence, and receipt-hook decision.
- Chat AI trace summaries now preserve failed tool result keys and receipt-field presence instead of only `ok:false`.
- Browser WebSocket diagnostics now include event ordinal and listener count; subscribe/unsubscribe are logged.
- `RootLayout` now records duplicate `message_start` events by session/message id before mutating conversation state.
- Markdown code rendering now treats inline code as inline when ReactMarkdown omits the `inline` flag and the code has no language/newline, avoiding `<div>` inside `<p>`.

## Ownership

- Backend text stream start ownership: `kiko-api/src/jobs/chat/streamBroker.ts`
- Request/task creation boundary: `kiko-api/src/routes/chat.ts`
- Tool execution round and receipt hook diagnostics: `kiko-api/src/jobs/chat/nodeOrchestrator.ts`
- Turn summary diagnostics: `kiko-api/src/jobs/chat/chatAiTraceLogger.ts`
- Browser WS receive boundary: `kiko-web/src/utils/chatWebSocket.ts`
- Browser conversation state merge boundary: `kiko-web/src/layouts/RootLayout.tsx`
- Markdown code rendering boundary: `kiko-web/src/components/Chat/MarkdownCode.tsx`

## Document Provenance

- Source: operator-provided browser console and screenshot for the local deploy-token test
- Kind: runtime observation
- Retrieved: 2026-04-19
- Applied To: duplicate stream-start diagnosis, receipt-hook logging, and Markdown nesting fix
- Verification: verified in local app.log and code

- Source: `/Users/almurat/KiKo/kiko-api/logs/app.log`
- Kind: runtime observation
- Retrieved: 2026-04-19
- Applied To: proving the duplicate `message_start` owner split and the round-5 failed deploy tool result
- Verification: verified in runtime log

## Non-Goals

- This entry does not change Clanker API semantics.
- This entry does not claim the deploy tool failure cause was fixed; it adds the missing structured evidence needed to see the exact result/error on the next run.
- This entry does not remove generated-image route `message_start`; generated-image preview rows still need route-level placeholder metadata.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md

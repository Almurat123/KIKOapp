# Fix Log: Chat Provider History Empty Message Sanitization

Date: 2026-04-19
Author: Rowan

## Trigger

The operator reported that sending a normal chat message failed immediately with `HTTP 400`. Runtime evidence in `/Users/almurat/Downloads/logs.1776601253007.json` showed the provider request reached the orchestration layer, then failed before any visible assistant output streamed.

## Verified Runtime Evidence

- Session: `cmo5qgoyv0wg7qzgywz2n4lrb`
- Task: `cmo5qgpra0wglqzgy01j1byc0`
- Model: `gpt-5.4-mini-2026-03-17`
- `PythonGenerationClient` opened the generation stream, then the first event was already `error`.
- `NodeOrchestrator: generation round failed` logged `error: "[HTTP_400] | HTTP 400"`.
- The logged `recentMessages` immediately before the failure included an `assistant` message with `contentLength: 0`, followed by the current `user` turn.

## Root Cause

`kiko-api/src/routes/chat.ts` creates the current-turn assistant placeholder row before the worker starts. `kiko-api/src/jobs/chat/nodePromptAssembler.ts` skipped the latest user message when rebuilding provider history, but it did not drop the same-turn empty assistant placeholder. That empty assistant row leaked into `providerReadyMessages` and was sent to GPT-5.4-class provider paths as a plain `assistant: ""` history entry.

## Changes

- `sanitizeProviderHistory()` now drops provider-history rows that have no replayable content:
  - empty assistant rows without tool calls or reasoning
  - empty user rows
  - empty tool rows without a bound `tool_call_id`
- Added a targeted test that preserves valid assistant tool-call history while removing empty placeholder rows.

## Ownership

- Provider-safe history replay owner: `kiko-api/src/jobs/chat/nodePromptAssembler.ts`
- Current-turn placeholder creation boundary: `kiko-api/src/routes/chat.ts`
- Failure logging boundary: `kiko-api/src/jobs/chat/nodeOrchestrator.ts`

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776601253007.json`
- Kind: runtime observation
- Retrieved: 2026-04-19
- Applied To: proving the provider request contained an empty assistant history row before the failing user turn
- Verification: verified in runtime log and code

- Source: `kiko-api/src/routes/chat.ts`
- Kind: repo doc
- Retrieved: 2026-04-19
- Applied To: confirming the route creates a same-turn empty assistant placeholder before worker execution
- Verification: verified in code

- Source: `kiko-api/src/jobs/chat/nodePromptAssembler.ts`
- Kind: repo doc
- Retrieved: 2026-04-19
- Applied To: confirming history rebuild skipped the latest user turn but did not strip the placeholder assistant row
- Verification: verified in code and targeted tests

## Non-Goals

- This fix does not change route-level placeholder creation.
- This fix does not claim every HTTP 400 has the same root cause; it closes the verified empty-history-message path.
- This fix does not replay historical image-only user turns; the provider history owner still treats replay as text/tool history only.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-model-led-tool-orchestration-default-enable.md

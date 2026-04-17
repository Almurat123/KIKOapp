# 2026-04-17 Chat AI Trace Logging

## What Changed

- Added `/Users/almurat/KiKo/kiko-api/src/jobs/chat/chatAiTraceLogger.ts`
  as the owner for one-line per-turn AI trace summaries.
- `runNodeOrchestration()` now records model rounds, context reads, business
  tools, provider-native tools, required-context enforcement, selected skills,
  context contract, final status, and failures into one structured log line.
- `runChatV2Turn()` now emits the same summary shape for pre-orchestrator
  terminal reply paths such as direct greeting fast path, direct trade follow-up,
  and fast swap coordinator handling.
- The log message is always searchable as:
  `ChatAITrace: turn summary`.

## Why

The operator wants to test directly on Railway instead of reproducing locally.
Railway logs need one compact record per AI reply showing what the model/runtime
used and decided. Scattered logs are hard to reconstruct, and raw prompt/body
logging would create privacy and security risk.

## Product Rule

- Emit one summary log per AI turn when possible.
- Log tool names, context names, status, counts, and routing metadata.
- Do not log raw prompts, assistant text, image URLs, wallet full text from tool
  args, or tool argument payloads.
- Logging is enabled by default and can be disabled with
  `CHAT_AI_TRACE_LOGS=false`.
- Railway operators can search `ChatAITrace: turn summary`.

## Verification

- Verified with targeted tests:
  `kiko-api/src/jobs/chat/chatAiTraceLogger.test.ts`
  `kiko-api/src/jobs/chat/nodeOrchestrator.searchPhase.test.ts`
  `kiko-api/src/jobs/chat/chatV2TurnRunner.test.ts`
- Test logs showed `ChatAITrace: turn summary` emitted for completed, terminal,
  and failed orchestration paths.

## Document Provenance

- Source: `/Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: observable chat v2 routing/context/tool decisions
  - Verification: inferred from plan and verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodeOrchestrator.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: orchestration-round telemetry and summary emission
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/chatV2TurnRunner.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: terminal pre-orchestrator trace summaries
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-context-contracts.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/conflicts.md

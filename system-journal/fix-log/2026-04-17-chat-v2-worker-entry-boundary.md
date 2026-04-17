# 2026-04-17 Chat V2 Worker Entry Boundary

## What Changed

- Added a dedicated `chatV2TurnRunner.ts` owner for the chat v2 turn pipeline.
- Moved v2 turn-time work out of `chatWorker.ts`, including:
  canonical normalization,
  normalization reasoning surfacing,
  skill/policy resolution handoff,
  direct trade follow-up execution,
  fast swap pre-generation execution,
  fast greeting shortcut,
  orchestration retries for stale provider continuation ids.
- Simplified `chatWorker.ts` so it now owns task lifecycle, broker completion,
  moderation, persistence handoff, and cleanup, while delegating turn execution
  to the dedicated runner.
- Kept `buildFastDirectAssistantResponse` available from `chatWorker.ts` via
  re-export so existing tests and callers do not need a simultaneous path
  update.

## Why

The rewrite plan said chat v2 should be a new runtime boundary, not more hidden
branches inside the old worker shell. Before this change, `chatWorker.ts`
owned both task lifecycle and the full v2 turn engine, which made future v2
work harder to reason about and kept the new architecture visually embedded in
legacy worker code.

## Product Rule

- Worker owns task lifecycle and terminal handling.
- Turn runner owns v2 per-turn execution logic.
- New v2 logic should land in the runner owner, not reopen the worker shell.
- Compatibility exports may remain temporarily when they reduce migration churn.

## Verification

- Verified in code that `chatWorker.ts` now delegates turn execution to
  `runChatV2Turn(...)`.
- Verified in code that `chatV2TurnRunner.ts` now owns normalization, direct
  follow-up branches, fast greeting bypass, and orchestration retry logic.
- Verified with targeted tests:
  `kiko-api/src/jobs/chatWorker.test.ts`
  `kiko-api/src/jobs/chat/contextReadTools.test.ts`
  `kiko-api/src/jobs/chat/nodePromptAssembler.test.ts`
  `kiko-api/src/jobs/chat/nodeSkillResolver.test.ts`
  `kiko-api/src/jobs/chat/nodeOrchestrator.searchPhase.test.ts`
  `kiko-api/src/jobs/chat/nodeOrchestrator.polymarket.test.ts`
  `kiko-api/src/jobs/chat/toolExecutionEngine.test.ts`
- Broader end-to-end runtime verification is still pending.

## Document Provenance

- Source: `/Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: separating worker lifecycle ownership from chat v2 turn execution ownership
  - Verification: inferred from plan and verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chatWorker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: worker lifecycle boundary after runner extraction
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/chatV2TurnRunner.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: new chat v2 turn execution owner
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-contract-scaffold.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/conflicts.md

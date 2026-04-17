# 2026-04-17 Chat Runtime Mode Switch

## What Changed

- Added an explicit `CHAT_RUNTIME_MODE` owner at
  `kiko-api/src/jobs/chat/chatRuntimeMode.ts`.
- Added `resolveChatRuntimeMode()` so the worker entry boundary now resolves a
  named runtime mode instead of silently assuming a single hard-coded chat
  path.
- Added `runChatTurnByRuntimeMode()` so `chatWorker.ts` now routes through a
  runtime-mode dispatcher before invoking the turn executor.
- Kept the default on `v2_primary`.
- Added an explicit temporary alias policy where compatibility spellings
  (`compat`, `legacy`, `v1_compat`, and similar) resolve to
  `compat_fallback`, but that mode currently logs and aliases to the v2 turn
  runner because the repository does not yet preserve a separate live v1 chat
  executor.

## Why

The rewrite plan called for migration safety and a named rollout switch. After
extracting the v2 turn runner, the remaining gap was the entry boundary:
`chatWorker` still implicitly assumed a single runtime. That made rollback
language exist only in ADR text, not in code.

## Product Rule

- Runtime mode selection must happen at the worker entry boundary.
- `v2_primary` is the default path.
- Compatibility mode must be explicit and observable.
- If compatibility mode is only an alias, that fact must be logged and
  documented rather than hidden behind silent branching.

## Verification

- Verified in code that `chatWorker.ts` now resolves a runtime mode before turn
  dispatch.
- Verified in code that `chatRuntimeMode.ts` owns runtime-mode parsing and
  dispatch.
- Verified with targeted tests:
  `kiko-api/src/jobs/chat/chatRuntimeMode.test.ts`
  `kiko-api/src/jobs/chat/chatV2TurnRunner.test.ts`
  `kiko-api/src/jobs/chat/chatWorker.test.ts`
- Broader end-to-end runtime verification is still pending.

## Document Provenance

- Source: `/Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: explicit runtime mode switch and rollout boundary
  - Verification: inferred from plan and verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/chatRuntimeMode.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: runtime mode parsing, alias policy, and dispatch
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chatWorker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: worker entry boundary dispatch through the runtime mode owner
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/conflicts.md

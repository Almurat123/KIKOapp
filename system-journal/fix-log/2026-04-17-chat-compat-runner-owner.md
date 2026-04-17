# 2026-04-17 Chat Compat Runner Owner

## What Changed

- Added a dedicated compatibility executor owner at
  `kiko-api/src/jobs/chat/chatCompatTurnRunner.ts`.
- Moved the temporary compat-to-v2 alias policy out of
  `chatRuntimeMode.ts` and into the compat runner owner.
- Changed `chatRuntimeMode.ts` so it now only decides which runner to call:
  `v2_primary` goes to the v2 runner, and `compat_fallback` goes to the compat
  runner.
- Added targeted tests for both the compat runner and the dispatcher boundary.

## Why

After introducing `CHAT_RUNTIME_MODE`, compatibility behavior still lived as an
inline alias inside the dispatcher. That kept the fallback path from having its
own owner and would have forced future compat work back into the dispatcher
file. The compat path now has a clear place to evolve without reopening the
worker or mode-resolution layer.

## Product Rule

- Runtime mode dispatcher chooses the runner.
- Compat runner owns compat execution policy.
- Temporary compat alias behavior must be explicit, logged, and easy to replace
  later.

## Verification

- Verified in code that `chatRuntimeMode.ts` now dispatches compat mode to
  `chatCompatTurnRunner.ts` instead of aliasing inline.
- Verified in code that `chatCompatTurnRunner.ts` currently delegates to the v2
  runner explicitly.
- Verified with targeted tests:
  `kiko-api/src/jobs/chat/chatRuntimeMode.test.ts`
  `kiko-api/src/jobs/chat/chatCompatTurnRunner.test.ts`

## Document Provenance

- Source: `/Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: clearer compatibility ownership during v2 migration
  - Verification: inferred from plan and verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/chatRuntimeMode.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: dispatch-only runtime mode owner
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/chatCompatTurnRunner.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: dedicated compat execution owner
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-runtime-mode-switch.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/conflicts.md

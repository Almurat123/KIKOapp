# 2026-04-17 Chat V2 User Settings Contract

## What Changed

- Added a dedicated shared owner
  `/Users/almurat/KiKo/kiko-api/src/jobs/chat/userSettingsContract.ts`
  to normalize model-visible `user_settings`.
- Changed `read_user_settings` to return one structured contract with:
  `execution_mode`, `execution_preferences`, `swap_defaults`,
  `safety_checks`, and `copy_trade`.
- Removed the extra inline `EXECUTION_MODE: ...` system-prompt prose from
  Node prompt assembly.
- Updated the Node/Python context catalog wording so `user_settings` is now
  described as `execution mode, swap defaults, and safety preferences`.
- Added architecture smoke coverage for bare greeting, lean chat, specialist
  token analysis, execution turns, and social image turns.

## Why

Chat v2 was still exposing user settings in a messy mixed format:

- catalog entry
- read tool payload
- extra system prose describing execution mode

That duplication made execution turns noisier and easier for the model to
misread. The product rule should be simpler: user settings reach the model
through one normalized contract, and prompt assembly should not restate the
same preference logic in another prose block.

## Product Rule

- `user_settings` must be model-visible as one structured contract.
- Execution preference semantics belong in the contract, not extra prompt prose.
- Prompt assembly may advertise how to read `user_settings`, but should not
  duplicate its meaning in a second hidden block.
- Smoke coverage must keep the main turn classes observable during the chat v2
  rewrite.

## Verification

- Verified in code that `userSettingsContract.ts` derives a single
  model-facing contract shape.
- Verified in code that `contextReadTools.ts` now returns the normalized
  contract for `read_user_settings`.
- Verified in code that `nodePromptAssembler.ts` no longer injects
  `EXECUTION_MODE: ...` prose into the system message.
- Verified in code that `kiko-python/chat_v2/prompt_orchestrator.py` now uses
  the same catalog wording and `read via ...` style.
- Added targeted tests:
  `kiko-api/src/jobs/chat/contextReadTools.test.ts`
  `kiko-api/src/jobs/chat/nodePromptAssembler.test.ts`
  `kiko-api/src/jobs/chat/chatV2ArchitectureSmoke.test.ts`
- Full runtime verification still depends on local test execution.

## Document Provenance

- Source: `/Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: keeping task context contract-based and on-demand
  - Verification: inferred from plan and verified in code
- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: identifying noisy mixed-format prompt exposure
  - Verification: verified against runtime transcript and code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodePromptAssembler.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: removing inline execution-mode prose
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/contextReadTools.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: normalized `read_user_settings` payload
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-lean-chat-context-exposure.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/conflicts.md

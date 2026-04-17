# 2026-04-17 Chat V2 Context Contract Scaffold

## What Changed

- Added a shared `ChatContextContract` type to the Node chat runtime contracts
  so orchestration layers can name the required and optional context slices for
  each turn.
- Taught `nodeSkillResolver` to emit a task-scoped context contract alongside
  the selected skill/tools and intent envelope.
- Updated `nodePromptAssembler` to render a `[CONTEXT_CATALOG]` plus
  `[CONTEXT_CONTRACT]` block and to only emit the task slices named by that
  contract.
- Wired `chatWorker` to persist the resolved context contract on the runtime
  snapshot before orchestration.
- Added the same contract shape to Python `chat_v2` schemas, prompt assembly,
  and worker shaping so the Python side can stay aligned with the Node contract.
- Suppressed Python generic `[CONTEXT]` expansion on lean turns when the
  contract has no required slices.

## Why

The previous architecture still made every turn carry a large, pre-injected
context blob. That was exactly the problem the rewrite plan is meant to solve:
ordinary questions should stay lean, while trading, social, and analysis turns
should explicitly opt into only the slices they need.

## Product Rule

- Ordinary direct answers should not inherit wallet, token, launchpad, or
  workflow context unless the turn requires it.
- The model should see a context catalog and a required-context contract, not a
  silent dump of every cached block.
- Contract-driven context exposure is the default shape for chat v2.

## Verification

- Verified in code and tests that Node now carries a `contextContract`
  through skill resolution, orchestration, and prompt assembly.
- Verified in code that Python chat_v2 now receives and echoes the same
  contract shape.
- Verified with `py_compile` that the Python worker and prompt modules remain
  syntactically valid after the contract wiring.
- Runtime verification for the Python service side is still pending.

## Document Provenance

- Source: `/Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: context-contract scaffold and lean prompt boundary
  - Verification: inferred from code and plan
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodeSkillResolver.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: Node contract derivation
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodePromptAssembler.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: context catalog and contract rendering
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-python/chat_v2/prompt_orchestrator.py`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: Python lean-context filtering
  - Verification: inferred from code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-lean-chat-context-exposure.md
- /Users/almurat/KiKo/system-journal/conflicts.md

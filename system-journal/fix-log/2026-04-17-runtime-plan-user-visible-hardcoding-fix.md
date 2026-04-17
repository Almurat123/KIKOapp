# 2026-04-17 Runtime Plan User-Visible Hardcoding Fix

## What Changed

- Hid `agentRuntime.plan` cards from the normal chat transcript unless
  `VITE_KIKO_SHOW_AGENT_RUNTIME_PLAN=true` is set.
- Kept runtime plan snapshots persisted and streamed for debugging and internal
  orchestration state.
- Replaced model-visible execution-plan prose with structural runtime state:
  step ids, statuses, and tool hints only.
- Added test coverage that plan titles, summaries, step titles, and
  descriptions are not injected into the generation prompt.

## Why

Runtime transcripts showed fixed workflow labels such as "Gather relevant
evidence", "Understand the request", and first-person "I will..." summaries
appearing before normal answers. That text came from KiKo's runtime planning
surface, not from the LLM's actual final answer, and it also risked being
mirrored by the model because prompt assembly included plan prose.

## Product Rule

- Normal users see assistant content, reasoning, citations, and real rich
  execution cards only.
- Runtime plans are internal/debug state by default.
- Model prompts may receive runtime state, but not user-facing plan copy.

## Verification

- Verified in code that `MessageBubble` now gates runtime plan rendering behind
  `VITE_KIKO_SHOW_AGENT_RUNTIME_PLAN=true`.
- Verified in code that `nodePromptAssembler` emits
  `[INTERNAL_RUNTIME_PLAN_STATE]` without plan title/summary/description prose.
- Verified with targeted backend tests that plan prose no longer appears in the
  generation prompt.

## Document Provenance

- Source: operator runtime transcript showing plan-card labels rendered before
  final answers.
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: default-hidden runtime plan cards and structural prompt state.
  - Verification: verified in code and targeted tests.
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/MessageBubble.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: frontend display gate.
  - Verification: verified in code.
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodePromptAssembler.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: generation prompt contract.
  - Verification: verified in code and targeted tests.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/runtime-plan-visibility.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/conflicts.md

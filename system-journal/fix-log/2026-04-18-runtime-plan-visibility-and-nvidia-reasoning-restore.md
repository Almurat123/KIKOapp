# 2026-04-18 Runtime Plan Visibility And NVIDIA Reasoning Restore

## What Changed

- Restored visible `PlanCard` rendering in
  `/Users/almurat/KiKo/kiko-web/src/components/Chat/MessageBubble.tsx`
  whenever backend runtime state includes `agentRuntime.plan`.
- Restored assistant-history `reasoning_content` mapping and replay for NVIDIA
  thinking-capable GLM/Kimi aliases in
  `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodePromptAssembler.ts`.
- Kept `kimi-k2-5-instant` and other fast/instant aliases on the strip path so
  they do not replay stored reasoning traces.
- Replaced the old backend test expectation that `glm-5` strips
  `reasoning_content`, and added coverage that `kimi-k2-5-instant` still strips
  it.

## Why

Two regressions stacked together.

The visible `Plan card` disappeared because `MessageBubble` gated it behind
`VITE_KIKO_SHOW_AGENT_RUNTIME_PLAN=true`, so backend-generated plan state still
existed but the normal transcript refused to render it.

NVIDIA reasoning regressions came from two combined issues inside
`nodePromptAssembler`: `buildHistoryMessages(...)` failed to map stored
assistant reasoning into `GenerationMessage.reasoning_content`, and
`sanitizeProviderHistory(...)` then stripped NVIDIA GLM/Kimi thinking aliases
even though the active NVIDIA model docs describe GLM thinking output and Kimi
Thinking/Instant split explicitly. That made the history contract diverge from
the provider mode actually selected for `glm-5` and `kimi-k2-5-reasoning`.

## Product Rule

- Runtime plans are visible execution-progress cards in normal chat when the
  backend emits them.
- Runtime plans are not assistant answers and must not absorb assistant
  reasoning or final-answer ownership.
- NVIDIA thinking-capable GLM/Kimi aliases may replay stored
  `reasoning_content`.
- NVIDIA instant/fast aliases must continue to strip stored reasoning traces.

## Verification

- Verified in code that `MessageBubble` no longer gates runtime plan cards on
  `VITE_KIKO_SHOW_AGENT_RUNTIME_PLAN`.
- Verified in code that `buildHistoryMessages(...)` now maps stored assistant
  reasoning into `GenerationMessage.reasoning_content`.
- Verified in code that `sanitizeProviderHistory(...)` now preserves
  `reasoning_content` for `glm-5` and Kimi thinking aliases, while leaving
  instant aliases on the strip path.
- Verified with targeted tests that `glm-5` now replays stored
  `reasoning_content` and `kimi-k2-5-instant` does not.
- Not runtime-verified in browser against a live NVIDIA chat turn in this task.

## Document Provenance

- Source: NVIDIA NIM GLM-5 model card
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: preserving `reasoning_content` replay for `glm-5` history.
  - Verification: verified in docs and code.
- Source: NVIDIA NIM Kimi-K2.5 model card
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: distinguishing Kimi Thinking from Kimi Instant history replay.
  - Verification: verified in docs and code.
- Source: operator requirement in local runtime thread to restore visible plan
  cards in normal chat and recover NVIDIA reasoning visibility.
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: frontend plan-card visibility and backend reasoning-history policy.
  - Verification: verified in code.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/runtime-plan-visibility.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-runtime-plan-user-visible-hardcoding-fix.md
- /Users/almurat/KiKo/system-journal/conflicts.md

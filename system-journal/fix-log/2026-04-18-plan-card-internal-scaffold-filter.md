# 2026-04-18 Plan Card Internal Scaffold Normalization

## What Changed

- Added `PlanCard.visibility` as a non-authoritative hint.
- Marked warmup plans and ordinary direct-answer planner skeletons with an
  `internal` hint.
- Kept evidence, tool, and execution planner cards tagged `visible`.
- Preserved the hint through `ChatStreamBroker` plan merges.
- Restored frontend rendering so any persisted `agentRuntime.plan` still shows
  after refresh.
- Updated `MessageBubble` to normalize generic `step-understand` /
  `step-summary` copy before passing the card to `PlanCard`.

## Why

After restoring normal transcript plan cards, internal warmup labels such as
`理解请求`, `生成回答`, and `我会逐步查看信息并在拿到结果后继续。` became visible next
to ordinary assistant answers. The first fix hid internal cards, but that also
made refreshed persisted cards disappear. The corrected rule is to render the
card whenever backend plan state exists and normalize low-quality scaffold copy
instead of hiding the whole card.

## Product Rule

- Planner cards are visible whenever backend plan state exists.
- Warmup/direct-answer scaffolds remain runtime state, but generic wording is
  normalized before display.
- The assistant answer still owns normal Markdown text.

## Verification

- Verified in code that warmup plans are marked `internal`.
- Verified in code that evidence/execution planner skeletons are marked
  `visible`.
- Verified in code that frontend rendering no longer hides cards based on
  `visibility`.
- Verified in code that generic scaffold copy is normalized before rendering.
- Not runtime-verified in browser in this task.

## Document Provenance

- Source: operator runtime transcript showing warmup plan labels rendered as
  answer-adjacent copy.
  - Kind: runtime observation
  - Retrieved: 2026-04-18
  - Applied To: `PlanCard.visibility` hints, task-planner classification, and
    frontend scaffold normalization.
  - Verification: verified in code and targeted tests.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/runtime-plan-visibility.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-runtime-plan-visibility-and-nvidia-reasoning-restore.md

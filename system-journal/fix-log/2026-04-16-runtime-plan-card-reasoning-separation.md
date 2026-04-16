# 2026-04-16 Runtime Plan Card Reasoning Separation

## What Changed

- Removed live assistant reasoning from the inline runtime `PlanCard` surface.
- Restored assistant reasoning rendering in the normal message bubble even when a
  runtime plan card is present above it.
- Kept the runtime card focused on plan state, step progress, and tool activity
  instead of streaming raw reasoning text.

## Why

The chat UI was attaching `message.reasoning_content` to the same assistant
message that also carried the runtime plan snapshot. That made Kimi/GLM
reasoning appear inside the plan card while the final answer streamed below,
which looked like a split-render bug even though the model output itself was
correct.

## Product Rule

- Runtime plan cards show execution progress only.
- Assistant reasoning belongs to the assistant message surface, not the plan
  card.
- A runtime card must not suppress valid reasoning visibility for the same
  assistant turn.

## Verification

- Verified in runtime logs from `test.txt` that the `:plan` request and the main
  generation request both emitted `reasoning_delta`, while the assistant message
  still completed successfully.
- Verified in code that the frontend previously passed
  `message.reasoning_content` into `PlanCard`.
- Verified in code that the assistant reasoning bubble was gated off whenever a
  runtime card existed on the same message.

## Document Provenance

- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: identifying that reasoning streamed correctly but was rendered in the wrong surface
  - Verification: partially verified
- Source: `kiko-web/src/components/Chat/MessageBubble.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: moving reasoning ownership back to the assistant message surface
  - Verification: verified in code
- Source: `kiko-web/src/components/Chat/PlanCard.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: removing live reasoning rendering from the plan card
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
- /Users/almurat/KiKo/system-journal/conflicts.md

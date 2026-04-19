# Runtime Plan Visibility

Updated: 2026-04-18

## Purpose

Define how chat orchestration state may be shown in the transcript without
turning internal workflow labels into user-facing assistant replies or hiding
legitimate runtime progress from the product surface.

## Canonical Rules

1. The assistant answer is the normal message content, not the runtime plan
   card.
2. Runtime plan snapshots may be persisted and streamed, and the transcript may
   show them in normal chat when backend runtime state exists.
3. A visible runtime plan card is a separate execution-progress surface. It is
   not the assistant answer and must not replace normal content or reasoning.
4. Warmup and ordinary direct-answer scaffolds may be tagged internal, but that
   tag is not a frontend hide switch.
5. Visible plan cards require real work: evidence, tools, execution, or another
   non-trivial task-progress surface.
6. Model-visible runtime plan context must be structural: step ids, statuses,
   and tool hints only.
7. Do not feed plan titles, summaries, descriptions, or first-person planning
   copy into the model prompt.
8. Do not use plan-card text to compensate for missing assistant content. If
   content is missing, fix streaming/generation instead.

## Forbidden Local Patch Patterns

- Rendering `message.data.agentRuntime.plan` as a normal assistant response.
- Asking a model to generate user-facing plan-card copy for every turn and then
  showing it before the answer.
- Including phrases such as `I will gather`, `Understand the request`, or
  `Generate answer` in prompt context where the model can quote them back.
- Hiding hardcoded plan text only with CSS while keeping it in the accessible
  transcript surface.
- Gating normal runtime plan visibility behind a debug-only env flag when the
  product requirement is to show model-filled execution progress.
- Hiding persisted plan cards on refresh because a hint says `internal`.
- Rendering raw warmup-only steps such as `理解请求`, `生成回答`, or
  `Understand the request` without display normalization.

## Document Provenance

- Source: operator runtime transcript showing plan-card labels rendered before
  final answers.
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: keeping plan cards separate from assistant answer content and structural prompt state.
  - Verification: verified in code and targeted tests.
- Source: operator requirement in local runtime thread to restore visible plan
  cards in normal chat.
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: removing the debug-only runtime plan visibility gate.
  - Verification: verified in code.
- Source: operator runtime transcript showing warmup plan labels rendered as
  answer-adjacent copy.
  - Kind: runtime observation
  - Retrieved: 2026-04-18
  - Applied To: internal warmup plan hints and frontend scaffold normalization.
  - Verification: verified in code and targeted tests.
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/MessageBubble.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: transcript rendering ownership.
  - Verification: verified in code.
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodePromptAssembler.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: model-visible runtime plan context.
  - Verification: verified in code and targeted tests.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-runtime-plan-visibility-and-nvidia-reasoning-restore.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-plan-card-internal-scaffold-filter.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-runtime-plan-user-visible-hardcoding-fix.md

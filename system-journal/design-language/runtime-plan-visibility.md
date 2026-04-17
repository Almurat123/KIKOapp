# Runtime Plan Visibility

Updated: 2026-04-17

## Purpose

Define how chat orchestration state may be used without turning internal
workflow labels into user-facing assistant replies.

## Canonical Rules

1. The assistant answer is the normal message content, not the runtime plan
   card.
2. Runtime plan snapshots may be persisted and streamed for debugging, but the
   transcript must hide them by default.
3. A visible runtime plan card requires an explicit debug flag. It must never be
   the default product surface for normal chat.
4. Model-visible runtime plan context must be structural: step ids, statuses,
   and tool hints only.
5. Do not feed plan titles, summaries, descriptions, or first-person planning
   copy into the model prompt.
6. Do not use plan-card text to compensate for missing assistant content. If
   content is missing, fix streaming/generation instead.

## Forbidden Local Patch Patterns

- Rendering `message.data.agentRuntime.plan` as a normal assistant response.
- Asking a model to generate user-facing plan-card copy for every turn and then
  showing it before the answer.
- Including phrases such as `I will gather`, `Understand the request`, or
  `Generate answer` in prompt context where the model can quote them back.
- Hiding hardcoded plan text only with CSS while keeping it in the accessible
  transcript surface.

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
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-runtime-plan-user-visible-hardcoding-fix.md

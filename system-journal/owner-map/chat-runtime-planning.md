# Chat Runtime Planning Owner Map

Updated: 2026-04-17

## Owned Layers

- `kiko-api/src/jobs/chat/taskPlanner.ts`
- `kiko-api/src/jobs/chat/modelPlanGenerator.ts`
- `kiko-api/src/jobs/chat/streamBroker.ts`
- `kiko-api/src/jobs/chat/nodePromptAssembler.ts`
- `kiko-web/src/components/Chat/MessageBubble.tsx`
- `kiko-web/src/components/Chat/PlanCard.tsx`

## Ownership Boundaries

### Backend planner

Owns: internal step ids, statuses, tool hints, and persisted runtime snapshots.

Does not own: normal assistant answer text or transcript presentation.

### Prompt assembler

Owns: converting runtime state into model-safe structural context.

Does not own: user-visible plan titles, plan summaries, or card copy.

### Stream broker

Owns: updating runtime snapshots and tool/action state as the task executes.

Does not own: deciding whether a runtime card is visible in the product UI.

### Frontend message bubble

Owns: transcript presentation and the decision to hide runtime plans by default.

Does not own: mutating backend runtime state or changing tool execution policy.

## Document Provenance

- Source: operator runtime transcript showing hardcoded plan labels rendered as
  chat replies.
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: separating internal orchestration state from user-facing chat.
  - Verification: verified in code and targeted tests.
- Source: `kiko-api/src/jobs/chat/streamBroker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: preserving runtime snapshots for debugging while moving display
    policy to the frontend.
  - Verification: verified in code.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/runtime-plan-visibility.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-runtime-plan-user-visible-hardcoding-fix.md

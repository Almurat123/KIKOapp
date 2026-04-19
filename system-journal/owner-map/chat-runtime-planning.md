# Chat Runtime Planning Owner Map

Updated: 2026-04-18

## Owned Layers

- `kiko-api/src/jobs/chat/chatRuntimeMode.ts`
- `kiko-api/src/jobs/chat/chatCompatTurnRunner.ts`
- `kiko-api/src/jobs/chat/chatV2TurnRunner.ts`
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

### Chat v2 turn runner

Owns: normalized turn execution, direct follow-up branches, lean prompt
handoff, and orchestration retries inside the chat v2 runtime.

Does not own: task claiming, moderation, durable task completion, or cleanup.

### Chat runtime mode

Owns: runtime-mode parsing, compatibility alias policy, and worker-entry
dispatch to the active chat executor.

Does not own: turn execution internals or provider-level generation behavior.

### Chat compat runner

Owns: compatibility-mode execution policy and the temporary compat-to-v2 alias
until a dedicated fallback executor exists.

Does not own: runtime mode parsing or v2 turn execution internals.

### Prompt assembler

Owns: converting runtime state into model-safe structural context.

Does not own: user-visible plan titles, plan summaries, or card copy.

### Stream broker

Owns: updating runtime snapshots and tool/action state as the task executes.

Does not own: deciding whether a runtime card is visible in the product UI.

### Frontend message bubble

Owns: transcript presentation and normalized runtime plan rendering whenever
backend state exists.

Does not own: mutating backend runtime state or changing tool execution policy.

## Document Provenance

- Source: operator runtime transcript showing hardcoded plan labels rendered as
  chat replies.
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: separating internal orchestration state from user-facing chat.
  - Verification: verified in code and targeted tests.
- Source: operator requirement in local runtime thread to restore visible plan
  cards in normal chat.
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: frontend ownership of normal transcript plan-card visibility.
  - Verification: verified in code.
- Source: operator runtime transcript showing warmup plan labels rendered as
  answer-adjacent copy.
  - Kind: runtime observation
  - Retrieved: 2026-04-18
  - Applied To: task-planner hints and frontend ownership of scaffold normalization.
  - Verification: verified in code and targeted tests.
- Source: `kiko-api/src/jobs/chat/streamBroker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: preserving runtime snapshots for debugging while moving display
    policy to the frontend.
  - Verification: verified in code.
- Source: `kiko-api/src/jobs/chat/chatV2TurnRunner.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: separating worker shell ownership from v2 turn execution ownership.
  - Verification: verified in code and targeted tests.
- Source: `kiko-api/src/jobs/chat/chatRuntimeMode.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: explicit runtime mode switch above the turn runner owner.
  - Verification: verified in code and targeted tests.
- Source: `kiko-api/src/jobs/chat/chatCompatTurnRunner.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: dedicated compatibility owner below the runtime mode switch.
  - Verification: verified in code and targeted tests.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/runtime-plan-visibility.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-runtime-plan-visibility-and-nvidia-reasoning-restore.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-plan-card-internal-scaffold-filter.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-runtime-plan-user-visible-hardcoding-fix.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-runtime-mode-switch.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-compat-runner-owner.md

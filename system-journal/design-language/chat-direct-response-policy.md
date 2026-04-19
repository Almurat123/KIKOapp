# Chat Direct Response Policy

Updated: 2026-04-18

## Purpose

Define when chat worker code may bypass model generation and write assistant
text directly.

## Canonical Rules

1. Chat worker code must not author normal assistant reply text for greetings,
   clarification, trade outcomes, or product introductions.
2. Capability, skill, debugging, previous-behavior, and product-explanation
   questions must go through normal skill resolution and model generation.
3. Invalid normalization or missing context must fall through to the main model
   or structured runtime state, not backend-written clarification prose.
4. Direct trade follow-up may emit tool-authored summaries or raw tool errors,
   but must not synthesize outcome templates in worker code.
5. Safety and moderation blocks may remain deterministic only when they are
   explicit platform safety states, not product or workflow copy.

## Forbidden Local Patch Patterns

- Returning a fixed product-intro macro for greetings, "what can you do", "your
  skill", or "why did you reply that way" turns.
- Writing backend clarification text because canonical normalization failed or
  entity hints conflicted.
- Synthesizing trade success/failure/precheck summaries in worker code when the
  tool did not author them.
- Adding broad keyword shortcuts that bypass skill prompts for normal user
  questions.

## Document Provenance

- Source: operator runtime transcript where skill/meta questions were answered
  with a fixed KiKo introduction.
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: first narrowing, then fully removing direct worker-authored chat reply text.
  - Verification: verified in code and targeted tests.
- Source: /Users/almurat/Downloads/logs.1776445174160.json
  - Kind: runtime observation
  - Retrieved: 2026-04-18
  - Applied To: removing the remaining greeting fast path after it still produced hardcoded assistant copy.
  - Verification: verified in runtime and code.
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chatWorker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: worker direct-response owner boundary.
  - Verification: verified in code.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-hardcoded-reply-path-removal.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-direct-welcome-fast-path-hardcoded-reply-guard.md
- /Users/almurat/KiKo/system-journal/design-language/runtime-plan-visibility.md

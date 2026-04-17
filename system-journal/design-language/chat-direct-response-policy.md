# Chat Direct Response Policy

Updated: 2026-04-17

## Purpose

Define when chat worker code may bypass model generation and write assistant
text directly.

## Canonical Rules

1. Direct worker-authored text is allowed only for transport, safety, and bare
   greeting cases.
2. Capability, skill, debugging, previous-behavior, and product-explanation
   questions must go through normal skill resolution and model generation.
3. Direct replies must not override a selected skill just because the canonical
   domain is `assistant_meta`.
4. If a message contains substantive content beyond a greeting, do not use the
   deterministic greeting macro.
5. Safety and moderation blocks may remain deterministic, but they must be
   explicit safety states, not product onboarding copy.

## Forbidden Local Patch Patterns

- Returning a fixed product-intro macro for "what can you do", "your skill", or
  "why did you reply that way" turns.
- Treating all `assistant_meta/discover` turns as direct-response candidates.
- Adding broad keyword shortcuts that bypass skill prompts for normal user
  questions.

## Document Provenance

- Source: operator runtime transcript where skill/meta questions were answered
  with a fixed KiKo introduction.
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: limiting `buildFastDirectAssistantResponse` to bare greetings.
  - Verification: verified in code and targeted tests.
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chatWorker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: worker direct-response owner boundary.
  - Verification: verified in code.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-direct-welcome-fast-path-hardcoded-reply-guard.md
- /Users/almurat/KiKo/system-journal/design-language/runtime-plan-visibility.md

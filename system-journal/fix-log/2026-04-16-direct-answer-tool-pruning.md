# 2026-04-16 Direct Answer Tool Pruning

## What Changed

- Stopped onboarding and assistant-meta/debug turns from inheriting full tool
  exposure under soft policy.
- Stopped those same direct-answer turns from launching an extra hidden
  plan-generation model request.

## Why

Runtime logs showed trivial turns such as `你好` and capability questions routing
to `welcome_onboarding`, yet the main generation request still carried `64`
tools and the orchestration path also launched a separate `:plan` model call.

That created avoidable latency in two places:

- the visible answer prompt became much larger than necessary
- a second hidden model request competed for time and tokens despite the turn
  needing only a direct answer

## Product Rule

- Direct onboarding and assistant-meta/debug turns should answer from current
  conversation/runtime context without unrelated tool schemas.
- Hidden plan-generation calls are reserved for turns that materially benefit
  from a runtime plan card.

## Verification

- Verified in `/Users/almurat/KiKo/test.txt` that a trivial `glm-5` welcome turn
  carried `toolCount=64` and launched a parallel `:plan` stream.
- Verified in code that `nodeSkillResolver` widened tool exposure to the full
  registry when policy was not strict.
- Verified in tests that welcome/meta turns now expose zero tools and disable
  `allowAllTools`.

## Document Provenance

- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: identifying prompt bloat and unnecessary hidden plan generation
  - Verification: verified in runtime
- Source: `kiko-api/src/jobs/chat/nodeSkillResolver.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: pruning tool exposure for direct-answer turns
  - Verification: verified in code and tests
- Source: `kiko-api/src/jobs/chat/nodeOrchestrator.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: skipping plan generation for onboarding/meta direct answers
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-canonical-intent-fast-normalizer.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-agent-mode-prompt.md
- /Users/almurat/KiKo/system-journal/conflicts.md

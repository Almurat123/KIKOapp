# 2026-04-17 Direct Welcome Fast Path Hardcoded Reply Guard

## What Changed

- Restricted `buildFastDirectAssistantResponse` to bare greetings only.
- Exported the helper for targeted tests.
- Added coverage proving substantive welcome/meta turns such as "你能做什么",
  "who are you?", and "你的技能..." do not receive the fixed intro macro.

## Why

The worker-level fast path was keyed off broad `querySignals.welcome`. That
included capability and skill/meta questions, so the backend could bypass the
model and stream a fixed product introduction instead of answering the actual
question.

## Product Rule

- Bare greeting: deterministic short response is acceptable.
- Capability, skill, previous-behavior, and debugging questions: use normal
  model generation with the selected skill/context.

## Verification

- Verified with `chatWorker.test.ts` that only bare `你好` / `Hi` use the direct
  macro.
- Verified with `chatWorker.test.ts` that capability and skill/meta questions
  return `null` from the fast path and therefore continue to orchestration.

## Document Provenance

- Source: operator runtime transcript where skill/meta questions were answered
  with the fixed KiKo intro macro.
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: direct fast-path gating.
  - Verification: verified in code and targeted tests.
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chatWorker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: implementation owner.
  - Verification: verified in code.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/chat-direct-response-policy.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-direct-welcome-fast-path.md

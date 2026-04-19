# 2026-04-18 Chat Hardcoded Reply Path Removal

## What Changed

- Removed the chat v2 bare-greeting direct reply fast path from
  `/Users/almurat/KiKo/kiko-api/src/jobs/chat/chatV2TurnRunner.ts`.
- Removed backend-authored canonical clarification copy from
  `/Users/almurat/KiKo/kiko-api/src/jobs/chat/chatV2TurnRunner.ts` and
  `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodeOrchestrator.ts`.
- Removed direct trade follow-up success, failure, and precheck templates from
  `/Users/almurat/KiKo/kiko-api/src/jobs/chat/tradeFollowupExecutor.ts`.
- Direct trade follow-up now emits only tool-authored `summary`, raw tool
  `error`, or no text when the tool surfaced only structured UI artifacts.

## Why

The chat runtime still had several worker-authored reply exits. That meant the
backend could answer without the main model for greetings, failed normalization,
or trade follow-up. Product direction changed: user-visible assistant copy must
come from the model or from tool-authored output, not from hidden backend
templates.

## Product Rule

- Normal assistant turns: always go through the main model.
- Invalid canonical normalization: continue through the runtime, do not emit a
  backend clarification sentence.
- Confirmed trade follow-up: execute deterministically, but only surface
  tool-authored text or structured UI output.
- Missing pending confirmation or stale quote: do not emit a worker-authored
  precheck reply; let the main model handle the turn under normal guardrails.

## Verification

- Verified against `/Users/almurat/Downloads/logs.1776445174160.json` that the
  previous `你好` path was terminating as `direct_greeting_fast_path`.
- Verified in code review that the remaining user-visible hardcoded reply
  builders were `buildCanonicalIntentClarification`,
  `buildSuccessSummary`, `buildFailureSummary`, and
  `resolveInvalidTradeConfirmation`.
- Verified with targeted tests and build after removal.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776445174160.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-18
  - Applied To: removing the last greeting direct-reply path.
  - Verification: verified in runtime and code.
- Source: `/Users/almurat/KiKo/system-journal/design-language/chat-direct-response-policy.md`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: prohibiting worker-authored chat reply text outside explicit safety states.
  - Verification: verified in code.
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/chatV2TurnRunner.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: removing greeting and clarification reply exits from the v2 turn runner.
  - Verification: verified in code.
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/tradeFollowupExecutor.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: removing direct follow-up fixed summaries and precheck prose.
  - Verification: verified in code.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/chat-direct-response-policy.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-direct-welcome-fast-path-hardcoded-reply-guard.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-model-selected-task-menu.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md

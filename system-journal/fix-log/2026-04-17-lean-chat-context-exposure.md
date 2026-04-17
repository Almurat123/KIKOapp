# 2026-04-17 Lean Chat Context Exposure

## What Changed

- Kept ordinary direct-answer turns lean by omitting wallet, token, launchpad,
  workflow, execution-plan, and skill/tool-guidance blocks from the model-visible
  prompt when the intent is a plain `general_answer` or `meta_debug` turn.
- Stopped generic direct answers from falling back to a default `market_macro`
  skill when no domain skill matches.
- Narrowed the local token leaderboard shortcut so it only applies to token or
  general trend queries and does not swallow explicit specialist-domain turns
  such as Zora.
- Preserved task-scoped context for trading, social, search, and deployment
  turns so those flows still receive the context they actually need.

## Why

Runtime review and architecture inspection showed that we were still injecting
too much real session state into the prompt on ordinary questions. That made the
model feel over-scripted, polluted answers with irrelevant wallet/context
details, and kept generic questions from using the clean direct-answer path the
product now wants.

## Product Rule

- Ordinary Q&A should answer directly without unrelated business context.
- Domain-specific tasks should still receive the smallest useful task-scoped
  context.
- Generic direct answers must not inherit a default market skill just because
  nothing else matched.

## Verification

- Verified in code that `nodePromptAssembler` suppresses business-context and
  tool-guidance blocks for lean direct-answer turns.
- Verified in code that `nodeSkillResolver` no longer falls back to
  `market_macro` for generic direct answers.
- Verified in code that specialist-domain trend queries keep their matched
  skill tools instead of being re-routed into the local token leaderboard path.
- Added tests for lean prompt exposure and for direct-answer skill routing.

## Document Provenance

- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: identifying that direct-answer turns were still carrying too many tools/context blocks
  - Verification: verified in runtime and previous fix logs
- Source: `kiko-api/src/jobs/chat/nodePromptAssembler.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: lean direct-answer prompt exposure
  - Verification: verified in code and targeted tests
- Source: `kiko-api/src/jobs/chat/nodeSkillResolver.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: removing the default market fallback for generic direct answers
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-direct-answer-tool-pruning.md
- /Users/almurat/KiKo/system-journal/design-language/chat-direct-response-policy.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
- /Users/almurat/KiKo/system-journal/conflicts.md

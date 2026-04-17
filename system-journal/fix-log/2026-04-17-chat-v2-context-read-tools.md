# 2026-04-17 Chat V2 Context Read Tools

## What Changed

- Added explicit chat v2 `read_*` context tools for:
  `user_settings`, `user_context`, `workflow_state`, `wallet_state`,
  `token_context`, `launchpad_context`, `social_thread_context`,
  `social_images`, `provider_native_evidence`, `execution_plan`, and
  `skill_prompts`.
- Registered those tools in the built-in tool registry so the Node chat runtime
  can resolve them through the normal tool execution engine instead of relying
  on prompt-only hidden state.
- Changed prompt assembly to expose a context catalog plus a required-context
  contract, and to stop pre-injecting wallet, workflow, token, launchpad,
  execution-plan, provider-evidence, and skill-prompt payloads into the model
  by default.
- Changed skill resolution so ordinary turns no longer inherit the full tool
  registry; the resolver now exposes matched business tools plus explicit
  context-read tools.
- Added orchestration-time required-context enforcement for execution/debug and
  other high-risk turns, while avoiding forced extra loops for ordinary
  analysis/social turns.

## Why

The rewrite plan requires context to be prepared server-side but not dumped
into every prompt. The previous shape still polluted ordinary answers with
wallet, chain, token, workflow, plan, and skill state before the model had
decided whether it needed any of them. The new context-read layer keeps that
state available, but makes access explicit and auditable.

## Product Rule

- Chat v2 should expose what context can be read, not silently inject all
  cached context into every turn.
- Ordinary Q&A should stay lean unless the task actually requires business
  state.
- High-risk turns may require deterministic context reads before a final answer.
- Context reads are read-only runtime tools and must never mutate execution
  state.

## Verification

- Verified in code that `contextReadTools.ts` defines read-only tool handlers
  for the shared chat context blocks.
- Verified in code that `bootstrap.ts` registers the context-read tools in the
  built-in registry.
- Verified in code that `nodePromptAssembler.ts` now renders a context catalog
  and read policy instead of pre-injecting the raw business-context blocks.
- Verified in code that `nodeSkillResolver.ts` narrows tool exposure to matched
  business tools plus context reads.
- Verified in code that `nodeOrchestrator.ts` passes runtime execution-plan,
  skill-prompt, and provider-evidence state into tool context and can enforce
  required reads on high-risk turns.
- Verified with targeted tests:
  `kiko-api/src/jobs/chat/contextReadTools.test.ts`
  `kiko-api/src/jobs/chat/toolExecutionEngine.test.ts`
  `kiko-api/src/jobs/chat/nodePromptAssembler.test.ts`
  `kiko-api/src/jobs/chat/nodeSkillResolver.test.ts`
  `kiko-api/src/jobs/chat/nodeOrchestrator.searchPhase.test.ts`
- Broader end-to-end runtime verification is still pending.

## Document Provenance

- Source: `/Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: context catalog plus on-demand context-read architecture
  - Verification: inferred from plan and verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/contextReadTools.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: read-only context tool definitions and block-to-tool mapping
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodePromptAssembler.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: model-visible context catalog and read policy
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodeSkillResolver.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: narrowed tool exposure and required-context tool ordering
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodeOrchestrator.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: runtime handoff and high-risk required-context enforcement
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-contract-scaffold.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-lean-chat-context-exposure.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/conflicts.md

# 2026-04-17 Chat V2 Worker Context Contracts

## What Changed

- Added `/Users/almurat/KiKo/kiko-api/src/jobs/chat/workerContextContracts.ts`
  as the shared owner for model-facing session and wallet context contracts.
- Changed `read_user_context` to return:
  `context.wallet`, `context.chain.connected`, `context.chain.requested`,
  `context.chain.effective`, `context.surface`, and
  `context.request_entities`.
- Changed `read_wallet_state` to return compact wallet state:
  `context.wallet`, `context.active_chain`,
  `context.balances.active_chain`, `context.balances.all_chains`, and
  `context.snapshots`.
- Updated Node and Python context catalog wording to describe worker contracts
  instead of vague summaries.

## Why

The model is a worker using context to decide what to read, analyze, quote, or
execute. The previous payloads still looked like mixed runtime objects:
camelCase fields, raw prefetched wallet info, and descriptions such as
"connected session summary". That language was too vague and made the model
infer operational meaning from presentation text.

The new shape makes the operational fields explicit:

- `user_context` answers: who is connected, which chain is connected, which
  chain the user requested, and which chain should be used for this task.
- `wallet_state` answers: what wallet is connected, which active-chain funds
  are known, which all-chain funds are known, and when those snapshots were
  captured.

## Product Rule

- Model-facing context payloads should be worker contracts, not UI summaries.
- Use stable snake_case fields for tool results the model reads directly.
- Requested chain must be separated from connected chain.
- Effective task chain must be explicit so the model does not ask repeated
  chain-confirmation questions.
- Raw balance/provider objects should be compacted before reaching the model.

## Verification

- Verified in code that `read_user_context` now returns a nested worker
  contract under `context`.
- Verified in code that `read_wallet_state` compacts active-chain and all-chain
  balances instead of returning raw wallet snapshots.
- Updated targeted tests:
  `kiko-api/src/jobs/chat/contextReadTools.test.ts`
  `kiko-api/src/jobs/chat/toolExecutionEngine.test.ts`
  `kiko-api/src/jobs/chat/nodePromptAssembler.test.ts`
  `kiko-api/src/jobs/chat/chatV2ArchitectureSmoke.test.ts`
- Runtime verification still depends on local test execution after this change.

## Document Provenance

- Source: `/Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: on-demand context-read architecture
  - Verification: inferred from plan and verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/contextReadTools.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: `read_user_context` and `read_wallet_state` result shape
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/workerContextContracts.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: normalized worker-facing session and wallet contracts
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-user-settings-contract.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/conflicts.md

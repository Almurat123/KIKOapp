# 2026-04-18 Chat Work Protocol Refactor

## Why

Chat v2 had moved from full prompt pre-injection to context catalogs plus read tools, but the worker still lacked two things:

- a compact carry-forward state summary that survives across turns
- a deterministic work protocol telling the model how to move from state -> context read -> evidence -> answer or execution

This gap caused the worker to restart tasks from scratch, re-ask already confirmed fields, and guess what to do after tool results.

## What changed

### Prompt layer

- `kiko-api/src/jobs/chat/nodePromptAssembler.ts`
  - added `WORKER_PROTOCOL` so the model sees the actual worker flow instead of only a task catalog
  - added `WORKER_STATE_MACHINE` so model-owned task selection still follows a deterministic order:
    request understanding -> task selection -> required context reads -> missing evidence -> answer/quote/confirm/execute
  - added `CONTEXT_TRIGGER_POLICY` so wallet/token/social/image/settings/workflow context is read only when the task actually needs it
  - added `ANSWER_QUALITY_CONTRACT` so the worker stops plan narration, generic capability pitches, and invented tool-result fields
  - added `WORKING_MEMORY` so already-confirmed state is visible by default
  - made compact `USER_SETTINGS`, `USER_CONTEXT`, and `WORKFLOW_STATE` visible inline when the turn contract requires them
  - updated catalog wording from generic descriptions to worker-facing operation language
  - expanded `TASK_MENU` entries with `enter_when`, `must_read`, and `done_when` fields while preserving model-owned multi-select task choice
  - added hard `lean_chat.exit_when` thresholds so wallet/token/market/swap/deploy/Polymarket/image/social/debug signals cannot be silently swallowed by lean chat
  - changed specialist `done_when` clauses toward atomically checkable completion rules, for example required quote fields and minimum sourced shortlist criteria
  - made `CONTEXT_CONTRACT.source` visible so the model can distinguish backend read/safety contracts from its own task-mode choice

### User settings contract

- `kiko-api/src/jobs/chat/userSettingsContract.ts`
  - split model-visible settings into:
    - `execution_mode`
    - `hard_constraints`
    - `soft_preferences`
  - kept swap defaults and safety checks compact and structured

### Context reads

- `kiko-api/src/jobs/chat/contextReadTools.ts`
  - upgraded `read_workflow_state` to expose carry-forward task state
  - added a continuity rule so the model knows confirmed runtime state should be reused until overridden
  - added one durable `workerState` object that exposes:
    - `task_state`
    - `mode_progress_state`
    - `execution_state`
    - `evidence_state`
    - `next_action_state`
  - `task_state` now includes `scope_source`, making `fresh_request`, `carry_forward_session`, and pending execution states explain their provenance
  - `mode_progress_state` now exposes:
    - mode candidate
    - internal workflow state
    - completed steps
    - pending steps
    - missing fields
  - changed read-context tool descriptions from generic capability labels to trigger-focused guidance:
    - when to read wallet state
    - when to read workflow state
    - when to read token/social/image/settings state
    - when not to expose internal execution plan labels

### Tool follow-up semantics

- `kiko-api/src/jobs/chat/toolExecutionEngine.ts`
- `kiko-api/src/jobs/chat/nodeOrchestrator.ts`
  - every orchestrator tool result now carries a continuation contract
  - tool messages sent back into the model now include:
    - `ok`
    - `result` or `error`
    - `continuation`
  - the continuation contract tells the worker whether the next step is:
    - answer now
    - read more context
    - call another tool
    - ask user confirmation
    - handle tool failure

### Worker state object

- `kiko-api/src/jobs/chat/workerStateBuilder.ts`
  - added one shared owner for:
    - durable worker state derivation
    - confirmation binding metadata
    - direct follow-up execution-plan derivation
    - pending quote extraction
    - latest execution receipt extraction
  - this removes the older split where:
    - prompt assembly summarized state one way
    - `read_workflow_state` returned another shape
    - direct follow-up execution rebuilt actions from per-kind branches

### Quote and receipt state

- `kiko-api/src/jobs/chat/contracts.ts`
  - added `TradeQuoteState`
  - added `ExecutionReceiptState`
  - extended `TradeConfirmationState` with `quote` and `receipt`
- `kiko-api/src/jobs/chat/conversationStateResolver.ts`
  - swap confirmations now carry quote metadata from `simulate_swap`, `prepare_swap_transaction`, `get_cross_chain_quote`, or `prepare_cross_chain_tx`
- `kiko-api/src/jobs/chat/workerStateBuilder.ts`
  - worker `execution_state` now exposes:
    - `pending_quote`
    - `latest_receipt`
  - evidence state can now record:
    - `execution_quote`
    - `execution_preflight`
    - `execution_receipt`
- `kiko-api/src/jobs/chat/executionGate.ts`
  - execution precheck rejects only explicitly stale quotes:
    - `stale: true`
    - `expired: true`
    - expired `expiresAt` / `quoteExpiresAt` / equivalent fields
  - old quote timestamps without an explicit expiry still preserve the existing behavior

### Direct follow-up execution

- `kiko-api/src/jobs/chat/tradeFollowupExecutor.ts`
  - now executes from a single derived plan object
  - swap/copy-trade/order confirmations still behave the same, but the plan is now centralized and carries internal binding semantics instead of spreading them across branches

### Skill prompts

- updated core skill prompts to align with the new worker language:
  - `TokenSkill`
  - `WalletSkill`
  - `PolymarketSkill`
  - `MetaDebugSkill`
- added explicit worker contracts to those prompts:
  - enter the skill only after the model selects the specialist mode
  - start from `WORKING_MEMORY` / `read_workflow_state`
  - reuse selected token/market/wallet state before rediscovery
  - answer after successful tools unless a concrete missing evidence gap remains
  - ask one precise clarification only when the required field cannot be inferred from state

## Design language

- catalogs are not enough; the worker needs an explicit protocol
- carry-forward state must be visible in compact form
- context-read tools remain the source of deeper state, but compact continuity must not be hidden behind tools only
- task selection is model-owned, but execution order is system-owned through a state machine
- specialist prompts are domain workflow contracts, not intent routers
- tool descriptions should include trigger conditions so the model can choose tools accurately
- `lean_chat` is a default, not a sink; specialist exit thresholds must be explicit
- every long-running specialist task needs internal progress state, not only a selected mode
- backend context-contract mode must expose provenance because it gates reads and safety, not model intent
- tool outputs must describe the next worker step, not only dump raw data
- user settings must distinguish hard rules from soft defaults
- worker memory, workflow reads, and direct execute follow-up must consume the same durable state object
- binding keys are internal execution safety state, not extra user-facing approval UX
- quote invalidation must be evidence-based; do not infer stale status from age alone unless the tool returned an expiry field
- receipts are execution evidence and should be carried as state, not hidden inside raw tool traces only

## Verified

- `cd kiko-api && npx tsx --test --test-force-exit src/jobs/chat/nodePromptAssembler.test.ts`
- `cd kiko-api && npx tsx --test --test-force-exit src/jobs/chat/contextReadTools.test.ts src/jobs/chat/toolExecutionEngine.test.ts`
- `cd kiko-api && npx tsx --test --test-force-exit src/jobs/chat/chatV2ArchitectureSmoke.test.ts src/jobs/chat/chatV2TurnRunner.test.ts src/jobs/chat/nodeOrchestrator.searchPhase.test.ts`
- `cd kiko-api && npx tsx --test --test-force-exit src/jobs/chat/workerStateBuilder.test.ts src/jobs/chat/tradeFollowupExecutor.test.ts`
- `cd kiko-api && npx tsx --test --test-force-exit src/jobs/chat/workerStateBuilder.test.ts src/jobs/chat/conversationStateResolver.test.ts src/jobs/chat/executionGate.test.ts src/jobs/chat/contextReadTools.test.ts src/jobs/chat/nodePromptAssembler.test.ts src/jobs/chat/tradeFollowupExecutor.test.ts`
- `cd kiko-api && npx tsc --noEmit`
- `cd kiko-api && npx tsx --test --test-force-exit src/jobs/chat/nodePromptAssembler.test.ts src/jobs/chat/contextReadTools.test.ts`
- `cd kiko-api && npx tsx --test --test-force-exit src/jobs/chat/workerStateBuilder.test.ts src/jobs/chat/nodePromptAssembler.test.ts src/jobs/chat/contextReadTools.test.ts`

All passed on 2026-04-18 after the refactor.

## Document provenance

- Source: local runtime product-owner instructions about actual KiKo worker behavior
- Kind: product instruction / runtime observation
- Retrieved: 2026-04-18
- Applied To: work protocol, carry-forward memory, continuation contracts, and settings contract cleanup
- Verification: verified in code and targeted tests

- Source: `system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md`
- Kind: repo doc
- Retrieved: 2026-04-18
- Applied To: preserving chat v2 context-read architecture while repairing missing continuity
- Verification: partially verified in code

- Source: product-owner runtime review of KiKo task/state/evidence/action architecture
- Kind: product instruction / runtime observation
- Retrieved: 2026-04-18
- Applied To: durable worker state object, explicit confirmation bindings, and direct-followup plan centralization
- Verification: verified in code and targeted tests

- Source: product-owner follow-up instruction to continue quote/receipt/stale quote hardening
- Kind: product instruction / runtime observation
- Retrieved: 2026-04-18
- Applied To: pending quote state, receipt state, and explicit stale-quote execution gating
- Verification: verified in code and targeted tests

- Source: product-owner runtime review of KiKo system prompt and skill prompt quality
- Kind: product instruction / runtime observation
- Retrieved: 2026-04-18
- Applied To: worker state machine, context-trigger policy, answer-quality contract, and skill worker contracts
- Verification: verified in code and targeted tests

- Source: product-owner supplied model review of remaining TASK_MENU/CONTEXT_CATALOG gaps
- Kind: product instruction / runtime observation
- Retrieved: 2026-04-18
- Applied To: mode_progress_state, lean_chat exit thresholds, atomic done_when rules, context-contract source, and working-memory scope provenance
- Verification: verified in code and targeted tests

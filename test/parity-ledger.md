# Node -> Python Parity Ledger

Baseline: `f993cb15a6ee32e0fab4123c46b1e492c2fd00b9`

## Worker Core
- `kiko-api/src/jobs/chatWorker.ts:isConfirmationMessage` -> `kiko-python/chat_v2/worker.py:_is_confirmation_message`
- `kiko-api/src/jobs/chatWorker.ts:buildWalletInfoFromContext` -> `kiko-python/chat_v2/worker.py:_build_wallet_info_from_context`
- `kiko-api/src/jobs/chatWorker.ts:seedToolCacheFromContext` -> `kiko-python/chat_v2/worker.py:_seed_tool_cache_from_context`
- `kiko-api/src/jobs/chatWorker.ts:preFetchByIntent` -> `kiko-python/chat_v2/worker.py:_pre_fetch_by_intent`
- `kiko-api/src/jobs/chatWorker.ts:executeTools` -> `kiko-python/chat_v2/worker.py:_execute_tool_call` + loop in `_run_llm`
- `kiko-api/src/jobs/chatWorker.ts:processDeepSeekTask` -> `kiko-python/chat_v2/worker.py:_run_llm` (DeepSeek/OpenAI-compatible path)
- `kiko-api/src/jobs/chatWorker.ts:processGrokTask` -> `kiko-python/chat_v2/worker.py:_run_llm` (single gateway path, pending branch split)

## Prompt / Intent / Budget
- `kiko-api/src/services/ai/PromptOrchestrator.ts:getSystemPrompt` -> `kiko-python/chat_v2/prompt_orchestrator.py:get_system_prompt`
- `kiko-api/src/services/ai/PromptOrchestrator.ts:buildPrompt` -> `kiko-python/chat_v2/prompt_orchestrator.py:build_prompt`
- `kiko-api/src/services/ai/intentParser.ts` -> `kiko-python/chat_v2/intent.py`
- `kiko-api/src/services/ai/contextBudgetManager.ts` -> `kiko-python/chat_v2/context_budget.py`

## Context Injection Rules
- Balance snapshot block (`[USER_BALANCE_CONTEXT]`) -> implemented in `kiko-python/chat_v2/worker.py`
- Requested token balance semantics (`not present` must not infer) -> partial, pending strict parity
- `systemInjection` rules:
  - `CONFIRMED_SWAP` -> implemented
  - `CONFIRMED_CROSS_CHAIN_SWAP` -> pending
  - `BALANCE AUTO-RESOLUTION ISSUE` -> pending
  - `FAST SWAP SAFE MODE` -> implemented

## WS/Event Parity
- Task status fields (`taskType/iteration/maxIterations/taskId`) -> implemented
- `client_action` transaction card passthrough -> implemented
- Sync (`lastSeq`) and replay -> implemented

## Known Remaining Gaps (must close for 100%)
1. Dedicated Grok branch behavior parity (currently unified path).
2. Requested-token balance block strict formatting and symbol/address alias parity.
3. Full `systemInjection` matrix from Node (cross-chain + balance auto-resolution).
4. Tool execution batch semantics edge cases in `executeTools` (Node-specific retries/ordering).
5. Golden/replay harness gates not yet green.

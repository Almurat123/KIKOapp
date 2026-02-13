# Node vs Python Tool Usage Report

Generated: 2026-02-13

## Scope

- Compared Node internal tools endpoint (`:3001/internal/tools/*`) vs Python tool-runtime endpoint (`:8001/tool-runtime/internal/v1/tool/*`).
- Test artifact: `test/node_python_tool_compare_latest.json`.

## Result Summary

1. Tool definitions parity: **PASS**
- Node tool count: 46
- Python tool-runtime tool count: 46
- Tool names aligned.

2. Execution parity on core tools: **PASS**
- `get_wallet_info` valid input: both successful.
- `simulate_swap` valid input: both successful.
- `prepare_swap_transaction` valid input: both successful.
- `get_token_info` valid input: both successful.

3. Invalid-shape behavior parity: **PASS**
- `simulate_swap` missing args: both return business error in result.
- `prepare_swap_transaction` missing args: both return business error in result.
- `get_token_info` bad shape: both return business error in result.

## Actual Broken Link

The issue is not Node-vs-Python tool runtime transport. The failing chain is:

- LLM emits empty tool args (`raw_args=""`) in chat rounds.
- Worker executes calls with incomplete params (or caches prior business-error result).
- Business error in `result.error` was previously treated like success and fed back into next round.
- Loop continues and user sees long “thinking” / non-executable replies.

## Fixes Applied in Python Worker

1. Tool-call delta merge stability fix (prevents duplicated logical calls).
2. Required-arg guard for `simulate_swap`, `prepare_swap_transaction`, `get_token_info`.
3. Tool arg inference from intent/context for trading turns.
4. Treat `result.error` as execution error path, not success.
5. Confirmation-message intent inheritance (`proceed/confirm/yes/...`) from last trading turn.
6. Skip redundant `get_wallet_info` when wallet snapshot already exists in context.
7. Added deep trace logs for round/tool/stop-reason visibility.

## Important Runtime Note

Python changes require process restart (no hot reload in current run mode).

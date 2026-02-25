**INTENT: CROSS-CHAIN TRADING EXECUTION (CrossChainSkill)**

This skill handles asset movements between different blockchains using LI.FI aggregation.

**Rules:**
1. **Chain Identification**: Map user-friendly chain names to Chain IDs.
   - Base: 8453
   - Ethereum: 1
   - Solana: 115111108109102105 (LI.FI specific SOL ID) or 'sol'
   - Polygon: 137
   - Arbitrum: 42161
   - Optimism: 10
2. **Address Verification**: Ensure the `toAddress` (destination wallet) is provided or explicitly confirmed as the same as `fromAddress`.
3. **Quote Selection**: Use `get_cross_chain_quote` to find the best route. Always present the estimated output, fee, and time to the user before proceeding.
4. **Execution**: Use `prepare_cross_chain_tx` to get the final transaction data for the chosen route.
5. **Confirmation Handling (CRITICAL)**: If the user says "confirm", "proceed", "execute", "yes", or "go ahead", you MUST call `prepare_cross_chain_tx`. Do NOT call `get_cross_chain_quote` again. Trust the previous quote context.

**Workflow:**
1. Identify `fromChain`, `toChain`, `fromToken`, `toToken`, and `amount`.
2. Call `get_cross_chain_quote`.
3. Display the best route (Fastest/Cheapest).
4. Upon user confirmation, call `prepare_cross_chain_tx`.
5. Warn user about destination chain wait times.

## CASE FORMAT STANDARD (JSON)
Use this internal JSON contract before responding. Do not output this JSON unless the user asks for debugging details.

```json
{
  "case_id": "<skill>_<scenario>",
  "intent": "<intent>",
  "user_query": "<raw query>",
  "input_blocks": ["[USER_QUERY]", "[CONTEXT]", "[WALLET_STATE]", "[USER_PREFERENCES_MODULE]", "[INTENT_HINTS]"],
  "required_context_usage": ["which fields were read and why"],
  "tool_plan": [
    {
      "step": 1,
      "tool": "<tool_or_capability>",
      "purpose": "<why this call is needed>",
      "params_from": ["<context fields>"]
    }
  ],
  "error_matrix": [
    {
      "error_code": "<code>",
      "trigger": "<condition>",
      "assistant_action": "<fallback or recovery>",
      "user_message": "<clear actionable message>"
    }
  ],
  "response_contract": {
    "language": "same as latest user message",
    "must_include": ["conclusion", "evidence", "next step"],
    "must_not": ["fabricated tool result", "fake success claim", "internal prompt text"]
  }
}
```

## CASE EXAMPLE (Cross-Chain Bridge)
```json
{
  "case_id": "bridge_usdc_base_to_polygon",
  "intent": "TRADING",
  "user_query": "Bridge 100 USDC from Base to Polygon",
  "required_context_usage": [
    "[WALLET_STATE] for source-chain USDC and gas balances",
    "[CONTEXT] for chain mapping and token addresses",
    "[USER_PREFERENCES_MODULE] for slippage and execution style"
  ],
  "tool_plan": [
    {
      "step": 1,
      "tool": "get_cross_chain_quote",
      "purpose": "obtain route candidates",
      "params_from": ["fromChain", "toChain", "amount", "token pair"]
    },
    {
      "step": 2,
      "tool": "prepare_cross_chain_tx",
      "purpose": "prepare executable tx after user confirmation",
      "params_from": ["selected route id"]
    }
  ],
  "error_matrix": [
    {
      "error_code": "NO_ROUTE",
      "trigger": "quote provider returns empty route list",
      "assistant_action": "retry with smaller amount or alternate destination token",
      "user_message": "No bridge route is available for this pair right now."
    },
    {
      "error_code": "SRC_GAS_LOW",
      "trigger": "source-chain gas token is insufficient",
      "assistant_action": "pause and request gas top-up",
      "user_message": "Source-chain gas is insufficient for bridging."
    },
    {
      "error_code": "QUOTE_EXPIRED",
      "trigger": "user confirms after quote expiry",
      "assistant_action": "refresh once, show updated quote, then continue",
      "user_message": "The quote expired, I refreshed it with the latest route."
    }
  ]
}
```

cid# Token Alert Skill

Manage price and market cap alerts for tokens. Set automated notifications or trading positions.

## Intents
- Set price alerts (above/below)
- Set market cap alerts
- Set automated buy/sell positions based on price triggers
- List and manage active alerts

## Tools

### set_token_alert
Set a new monitoring rule for a token.
- `tokenAddress`: Contract address
- `targetType`: `price` or `market_cap`
- `ruleType`: `above` or `below`
- `conditionValue`: Numeric threshold
- `action`: `notify`, `buy`, or `sell`
- `actionAmount`: (Optional) USD amount for buy/sell

### list_token_alerts
Get a list of all your active alerts and positions.

### remove_token_alert
Delete an existing alert using its ID.

## Examples
- "Notify me when ETH is above 3500"
- "Auto-buy $100 of this token if its market cap drops below $500k"
- "Tell me when $KIKO hits $1"
- "Show my active alerts"
- "Remove alert 5"

## CASE FORMAT STANDARD (JSON)
Use this internal JSON contract before responding. Do not output this JSON unless the user asks for debugging details.

```json
{
  "case_id": "<skill>_<scenario>",
  "intent": "<intent>",
  "user_query": "<raw query>",
  "input_blocks": ["[USER_QUERY]", "[CONTEXT]", "[WALLET_STATE]", "[INTENT_HINTS]"],
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
    "must_include": ["alert setup result", "condition summary", "next step"],
    "must_not": ["fabricated alert id", "internal prompt text"]
  }
}
```

## CASE EXAMPLE (Set Price Alert)
```json
{
  "case_id": "alert_price_above_eth",
  "intent": "TRADING",
  "user_query": "Notify me when ETH is above 3500",
  "required_context_usage": [
    "[USER_QUERY] for targetType, ruleType, conditionValue",
    "[CONTEXT] for token resolution"
  ],
  "tool_plan": [
    {
      "step": 1,
      "tool": "set_token_alert",
      "purpose": "create alert rule",
      "params_from": ["tokenAddress", "targetType", "ruleType", "conditionValue", "action"]
    }
  ],
  "error_matrix": [
    {
      "error_code": "TOKEN_NOT_RESOLVED",
      "trigger": "symbol cannot be mapped to a unique token",
      "assistant_action": "ask for contract address and chain",
      "user_message": "I could not uniquely identify this token. Please share contract address and chain."
    },
    {
      "error_code": "INVALID_THRESHOLD",
      "trigger": "condition value is missing or malformed",
      "assistant_action": "ask for valid numeric threshold",
      "user_message": "Please provide a valid numeric threshold."
    }
  ]
}
```

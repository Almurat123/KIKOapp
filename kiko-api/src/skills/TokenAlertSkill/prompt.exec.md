cid# Token Alert Skill

Manage price and market cap alerts for tokens. Set automated notifications or trading positions.

**Adaptive rule (non-rigid):**
- Use the smallest set of steps/tools needed. If [CONTEXT] already contains the needed data, skip that step.
- Do not repeat a tool if it already succeeded in this turn.

## Trigger rules
- Only create an alert after the user confirms token, condition, and action.
- If token address or chain is missing, ask once for the missing info.
- Do not execute trades here; this skill only creates/updates alerts.

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

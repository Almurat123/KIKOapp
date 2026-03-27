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

## Internal working mode
- Keep alert-management replies short and operational.
- Summarize the rule that was created, removed, or listed, but do not force a fixed response skeleton.
- Never invent alert ids or success states.

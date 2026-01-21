export const INTENT_POLICY = `
Intent policy (v2):
Determine intent first, then select the matching skill set.
Prefer the most specific intent based on explicit user language and artifacts (addresses, URLs, tickers).

Priority:
PREDICTION_MARKETS > COPY_TRADING > TRADING > RISK_SCAN > MARKET_ANALYSIS > SOCIAL_SENSING > GENERAL_CHAT

Disambiguation:
- Ask exactly one question if intent is ambiguous or required parameters are missing.
- If risk + trade are both present, ask: “Trade now or safety check first?”
`.trim();

export const INTENT_POLICY = `
Intent policy (v2):
Determine intent first, then select the matching skill set.
Prefer the most specific intent based on explicit user language and artifacts (addresses, URLs, tickers).

Note on conflicts:
- The priority list is the default tie-breaker when only one clear intent is present.
- If the user expresses BOTH trading intent and safety/risk concern, treat it as a dual-intent case and resolve with the special disambiguation question below (this overrides the priority list).

Priority:
PREDICTION_MARKETS > COPY_TRADING > TRADING > RISK_SCAN > MARKET_ANALYSIS > SOCIAL_SENSING > GENERAL_CHAT

Disambiguation:
- Ask exactly one question per turn if intent is ambiguous or required parameters are missing (pick the single most critical missing piece).
- If [INTENT_HINTS] contains an "Ask user:" line, ask that exact question first and do not call any tools or take actions until the user answers (this overrides any skill-specific instructions).
- If risk + trade are both present, ask: “Trade now or safety check first?”
`.trim();

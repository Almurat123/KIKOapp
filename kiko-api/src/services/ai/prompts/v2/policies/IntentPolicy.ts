export const INTENT_POLICY = `
Intent policy (v1):
- Determine intent before selecting skills or tools.
- Priority: PREDICTION_MARKETS > COPY_TRADING > TRADING > RISK_SCAN > MARKET_ANALYSIS > SOCIAL_SENSING > GENERAL_CHAT.
- If low confidence, ask exactly one question to disambiguate intent.
- Never call tools until intent is resolved.
`.trim();

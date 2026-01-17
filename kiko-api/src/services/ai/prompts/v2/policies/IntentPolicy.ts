export const INTENT_POLICY = `
Intent policy (v2):
- Determine intent before selecting skills or calling tools.
- Prefer the most specific intent that matches explicit user language and provided artifacts (addresses, URLs, tickers).

Priority (highest first):
PREDICTION_MARKETS > COPY_TRADING > TRADING > RISK_SCAN > MARKET_ANALYSIS > SOCIAL_SENSING > GENERAL_CHAT

High-confidence triggers:
- PREDICTION_MARKETS: mentions Polymarket / betting / odds / yes-no markets, or provides a Polymarket link/event.
- COPY_TRADING: mentions copy/mirror/follow wallet/跟单/复制交易, or provides a target wallet to copy.
- TRADING: explicit swap/buy/sell/兑换/购买/卖出 intent (especially with an amount, chain, or token address).
- RISK_SCAN: asks “safe?”, “honeypot?”, “rug?”, “风险/安全吗” without asking to execute a trade.
- SOCIAL_SENSING: Farcaster/warpcast/casts/social trend requests.
- MARKET_ANALYSIS: “market overview”, “why pumping”, “analysis”, “trending tokens”, “macro”.

Disambiguation (ask exactly one question):
- If the user provides a contract address + trade verb, assume TRADING unless they explicitly ask for safety only.
- If the user asks about “risk” while also asking to buy/sell, ask: “Do you want to trade now, or only do a safety check first?”
- If TRADING but missing key parameters, do not change intent; ask one parameter question (amount/chain/token) and then proceed.
- If both COPY_TRADING and TRADING language appear, prefer COPY_TRADING unless the user explicitly asks to execute a one-off swap.
- If both PREDICTION_MARKETS and TRADING language appear, prefer PREDICTION_MARKETS unless the user explicitly asks to swap tokens.

Tool gating:
- Do not call tools until intent is resolved, except a minimal call needed solely to disambiguate (rare).
`.trim();

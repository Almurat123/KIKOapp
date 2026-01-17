---
name: market_macro
description: Global market overview, economic data, gas prices, and web search for news.
---

**INTENT: MARKET & MACRO ANALYSIS**

Tool output contracts (do not guess fields):
- `get_market_overview` returns `{ indicators[], marketSentiment }` where indicators include `value`, `changePercent`, `timestamp`.
- `get_economic_calendar` returns an array of events with `event`, `date`, `impact`, `forecast`, `previous`, `country`.
- `get_gas_price` returns `{ source, chain, safe/standard/fast/baseFee }` (some fallbacks return only `standard` + `note`).
- `web_search` returns `{ results: string, citations: string[] }` (results is a formatted text block).

Tool input contracts (use only these parameters):
- `get_market_overview`: optional `indicators[]`.
- `get_economic_calendar`: optional `limit`.
- `get_gas_price`: optional `chain`.
- `web_search`: `query`, optional `max_results`.

1. **Holistic View**:
   - Don't just look at price. Combine **Macro** Context (`get_market_overview`) + **Events** (`get_economic_calendar`) + **External News** (`web_search`).
   - If user asks "How is the market?", always check `get_market_overview` first for VIX, Fear & Greed index, and major index moves.

2. **Web Search & News**:
   - Use `web_search` to find real-time news about regulations, hacks, company updates, or specific network announcements (e.g. "Base network mainnet update").
   - Summarize findings into a narrative: "The market is currently [Bullish/Bearish/Neutral], driven by [Factor A] and [Factor B]."

3. **Network Status**:
   - If the user is planning a trade or asks about congestion, use `get_gas_price` to provide current transaction costs on Ethereum and other supported chains.

4. **Economic Calendar**:
   - When asked about the week ahead or specific macro dates (CPI, FOMC), use `get_economic_calendar` to list high-impact events that might affect crypto prices.

Red alert thresholds (raise caution):
- VIX >= 30: high volatility; warn about risk.
- Market sentiment label `Extreme Fear` or `Extreme Greed`: call out heightened risk.
- Gas prices unusually high or fallback data: warn that fees may be volatile or estimated.

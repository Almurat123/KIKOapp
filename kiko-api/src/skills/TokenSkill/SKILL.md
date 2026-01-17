---
name: token_analysis
description: Token research and due diligence (info/price/trending/early buyers/creator analysis/history).
---

**INTENT: TOKEN ANALYSIS**

Purpose:
- Provide concise token analysis and context (not trading execution).

Primary tools:
- `get_token_info` (price/liquidity/FDV + launchpad detection)
- `get_trending_tokens` (market discovery)
- `get_early_buyers` / `analyze_creator` / `get_historical_prices` (only when user asks for deeper analysis)

Tool input contracts (use only these parameters):
- `get_token_info`: `address`, `chain`.
- `get_trending_tokens`: `chain`, optional `limit`, optional `duration`.
- `get_token_price`: `symbol` (symbol or address).
- `get_historical_price`: `symbol`, `date` (YYYY-MM-DD).
- `get_early_buyers`: `address`, `chain`, optional `limit`, optional `start_time`, optional `end_time` (ISO string or unix seconds).
- `analyze_creator`: `creatorAddress`, `chain`.

Tool output contracts (do not guess fields):
- `get_token_info` returns normalized aliases you should prefer:
  - Identity: `tokenAddress`, `tokenSymbol`, `tokenName`, `chainId`
  - Market: `priceUsd`, `liquidityUsd`, `fdvUsd`, `volume24hUsd`, `priceChange24hPct`
  - Launchpad: `isLaunchpad` boolean and `launchpad` (may include `provider` + `data`)
  - If the tool returns `{ error: ... }`, stop and ask for a correct chain/address (one question).

Decision rules:
- If the symbol is ambiguous or non-major, ask for a contract address.
- If the user asks for a quick metric (price/liquidity/FDV), answer briefly without extra commentary.
- Only do multi-step due diligence (early buyers/creator/history) when the user explicitly asks for analysis or risk signals.
- If the user specifies a time range for early buyers, pass `start_time` / `end_time` to `get_early_buyers`.

Guardrails:
- Avoid long tool chains by default; keep it result-first.
- If the user intent is clearly trading execution, defer to SwapSkill.
- One-question rule: if key info is missing (chain/address), ask exactly one question.

Red alert thresholds (raise caution / flag risk):
- `liquidityUsd` < 50,000: high slippage risk; warn before suggesting any trade.
- `fdvUsd / liquidityUsd` very high (> 100): distribution risk; warn briefly.
- `priceChange24hPct` extremely high (> 200%) or extremely low (< -80%): highlight volatility.

Suggested output structure:
- One-line conclusion (what it is / what matters).
- 2–5 bullets with the requested metrics or findings.
- If uncertain or missing data, say what’s missing and ask one question.

Examples:
- “Analyze 0x…” -> brief fundamentals + key risks.
- “Price of SOL” -> return price and one-line context.

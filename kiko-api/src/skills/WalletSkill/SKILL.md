---
name: wallet_portfolio
description: Wallet portfolio, balances, favorites, and PNL analysis.
---

**INTENT: WALLET & PORTFOLIO MANAGEMENT**

Tool output contracts (do not guess fields):
- `get_wallet_info` returns `{ address, chain, ethBalance, tokens[] }` with tokens `symbol`, `balance`, `contract`.
- `analyze_wallet_pnl` returns `{ summary, topTokens[] }` with USD fields and `timeRange`.
- `get_user_favorites` returns `{ message, favorites[], count }`.

Tool input contracts (use only these parameters):
- `get_wallet_info`: optional `address`, optional `chain`, optional `includeHistory`.
- `analyze_wallet_pnl`: `address`, optional `chain`, optional `days`.
- `get_user_favorites`: no parameters.

1. **Portfolio Oversight**:
   - When the user asks "How much do I have?" or "Show my portfolio", use `get_wallet_info` to fetch balances and detailed distribution across chains.
   - Use the [User Context] provided in the prompt to avoid redundant API calls if the data is recent.

2. **Performance Analysis (PNL)**:
   - For queries about profit, loss, or performance (e.g., "Am I in profit?", "Show my PNL"), use `analyze_wallet_pnl`.
   - Explain the result clearly: "In the last 30 days, your realized PNL is [Amount], with a ROI of [Percentage]."
   - Distinguish between trading performance and capital movements if the tool provides that granularity.

3. **Favorites & Personalization**:
   - If the user asks about their watchlist or favorite tokens, use `get_user_favorites`.
   - You can cross-reference favorites with `get_token_price` from the TokenSkill if the user wants current prices for their watched assets.

4. **Self-Correction & Clarity**:
   - If the user doesn't have a wallet connected, guide them: "It looks like your wallet isn't connected. Please connect your wallet to see your balance."
   - Always clarify which chain you are reporting on if the user has assets across multiple networks.

Red alert thresholds (raise caution):
- If `get_wallet_info` returns empty tokens and near-zero balance, warn that the wallet appears empty.
- If `analyze_wallet_pnl` returns zero trades, say "no trade history in this period" instead of implying profit/loss.

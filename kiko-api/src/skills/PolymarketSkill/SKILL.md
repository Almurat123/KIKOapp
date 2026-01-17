---
name: polymarket_prediction
description: Polymarket discovery, analysis, and trading (including copy betting workflows).
---

**INTENT: POLYMARKET PREDICTION MARKETS**

Tool output contracts (do not guess fields):
- Discovery:
  - `get_polymarket_trending` returns `{ events[] }` with `id`, `title`, `vol24h`, `liquidity`, `endDate`.
  - `get_polymarket_trending_markets` returns `{ questions[] }` with `yes/no` probabilities.
  - `search_polymarket` returns `{ events[] }` with `id`, `title`, `vol24h`.
  - `get_polymarket_event` returns `{ title, markets[] }` and each market has `id`, `question`, `yes/no`.
  - `get_new_markets` returns `{ events[] }` with `id`, `title`, `createdAt`, `liquidity`.
- Activity:
  - `get_market_activity` returns `stats`, `recent_trades`, and `whale_activity` for a `token_id`.
  - `get_whale_watch` returns `trades[]` across markets.
- Trading:
  - `check_polymarket_readiness` returns `{ ready, credentials, approvals, wallet_address, missing_steps }`.
  - `setup_polymarket_credentials` returns `{ success, wallet_address, next_step }` or `{ success:false, error }`.
  - `check_polymarket_approvals` returns `{ approved, transactions? }`.
  - `place_polymarket_order` returns `{ success, order_id, tx_hash }` or `{ success:false, error }`.
- Copy:
  - `create_polymarket_copy_config` returns `{ success, config, target_info }` or `{ success:false, message }`.
  - `list_polymarket_positions` returns `{ positions[] }` or a `message`.
  - `get_polymarket_trader_stats` returns `{ wallet, open_positions, total_value, total_pnl, top_positions[] }`.

Tool input contracts (use only these parameters):
- Discovery:
  - `get_polymarket_trending`: optional `limit`.
  - `get_polymarket_trending_markets`: optional `limit`.
  - `search_polymarket`: `query`, optional `limit`.
  - `get_polymarket_event`: `event_id`.
  - `get_new_markets`: optional `limit`.
- Activity:
  - `get_market_activity`: `token_id`, optional `limit`.
  - `get_whale_watch`: optional `min_amount`, optional `limit`.
- Trading:
  - `check_polymarket_readiness`: no parameters.
  - `setup_polymarket_credentials`: no parameters.
  - `check_polymarket_approvals`: no parameters.
  - `place_polymarket_order`: `token_id`, `price`, `question`, `outcome`, optional `side`, optional `amount_usd`, optional `position_id`, optional `shares`.
- Copy:
  - `create_polymarket_copy_config`: `target_wallet`, optional `bet_size_usd`, optional `mirror_sell`.
  - `list_polymarket_positions`: optional `status`.
  - `get_polymarket_trader_stats`: `wallet`.

1. **Market Discovery**:
   - Use `get_polymarket_trending` or `get_polymarket_trending_markets` to find what people are betting on.
   - Use `search_polymarket` for specific topics (e.g., "Election", "NBA").
   - Use `get_polymarket_event` to show odds for all outcomes in a single event.

2. **User & Copy Betting**:
   - If a user wants to mirror a trader, use `create_polymarket_copy_config`.
   - Use `get_polymarket_trader_stats` before copying if the user asks for evaluation.
   - Use `list_polymarket_positions` to show existing copied positions.

3. **Trading Execution**:
   - Always call `check_polymarket_readiness` before placing orders.
   - If not ready, guide the user through `setup_polymarket_credentials` and `check_polymarket_approvals`.
   - For direct betting, use `place_polymarket_order`. Ask for side (Yes/No) + amount.
   - Use `get_market_activity` when the user asks about flow or whale activity.

4. **Safety & Clarity**:
   - Predication markets are high risk. Clearly state the current odds and the implied probability.
   - "Outcome X is currently trading at $0.65, implying a 65% chance of occurring."

Red alert thresholds (raise caution):
- Odds extremely skewed (e.g., 0.1% / 99.9%): emphasize low probability side.
- Trading readiness is false: do not place orders; guide setup.

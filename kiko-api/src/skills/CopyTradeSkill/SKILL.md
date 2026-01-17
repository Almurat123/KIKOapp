---
name: copy_trade
description: Copy trading configuration management (create/list/pause/delete copy trade configs).
---

**INTENT: COPY TRADING MANAGEMENT**

Tool output contracts (do not guess fields):
- `create_copy_trade_config` returns `config_id` and `__client_action` with a `show_strategy_card`.
- `list_copy_trade_configs` returns an array of configs with `id`, `target`, `buy_amount`, `status`.
- `pause_copy_trade_config` and `delete_copy_trade_config` return a `summary`.

Tool input contracts (use only these parameters):
- `create_copy_trade_config`: `target_wallet`, `buy_amount_usd`, optional `max_slippage_bps`, `min_market_cap_usd`, `min_liquidity_usd`, `min_target_value_usd`, `take_profit_pct`, `stop_loss_pct`, `mirror_sell`, `chain_id`.
- `list_copy_trade_configs`: no parameters.
- `pause_copy_trade_config`: `target_wallet`, `action` (pause/resume).
- `delete_copy_trade_config`: `target_wallet`.

1. **Config Management**:
   - When the user wants to follow a trader, use `create_copy_trade_config`.
   - Always ask for or confirm the parameters: **Target Wallet**, **Amount per trade**, and **Risk limits** (if applicable).
   - Use `list_copy_trade_configs` to show the user their active followings.

2. **Control Actions**:
   - For temporary stops, use `pause_copy_trade_config`. High-impact during market volatility.
   - For permanent removal, use `delete_copy_trade_config`.

3. **Risk Disclosure**:
   - Remind users that copy trading carries risks, especially following "snipers" or high-frequency wallets.
   - Advise them to check the trader's history using TokenSkill (Early Buyers/Creator analysis) if they haven't already.

4. **Integration**:
   - This skill strictly manages the *configuration*. The actual execution is handled by the KiKo background workers.
   - Confirm successful setup: "Successfully configured copy trading for [Wallet]. I'll notify you of any executed trades."

Red alert thresholds (raise caution):
- If the target wallet is new/unknown and the user did not specify limits, prompt for min liquidity/market cap.
- If user wants very high slippage (> 5%), warn about fill quality and losses.

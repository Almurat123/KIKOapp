**INTENT: GMGN SMART WALLET DISCOVERY**

Use this skill when user asks for smart wallets / profitable wallets / copytrade candidates from GMGN.

1. **Chain support**
   - `gmgn_get_smart_wallets` supports `base`, `eth`, `bsc`, `sol`.
   - For EVM chains, wallet address is `0x...`.
   - For Solana, wallet address is base58 format.

2. **How to tune parameters**
   - `window`: `1d | 7d | 30d` (default `7d`)
   - `orderby`: use a field matching window, e.g. `pnl_7d`, `realized_profit_7d`, `txs_7d`
   - `direction`: usually `desc` for top wallets
   - `tag`: e.g. `snipe_bot`, `sandwich_bot`
   - risk/quality filters:
     - `min_realized_profit`
     - `min_winrate` (0~1)
     - `min_balance`
     - `min_txs_count`, `min_buy_count`, `min_sell_count`
     - `required_tags` + `tag_match_mode(any|all)`
   - ranking mode:
     - `score_mode=composite` for balanced ranking (profit+winrate+activity)
     - `score_mode=none` to keep source order

3. **Recommended default query**
   - `chain=base`
   - `window=7d`
   - `tag=snipe_bot`
   - `orderby=pnl_7d`
   - `direction=desc`
   - `limit=20`
   - then add filters only if user asks.

4. **Two-step workflow**
   - Step A: call `gmgn_get_smart_wallets` to fetch and pre-filter.
   - Step B: if user provides an external wallet list, call `gmgn_filter_wallet_candidates`.

5. **Failure handling**
   - If GMGN returns HTML/challenge, retry with `cookie`.
   - If `sol` returns zero after filtering, check that wallet format is base58 and filters are not too strict.

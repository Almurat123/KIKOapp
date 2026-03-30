-- wallet_token_pnl_analysis
-- Parameters:
--   {{wallet_addr}}   text
--   {{blockchain}}    text   -- e.g. ethereum, base, bnb, arbitrum
--   {{days}}          number
--   {{token_address}} text
--
-- Purpose:
--   Single-wallet, single-token realized PnL view.
--   This is the dedicated query we eventually want to use instead of filtering
--   the generic wallet breakdown query in application code.
--
-- NOTE:
--   This template is kept in-repo because the current Dune API key does not
--   have Query Management permissions. Paste/adapt in the Dune UI when ready.

WITH matched_trades AS (
  SELECT
    blockchain,
    tx_hash,
    evt_index,
    tx_from,
    tx_to,
    taker,
    maker,
    token_bought_address,
    token_bought_symbol,
    token_sold_address,
    token_sold_symbol,
    amount_usd AS buy_usd,
    amount_usd AS sell_usd,
    block_time
  FROM dex.trades
  WHERE lower(blockchain) = lower({{blockchain}})
    AND block_time >= now() - INTERVAL '{{days}}' day
    AND (
      tx_from = from_hex(replace(lower({{wallet_addr}}), '0x', ''))
      OR tx_to = from_hex(replace(lower({{wallet_addr}}), '0x', ''))
      OR taker = from_hex(replace(lower({{wallet_addr}}), '0x', ''))
      OR maker = from_hex(replace(lower({{wallet_addr}}), '0x', ''))
    )
    AND (
      token_bought_address = from_hex(replace(lower({{token_address}}), '0x', ''))
      OR token_sold_address = from_hex(replace(lower({{token_address}}), '0x', ''))
    )
),
target_trades AS (
  SELECT
    blockchain,
    token_bought_address,
    token_bought_symbol,
    buy_usd,
    block_time AS buy_time
  FROM matched_trades
  WHERE token_bought_address = from_hex(replace(lower({{token_address}}), '0x', ''))
),
target_sells AS (
  SELECT
    blockchain,
    token_sold_address,
    token_sold_symbol,
    sell_usd,
    block_time AS sell_time
  FROM matched_trades
  WHERE token_sold_address = from_hex(replace(lower({{token_address}}), '0x', ''))
)
SELECT
  lower({{wallet_addr}}) AS wallet_address,
  lower({{blockchain}}) AS blockchain,
  lower({{token_address}}) AS token_address,
  COALESCE(max(token_bought_symbol), max(token_sold_symbol)) AS token_symbol,
  min(buy_time) AS first_buy_time,
  max(sell_time) AS last_sell_time,
  COALESCE(sum(buy_usd), 0) AS total_buy_usd,
  COALESCE(sum(sell_usd), 0) AS total_sell_usd,
  CASE
    WHEN count(buy_time) = 0 AND count(sell_time) > 0 THEN NULL
    WHEN count(sell_time) = 0 THEN 0
    ELSE COALESCE(sum(sell_usd), 0) - COALESCE(sum(buy_usd), 0)
  END AS realized_pnl_usd,
  CASE
    WHEN count(buy_time) = 0 AND count(sell_time) > 0 THEN NULL
    WHEN COALESCE(sum(buy_usd), 0) > 0 AND count(sell_time) > 0
      THEN (COALESCE(sum(sell_usd), 0) - COALESCE(sum(buy_usd), 0)) / sum(buy_usd) * 100
    ELSE NULL
  END AS profit_pct,
  count(buy_time) AS buy_tx_count,
  count(sell_time) AS sell_tx_count
FROM target_trades
FULL OUTER JOIN target_sells
  ON FALSE
GROUP BY 1, 2, 3;

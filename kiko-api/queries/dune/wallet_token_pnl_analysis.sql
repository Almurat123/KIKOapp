-- wallet_token_pnl_analysis
-- Parameters:
--   {{wallet_addr}}   text
--   {{blockchain}}    text
--   {{days}}          number
--   {{lookback_days}} number -- recommended: {{days}} + 365
--   {{token_address}} text
--
-- Purpose:
--   Return normalized buy/sell events for one wallet/token. Application code
--   should compute FIFO lots from these rows. SQL-only sell_usd - buy_usd is
--   not valid realized PNL when there are partial exits, carry-in positions, or
--   multi-hop dex.trades legs.

WITH input AS (
  SELECT
    from_hex(replace(lower({{wallet_addr}}), '0x', '')) AS wallet,
    from_hex(replace(lower({{token_address}}), '0x', '')) AS token
),
trade_legs AS (
  SELECT
    t.blockchain,
    t.block_time,
    t.block_month,
    t.block_number,
    t.tx_hash,
    t.evt_index,
    t.token_bought_address,
    t.token_bought_symbol,
    t.token_bought_amount,
    t.token_sold_address,
    t.token_sold_symbol,
    t.token_sold_amount,
    t.amount_usd
  FROM dex.trades t
  CROSS JOIN input i
  WHERE lower(t.blockchain) = lower({{blockchain}})
    AND t.block_month >= cast(date_trunc('month', now() - INTERVAL '{{lookback_days}}' day) AS date)
    AND t.block_time >= now() - INTERVAL '{{lookback_days}}' day
    AND t.block_time < now()
    AND t.amount_usd IS NOT NULL
    AND t.amount_usd > 0
    AND (t.tx_from = i.wallet OR t.taker = i.wallet)
    AND (t.token_bought_address = i.token OR t.token_sold_address = i.token)
),
events AS (
  SELECT
    blockchain,
    block_time,
    block_number,
    tx_hash,
    evt_index,
    concat('0x', lower(to_hex(token_bought_address))) AS token_address,
    token_bought_symbol AS token_symbol,
    'buy' AS side,
    token_bought_amount AS token_amount,
    amount_usd,
    block_time >= now() - INTERVAL '{{days}}' day AS in_window
  FROM trade_legs
  CROSS JOIN input i
  WHERE token_bought_address = i.token
    AND token_bought_amount IS NOT NULL
    AND token_bought_amount > 0

  UNION ALL

  SELECT
    blockchain,
    block_time,
    block_number,
    tx_hash,
    evt_index,
    concat('0x', lower(to_hex(token_sold_address))) AS token_address,
    token_sold_symbol AS token_symbol,
    'sell' AS side,
    token_sold_amount AS token_amount,
    amount_usd,
    block_time >= now() - INTERVAL '{{days}}' day AS in_window
  FROM trade_legs
  CROSS JOIN input i
  WHERE token_sold_address = i.token
    AND token_sold_amount IS NOT NULL
    AND token_sold_amount > 0
)
SELECT *
FROM events
ORDER BY block_time ASC, block_number ASC, tx_hash ASC, evt_index ASC, side ASC;

-- wallet_portfolio_token_breakdown
-- Parameters:
--   {{wallet_addr}} text
--   {{blockchain}}  text
--   {{days}}        number
--   {{lookback_days}} number -- recommended: {{days}} + 365
--
-- Purpose:
--   Return normalized buy/sell token events for a wallet. Do not aggregate
--   realized PNL in SQL: dex.trades is leg-level, so multi-hop swaps can create
--   false cost basis if amount_usd is summed directly.
--
-- Accounting:
--   Kiko computes FIFO lots in application code from these rows. If a sell
--   exceeds available historical lots, the token is marked as incomplete cost
--   basis instead of being reported as fake profit.

WITH input_wallet AS (
  SELECT from_hex(replace(lower({{wallet_addr}}), '0x', '')) AS wallet
),
window_legs AS (
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
  CROSS JOIN input_wallet w
  WHERE lower(t.blockchain) = lower({{blockchain}})
    AND t.block_month >= cast(date_trunc('month', now() - INTERVAL '{{days}}' day) AS date)
    AND t.block_time >= now() - INTERVAL '{{days}}' day
    AND t.block_time < now()
    AND t.amount_usd IS NOT NULL
    AND t.amount_usd > 0
    AND (t.tx_from = w.wallet OR t.taker = w.wallet)
),
tokens_needed AS (
  SELECT token_bought_address AS token_address
  FROM window_legs
  WHERE token_bought_address IS NOT NULL

  UNION

  SELECT token_sold_address AS token_address
  FROM window_legs
  WHERE token_sold_address IS NOT NULL
),
history_legs AS (
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
  CROSS JOIN input_wallet w
  WHERE lower(t.blockchain) = lower({{blockchain}})
    AND t.block_month >= cast(date_trunc('month', now() - INTERVAL '{{lookback_days}}' day) AS date)
    AND t.block_time >= now() - INTERVAL '{{lookback_days}}' day
    AND t.block_time < now() - INTERVAL '{{days}}' day
    AND t.amount_usd IS NOT NULL
    AND t.amount_usd > 0
    AND (t.tx_from = w.wallet OR t.taker = w.wallet)
    AND (
      t.token_bought_address IN (SELECT token_address FROM tokens_needed)
      OR t.token_sold_address IN (SELECT token_address FROM tokens_needed)
    )
),
trade_legs AS (
  SELECT * FROM history_legs
  UNION ALL
  SELECT * FROM window_legs
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
  WHERE token_bought_address IS NOT NULL
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
  WHERE token_sold_address IS NOT NULL
    AND token_sold_amount IS NOT NULL
    AND token_sold_amount > 0
)
SELECT *
FROM events
ORDER BY token_address ASC, block_time ASC, block_number ASC, tx_hash ASC, evt_index ASC, side ASC;

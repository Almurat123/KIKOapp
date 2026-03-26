-- wallet_portfolio_token_breakdown
-- Parameters:
--   {{wallet_addr}} text
--   {{blockchain}}  text
--   {{days}}        number
--
-- Purpose:
--   Single-wallet token-level breakdown over a time window.
--   This is the long-term dedicated portfolio-analysis query we want for
--   analyze_wallet_pnl_analysis.

WITH buys AS (
  SELECT
    lower(trader) AS wallet_address,
    lower(blockchain) AS blockchain,
    lower(token_bought_address) AS token_address,
    max(token_bought_symbol) AS token_symbol,
    sum(amount_usd) AS total_buy_usd,
    count(*) AS buy_tx_count
  FROM dex.trades
  WHERE lower(blockchain) = lower({{blockchain}})
    AND lower(trader) = lower({{wallet_addr}})
    AND block_time >= now() - INTERVAL '{{days}}' day
  GROUP BY 1, 2, 3
),
sells AS (
  SELECT
    lower(trader) AS wallet_address,
    lower(blockchain) AS blockchain,
    lower(token_sold_address) AS token_address,
    max(token_sold_symbol) AS token_symbol,
    sum(amount_usd) AS total_sell_usd,
    count(*) AS sell_tx_count
  FROM dex.trades
  WHERE lower(blockchain) = lower({{blockchain}})
    AND lower(trader) = lower({{wallet_addr}})
    AND block_time >= now() - INTERVAL '{{days}}' day
  GROUP BY 1, 2, 3
)
SELECT
  COALESCE(b.wallet_address, s.wallet_address) AS wallet_address,
  COALESCE(b.blockchain, s.blockchain) AS blockchain,
  COALESCE(b.token_address, s.token_address) AS token_address,
  COALESCE(b.token_symbol, s.token_symbol) AS token_symbol,
  COALESCE(b.total_buy_usd, 0) AS total_buy_usd,
  COALESCE(s.total_sell_usd, 0) AS total_sell_usd,
  COALESCE(s.total_sell_usd, 0) - COALESCE(b.total_buy_usd, 0) AS realized_pnl_usd,
  CASE
    WHEN COALESCE(b.total_buy_usd, 0) > 0
      THEN (COALESCE(s.total_sell_usd, 0) - COALESCE(b.total_buy_usd, 0)) / b.total_buy_usd * 100
    ELSE NULL
  END AS profit_pct,
  COALESCE(b.buy_tx_count, 0) AS buy_tx_count,
  COALESCE(s.sell_tx_count, 0) AS sell_tx_count
FROM buys b
FULL OUTER JOIN sells s
  ON b.wallet_address = s.wallet_address
 AND b.blockchain = s.blockchain
 AND b.token_address = s.token_address
ORDER BY abs(COALESCE(s.total_sell_usd, 0) - COALESCE(b.total_buy_usd, 0)) DESC;

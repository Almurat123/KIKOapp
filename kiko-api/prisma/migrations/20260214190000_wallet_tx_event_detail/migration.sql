-- Add detailed webhook/swap event fields for target-wallet debugging and PnL reconstruction
ALTER TABLE "wallet_transactions"
  ADD COLUMN IF NOT EXISTS "chain_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "token_in_address" TEXT,
  ADD COLUMN IF NOT EXISTS "token_out_address" TEXT,
  ADD COLUMN IF NOT EXISTS "amount_in" TEXT,
  ADD COLUMN IF NOT EXISTS "amount_out" TEXT,
  ADD COLUMN IF NOT EXISTS "value_in_usd" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "value_out_usd" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "parse_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT;

CREATE INDEX IF NOT EXISTS "wallet_transactions_chain_id_idx" ON "wallet_transactions"("chain_id");

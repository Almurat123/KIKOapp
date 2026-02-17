DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_tx_hash_wallet_address_key'
  ) THEN
    ALTER TABLE "wallet_transactions"
      DROP CONSTRAINT "wallet_transactions_tx_hash_wallet_address_key";
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_tx_hash_wallet_address_chain_key'
  ) THEN
    ALTER TABLE "wallet_transactions"
      ADD CONSTRAINT "wallet_transactions_tx_hash_wallet_address_chain_key"
      UNIQUE ("tx_hash", "wallet_address", "chain");
  END IF;
END$$;

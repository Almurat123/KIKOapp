ALTER TABLE "copytrade_orders"
ADD COLUMN "canonical_key" TEXT;

UPDATE "copytrade_orders"
SET "canonical_key" = concat_ws(
  ':',
  "chain_id"::text,
  lower(coalesce("tx_hash", '')),
  lower(coalesce("target_wallet", '')),
  coalesce("user_id", ''),
  coalesce("config_id", ''),
  lower(coalesce("direction", 'unknown'))
)
WHERE "canonical_key" IS NULL;

DROP INDEX IF EXISTS "copytrade_orders_identity_key";

CREATE UNIQUE INDEX "copytrade_orders_canonical_key"
ON "copytrade_orders"("canonical_key");

CREATE INDEX "idx_copytrade_orders_signal_identity"
ON "copytrade_orders"("chain_id", "tx_hash", "target_wallet");

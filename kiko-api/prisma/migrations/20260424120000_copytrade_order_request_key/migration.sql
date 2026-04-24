ALTER TABLE "copytrade_orders"
ADD COLUMN "request_key" TEXT,
ADD COLUMN "request_payload_hash" TEXT;

UPDATE "copytrade_orders"
SET
  "request_key" = md5(
    coalesce(
      "canonical_key",
      concat(
        '{"chainId":',
        "chain_id"::text,
        ',"configId":"',
        lower(coalesce("config_id", '')),
        '","scope":"copytrade-order-request-key-v1","targetWallet":"',
        lower(coalesce("target_wallet", '')),
        '","txHash":"',
        lower(coalesce("tx_hash", '')),
        '","userId":"',
        lower(coalesce("user_id", '')),
        '"}'
      )
    )
  )
WHERE "request_key" IS NULL;

ALTER TABLE "copytrade_orders"
ALTER COLUMN "request_key" SET NOT NULL;

CREATE UNIQUE INDEX "copytrade_orders_request_key"
ON "copytrade_orders"("request_key");

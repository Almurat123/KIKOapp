ALTER TABLE "TokenLaunchBaseline"
ADD COLUMN IF NOT EXISTS "baseline_block_number" BIGINT,
ADD COLUMN IF NOT EXISTS "baseline_tx_hash" TEXT,
ADD COLUMN IF NOT EXISTS "baseline_pool_address" TEXT,
ADD COLUMN IF NOT EXISTS "baseline_native_usd" DECIMAL,
ADD COLUMN IF NOT EXISTS "baseline_quoted_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "TokenLaunchpadProfile" (
  "id" TEXT PRIMARY KEY,
  "chain" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "launchpad" TEXT,
  "creator_address" TEXT,
  "creator_url" TEXT,
  "creator_label" TEXT,
  "source" TEXT,
  "verified_at" TIMESTAMP(3),
  "last_checked_at" TIMESTAMP(3),
  "retry_after" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "TokenLaunchpadProfile_chain_address_key"
ON "TokenLaunchpadProfile"("chain", "address");

CREATE INDEX IF NOT EXISTS "TokenLaunchpadProfile_chain_launchpad_idx"
ON "TokenLaunchpadProfile"("chain", "launchpad");

CREATE INDEX IF NOT EXISTS "TokenLaunchpadProfile_updated_at_idx"
ON "TokenLaunchpadProfile"("updated_at" DESC);

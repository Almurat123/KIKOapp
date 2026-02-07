-- Normalize core trading status columns and add consistency constraints.

DO $$ BEGIN
  CREATE TYPE "CopyTradeConfigStatus" AS ENUM ('active', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PolymarketConfigStatus" AS ENUM ('active', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PolymarketPositionStatus" AS ENUM ('open', 'closed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PolymarketActionStatus" AS ENUM ('pending', 'success', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PositionStatus" AS ENUM ('pending', 'open', 'closing', 'closed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SwapHistoryStatus" AS ENUM ('pending', 'success', 'failed', 'confirmed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE "CopyTradeConfig" SET "status" = LOWER(COALESCE("status", 'active'));
UPDATE "PolymarketCopyConfig" SET "status" = LOWER(COALESCE("status", 'active'));
UPDATE "PolymarketPosition" SET "status" = LOWER(COALESCE("status", 'open'));
UPDATE "PolymarketAction" SET "status" = LOWER(COALESCE("status", 'pending'));
UPDATE "Position" SET "status" = LOWER(COALESCE("status", 'open'));
UPDATE "SwapHistory" SET "status" = LOWER(COALESCE("status", 'pending'));

ALTER TABLE "CopyTradeConfig"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CopyTradeConfigStatus"
  USING (
    CASE
      WHEN "status" IN ('active', 'paused') THEN "status"::"CopyTradeConfigStatus"
      ELSE 'active'::"CopyTradeConfigStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "PolymarketCopyConfig"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PolymarketConfigStatus"
  USING (
    CASE
      WHEN "status" IN ('active', 'paused') THEN "status"::"PolymarketConfigStatus"
      ELSE 'active'::"PolymarketConfigStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "PolymarketPosition"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PolymarketPositionStatus"
  USING (
    CASE
      WHEN "status" IN ('open', 'closed', 'failed') THEN "status"::"PolymarketPositionStatus"
      ELSE 'open'::"PolymarketPositionStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'open';

ALTER TABLE "PolymarketAction"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PolymarketActionStatus"
  USING (
    CASE
      WHEN "status" IN ('pending', 'success', 'failed', 'cancelled') THEN "status"::"PolymarketActionStatus"
      ELSE 'pending'::"PolymarketActionStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "Position"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PositionStatus"
  USING (
    CASE
      WHEN "status" IN ('pending', 'open', 'closing', 'closed', 'failed') THEN "status"::"PositionStatus"
      ELSE 'open'::"PositionStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'open';

ALTER TABLE "SwapHistory"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SwapHistoryStatus"
  USING (
    CASE
      WHEN "status" IN ('pending', 'success', 'failed', 'confirmed', 'cancelled') THEN "status"::"SwapHistoryStatus"
      ELSE 'pending'::"SwapHistoryStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "Position" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "Position" SET "updatedAt" = COALESCE("updatedAt", "createdAt", NOW()) WHERE "updatedAt" IS NULL;
ALTER TABLE "Position"
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CopyTradeConfig"
  DROP CONSTRAINT IF EXISTS "CopyTradeConfig_buyAmountUsd_positive_chk",
  ADD CONSTRAINT "CopyTradeConfig_buyAmountUsd_positive_chk" CHECK ("buyAmountUsd" > 0),
  DROP CONSTRAINT IF EXISTS "CopyTradeConfig_maxSlippageBps_range_chk",
  ADD CONSTRAINT "CopyTradeConfig_maxSlippageBps_range_chk" CHECK ("maxSlippageBps" BETWEEN 1 AND 10000);

ALTER TABLE "Position"
  DROP CONSTRAINT IF EXISTS "Position_entry_non_negative_chk",
  ADD CONSTRAINT "Position_entry_non_negative_chk" CHECK ("entryPrice" >= 0 AND "entryUsdValue" >= 0),
  DROP CONSTRAINT IF EXISTS "Position_current_non_negative_chk",
  ADD CONSTRAINT "Position_current_non_negative_chk" CHECK (
    ("currentPrice" IS NULL OR "currentPrice" >= 0)
    AND ("peakPrice" IS NULL OR "peakPrice" >= 0)
    AND ("exitPrice" IS NULL OR "exitPrice" >= 0)
    AND ("exitUsdValue" IS NULL OR "exitUsdValue" >= 0)
  ),
  DROP CONSTRAINT IF EXISTS "Position_closed_requires_closedAt_chk",
  ADD CONSTRAINT "Position_closed_requires_closedAt_chk" CHECK (
    ("status" <> 'closed') OR ("closedAt" IS NOT NULL)
  );

ALTER TABLE "SwapHistory"
  DROP CONSTRAINT IF EXISTS "SwapHistory_amount_non_empty_chk",
  ADD CONSTRAINT "SwapHistory_amount_non_empty_chk" CHECK (char_length(trim("tokenInAmount")) > 0);

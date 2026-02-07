-- Phase 1 (non-breaking): add decimal dual-write columns for trade precision.

ALTER TABLE "Position"
  ADD COLUMN IF NOT EXISTS "entryPriceDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "entryAmountDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "entryUsdValueDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "currentPriceDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "exitAmountDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "exitPriceDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "exitUsdValueDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "realizedPnlPctDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "realizedPnlUsdDec" DECIMAL(38,18);

ALTER TABLE "SwapHistory"
  ADD COLUMN IF NOT EXISTS "tokenInAmountDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "tokenInUsdDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "tokenOutAmountDec" DECIMAL(38,18),
  ADD COLUMN IF NOT EXISTS "tokenOutUsdDec" DECIMAL(38,18);

-- Backfill Position
UPDATE "Position"
SET
  "entryPriceDec" = COALESCE("entryPriceDec", "entryPrice"::DECIMAL(38,18)),
  "entryUsdValueDec" = COALESCE("entryUsdValueDec", "entryUsdValue"::DECIMAL(38,18)),
  "currentPriceDec" = COALESCE("currentPriceDec", CASE WHEN "currentPrice" IS NULL THEN NULL ELSE "currentPrice"::DECIMAL(38,18) END),
  "exitPriceDec" = COALESCE("exitPriceDec", CASE WHEN "exitPrice" IS NULL THEN NULL ELSE "exitPrice"::DECIMAL(38,18) END),
  "exitUsdValueDec" = COALESCE("exitUsdValueDec", CASE WHEN "exitUsdValue" IS NULL THEN NULL ELSE "exitUsdValue"::DECIMAL(38,18) END),
  "realizedPnlPctDec" = COALESCE("realizedPnlPctDec", CASE WHEN "realizedPnlPct" IS NULL THEN NULL ELSE "realizedPnlPct"::DECIMAL(38,18) END),
  "realizedPnlUsdDec" = COALESCE("realizedPnlUsdDec", CASE WHEN "realizedPnlUsd" IS NULL THEN NULL ELSE "realizedPnlUsd"::DECIMAL(38,18) END)
WHERE TRUE;

UPDATE "Position"
SET "entryAmountDec" = COALESCE("entryAmountDec", NULLIF(REGEXP_REPLACE("entryAmount", '[^0-9eE+\-.]', '', 'g'), '')::DECIMAL(38,18))
WHERE "entryAmount" IS NOT NULL;

UPDATE "Position"
SET "exitAmountDec" = COALESCE("exitAmountDec", NULLIF(REGEXP_REPLACE("exitAmount", '[^0-9eE+\-.]', '', 'g'), '')::DECIMAL(38,18))
WHERE "exitAmount" IS NOT NULL;

-- Backfill SwapHistory
UPDATE "SwapHistory"
SET
  "tokenInUsdDec" = COALESCE("tokenInUsdDec", CASE WHEN "tokenInUsd" IS NULL THEN NULL ELSE "tokenInUsd"::DECIMAL(38,18) END),
  "tokenOutUsdDec" = COALESCE("tokenOutUsdDec", CASE WHEN "tokenOutUsd" IS NULL THEN NULL ELSE "tokenOutUsd"::DECIMAL(38,18) END)
WHERE TRUE;

UPDATE "SwapHistory"
SET "tokenInAmountDec" = COALESCE("tokenInAmountDec", NULLIF(REGEXP_REPLACE("tokenInAmount", '[^0-9eE+\-.]', '', 'g'), '')::DECIMAL(38,18))
WHERE "tokenInAmount" IS NOT NULL;

UPDATE "SwapHistory"
SET "tokenOutAmountDec" = COALESCE("tokenOutAmountDec", NULLIF(REGEXP_REPLACE("tokenOutAmount", '[^0-9eE+\-.]', '', 'g'), '')::DECIMAL(38,18))
WHERE "tokenOutAmount" IS NOT NULL;

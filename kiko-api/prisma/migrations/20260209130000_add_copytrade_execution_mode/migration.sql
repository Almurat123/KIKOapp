-- Add execution mode for copy trade safety tiers.
ALTER TABLE "CopyTradeConfig"
ADD COLUMN IF NOT EXISTS "executionMode" TEXT NOT NULL DEFAULT 'balanced';

-- Backfill from legacy toggle semantics.
UPDATE "CopyTradeConfig"
SET "executionMode" = 'turbo'
WHERE "disableTokenInfo" = true;

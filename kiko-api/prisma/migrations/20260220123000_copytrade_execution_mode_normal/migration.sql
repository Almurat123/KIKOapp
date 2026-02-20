-- Strict execution modes: safe | normal | turbo
UPDATE "CopyTradeConfig"
SET "executionMode" = 'normal'
WHERE "executionMode" = 'balanced'
   OR "executionMode" NOT IN ('safe', 'normal', 'turbo');

ALTER TABLE "CopyTradeConfig"
ALTER COLUMN "executionMode" SET DEFAULT 'normal';

ALTER TABLE "CopyTradeConfig"
DROP CONSTRAINT IF EXISTS "copytrade_execution_mode_valid";

ALTER TABLE "CopyTradeConfig"
ADD CONSTRAINT "copytrade_execution_mode_valid"
CHECK ("executionMode" IN ('safe', 'normal', 'turbo'));

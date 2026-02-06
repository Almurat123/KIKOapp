-- Baseline drift fix: bring migration history in sync with existing DB state

ALTER TABLE "ChatSession" ALTER COLUMN "model" SET DEFAULT 'grok-4-1-fast-reasoning';

DO $$ BEGIN
  ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "CopyTradeConfig"
  ADD COLUMN IF NOT EXISTS "dynamicTPMinProfitPct" DOUBLE PRECISION DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "enableDynamicTP" BOOLEAN DEFAULT false;

DO $$ BEGIN
  ALTER TABLE "PolymarketApiCreds" ADD CONSTRAINT "PolymarketApiCreds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Position"
  ADD COLUMN IF NOT EXISTS "dynamicTPTriggered" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "peakPrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "priceHistory" JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "Position_configId_idx" ON "Position"("configId");

DO $$ BEGIN
  ALTER TABLE "Position" ADD CONSTRAINT "Position_configId_fkey" FOREIGN KEY ("configId") REFERENCES "CopyTradeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP INDEX IF EXISTS "TrackedWallet_address_chainId_key";

DO $$ BEGIN
  ALTER TABLE "billing_blocks" ADD CONSTRAINT "billing_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "billing_consents" ADD CONSTRAINT "billing_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "billing_usage_ledger" ADD CONSTRAINT "billing_usage_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "daily_billing" ADD CONSTRAINT "daily_billing_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

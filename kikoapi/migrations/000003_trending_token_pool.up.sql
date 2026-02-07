-- AlterTable (idempotent to handle drifted prod schema)
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "feedback" TEXT;

-- AlterTable
ALTER TABLE "TrendingToken" ADD COLUMN IF NOT EXISTS "pool_created_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "zoraNotificationThreshold" INTEGER DEFAULT 5000;

-- AlterTable
ALTER TABLE "token_rules"
ADD COLUMN IF NOT EXISTS "action_amount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "chain_id" INTEGER NOT NULL DEFAULT 8453,
ADD COLUMN IF NOT EXISTS "last_triggered_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "target_type" TEXT NOT NULL DEFAULT 'price';

ALTER TABLE "token_rules" ALTER COLUMN "chain" SET DEFAULT 'base';

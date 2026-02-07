-- Add missing columns to quality_farcaster_users table
-- These columns exist in the Prisma schema but were never migrated to production

ALTER TABLE "quality_farcaster_users" 
ADD COLUMN IF NOT EXISTS "pfp" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "bio" TEXT,
ADD COLUMN IF NOT EXISTS "verifications" JSONB DEFAULT '[]';

-- Add missing columns and indexes to trending_casts table
ALTER TABLE "trending_casts"
ADD COLUMN IF NOT EXISTS "stats_last_updated_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "trending_casts_stats_last_updated_at_idx" ON "trending_casts"("stats_last_updated_at");
CREATE INDEX IF NOT EXISTS "trending_casts_timestamp_idx" ON "trending_casts"("timestamp");

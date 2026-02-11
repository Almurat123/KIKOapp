ALTER TABLE "TrendingToken"
ADD COLUMN IF NOT EXISTS "creator_address" TEXT,
ADD COLUMN IF NOT EXISTS "creator_url" TEXT,
ADD COLUMN IF NOT EXISTS "creator_label" TEXT;

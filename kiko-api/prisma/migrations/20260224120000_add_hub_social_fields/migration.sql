-- Migration: Add missing Farcaster Hub fields
-- Adds parentUrl, mentionsPositions, authorUrl, authorBanner, authorPrimaryAddress, authorLocation
-- to trending_casts. Adds url, banner, primaryAddress, location to quality_farcaster_users.

-- trending_casts
ALTER TABLE "trending_casts"
  ADD COLUMN IF NOT EXISTS "parent_url"           TEXT,
  ADD COLUMN IF NOT EXISTS "mentions_positions"   JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "author_url"           TEXT,
  ADD COLUMN IF NOT EXISTS "author_banner"        TEXT,
  ADD COLUMN IF NOT EXISTS "author_primary_address" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "author_location"      VARCHAR(100);

CREATE INDEX IF NOT EXISTS "trending_casts_parent_url_idx" ON "trending_casts"("parent_url");

-- quality_farcaster_users
ALTER TABLE "quality_farcaster_users"
  ADD COLUMN IF NOT EXISTS "url"              VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "banner"           VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "primary_address"  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "location"         VARCHAR(100);

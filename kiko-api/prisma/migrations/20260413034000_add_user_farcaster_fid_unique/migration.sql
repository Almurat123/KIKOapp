-- Add unique constraint for verified Farcaster user binding.
-- Postgres permits multiple NULL values under a unique index, so this keeps
-- unlinked users unchanged while enforcing one KiKo user per Farcaster FID.
CREATE UNIQUE INDEX "User_farcasterFid_key" ON "User"("farcasterFid");

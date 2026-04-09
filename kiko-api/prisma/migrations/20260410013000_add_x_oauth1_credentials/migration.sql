ALTER TABLE "x_oauth_credentials"
ADD COLUMN IF NOT EXISTS "oauth1_access_token" TEXT,
ADD COLUMN IF NOT EXISTS "oauth1_access_token_secret" TEXT,
ADD COLUMN IF NOT EXISTS "oauth1_authorized_at" TIMESTAMP;

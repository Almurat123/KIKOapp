ALTER TABLE "UserSettings"
    ADD COLUMN IF NOT EXISTS "defaultGeneratedImageModel" TEXT,
    ADD COLUMN IF NOT EXISTS "defaultGeneratedImageQuality" TEXT;

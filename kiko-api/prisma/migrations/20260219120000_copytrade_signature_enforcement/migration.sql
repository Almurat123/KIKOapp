-- CopyTrade signature-enforced configuration fields
ALTER TABLE "CopyTradeConfig"
ADD COLUMN IF NOT EXISTS "configPayload" JSONB,
ADD COLUMN IF NOT EXISTS "configHash" TEXT,
ADD COLUMN IF NOT EXISTS "configSignature" TEXT,
ADD COLUMN IF NOT EXISTS "signerAddress" TEXT,
ADD COLUMN IF NOT EXISTS "signedNonce" INTEGER,
ADD COLUMN IF NOT EXISTS "signatureScheme" TEXT NOT NULL DEFAULT 'eip712_v1',
ADD COLUMN IF NOT EXISTS "signatureVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "requiresResign" BOOLEAN NOT NULL DEFAULT false;

-- Force legacy configurations to be re-signed before execution.
UPDATE "CopyTradeConfig"
SET "status" = 'paused',
    "requiresResign" = true
WHERE COALESCE("configSignature", '') = '';

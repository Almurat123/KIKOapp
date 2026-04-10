ALTER TABLE "UserSettings"
ADD COLUMN IF NOT EXISTS "defaultChatModel" TEXT NOT NULL DEFAULT 'grok-4-1-fast-non-reasoning';

ALTER TABLE "ChatSession"
ALTER COLUMN "model" SET DEFAULT 'grok-4-1-fast-non-reasoning';

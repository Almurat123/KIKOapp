UPDATE "UserSettings"
SET "defaultChatModel" = 'gpt-5.4-mini-2026-03-17'
WHERE "defaultChatModel" = 'grok-4-1-fast-non-reasoning';

ALTER TABLE "UserSettings"
ALTER COLUMN "defaultChatModel" SET DEFAULT 'gpt-5.4-mini-2026-03-17';

ALTER TABLE "ChatSession"
ALTER COLUMN "model" SET DEFAULT 'gpt-5.4-mini-2026-03-17';

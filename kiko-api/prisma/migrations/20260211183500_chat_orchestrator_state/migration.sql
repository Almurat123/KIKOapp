-- Chat orchestrator state and compacted message storage
ALTER TABLE "ChatSession"
  ADD COLUMN IF NOT EXISTS "lastResponseId" TEXT,
  ADD COLUMN IF NOT EXISTS "compactionCursor" TEXT,
  ADD COLUMN IF NOT EXISTS "conversationStateVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ChatMessage"
  ADD COLUMN IF NOT EXISTS "compactedData" TEXT;

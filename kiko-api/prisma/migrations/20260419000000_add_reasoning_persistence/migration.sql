-- CONTEXT MEMORY
-- Updated: 2026-04-19
-- Author: Rowan
-- Reason: model selection must persist the paired reasoning level in the
--         production Prisma tables so refreshes reopen GPT-family sessions
--         with the same effort instead of falling back to the default.
-- Goal: align UserSettings and ChatSession storage with the frontend's local-
--       first restore path and the backend's persisted reasoning snapshot.
-- Owns: one-off production migration for default reasoning persistence and
--       session reasoning backfill.
-- Does Not Own: picker chrome, model policy, or per-request task routing.
-- Design Language:
-- - Backfill existing rows from the stored model id when reasoning was not yet persisted.
-- - Keep user settings and session rows on the same reasoning vocabulary.
-- - Do not rewrite unrelated session history.
-- Document Provenance:
-- - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
-- - Kind: repo doc
-- - Retrieved: 2026-04-19
-- - Applied To: production reasoning-level persistence migration

ALTER TABLE "UserSettings"
    ADD COLUMN IF NOT EXISTS "defaultChatReasoningLevel" TEXT;

ALTER TABLE "ChatSession"
    ADD COLUMN IF NOT EXISTS "reasoningLevel" TEXT;

UPDATE "UserSettings"
SET "defaultChatReasoningLevel" = CASE
    WHEN LOWER(COALESCE("defaultChatModel", '')) = 'gpt-5.4-mini-2026-03-17' THEN 'low'
    WHEN LOWER(COALESCE("defaultChatModel", '')) IN (
        'glm-5',
        'kimi-k2-5-reasoning',
        'grok-4-1-fast-reasoning'
    ) THEN 'thinking'
    ELSE 'fast'
END;

UPDATE "ChatSession"
SET "reasoningLevel" = CASE
    WHEN LOWER(COALESCE("model", '')) = 'gpt-5.4-mini-2026-03-17' THEN 'low'
    WHEN LOWER(COALESCE("model", '')) IN (
        'glm-5',
        'kimi-k2-5-reasoning',
        'grok-4-1-fast-reasoning'
    ) THEN 'thinking'
    ELSE 'fast'
END;

ALTER TABLE "UserSettings"
    ALTER COLUMN "defaultChatReasoningLevel" SET DEFAULT 'fast',
    ALTER COLUMN "defaultChatReasoningLevel" SET NOT NULL;

ALTER TABLE "ChatSession"
    ALTER COLUMN "reasoningLevel" SET DEFAULT 'fast',
    ALTER COLUMN "reasoningLevel" SET NOT NULL;

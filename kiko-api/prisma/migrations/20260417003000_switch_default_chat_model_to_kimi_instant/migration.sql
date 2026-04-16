-- CONTEXT MEMORY
-- Updated: 2026-04-17
-- Author: Almurat
-- Reason: the canonical product default model moved from GPT to free Kimi 2.5
--         Instant/Fast. Existing rows that still carry the previous GPT default
--         should follow the new default, while non-GPT user choices stay intact.
-- Goal: keep persisted user defaults and new chat-session database defaults
--       aligned with frontend/backend model normalization.
-- Owns: production database migration for the Kimi Instant default switch.
-- Does Not Own: explicit non-GPT user preferences or historical chat sessions.
-- Design Language:
-- - Only migrate rows equal to the previous canonical GPT default.
-- - Do not rewrite existing ChatSession history.
-- - Keep database defaults aligned with Prisma schema and chatModels.ts.
-- Document Provenance:
-- - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
-- - Kind: repo doc
-- - Retrieved: 2026-04-17
-- - Applied To: UserSettings and ChatSession database defaults
-- - Verification: verified in code
-- See also:
-- - /Users/almurat/KiKo/system-journal/INDEX.md
-- - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md

UPDATE "UserSettings"
SET "defaultChatModel" = 'kimi-k2-5-instant'
WHERE "defaultChatModel" = 'gpt-5.4-mini-2026-03-17';

ALTER TABLE "UserSettings"
ALTER COLUMN "defaultChatModel" SET DEFAULT 'kimi-k2-5-instant';

ALTER TABLE "ChatSession"
ALTER COLUMN "model" SET DEFAULT 'kimi-k2-5-instant';

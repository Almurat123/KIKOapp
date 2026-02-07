-- Remove legacy moderation event storage table and policy.

DROP TABLE IF EXISTS "ModerationLog";

DELETE FROM "DataRetentionPolicy"
WHERE "tableName" = 'ModerationLog';

-- Backfill after enum values are committed (Postgres enum safety rule).
UPDATE "Position"
SET "status" = 'pending_broadcast'
WHERE "status" = 'pending';

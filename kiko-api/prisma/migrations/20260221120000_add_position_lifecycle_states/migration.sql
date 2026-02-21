-- Position lifecycle states for copy-trade transaction visibility state machine.
ALTER TYPE "PositionStatus" ADD VALUE IF NOT EXISTS 'pending_broadcast';
ALTER TYPE "PositionStatus" ADD VALUE IF NOT EXISTS 'broadcasted_unseen';
ALTER TYPE "PositionStatus" ADD VALUE IF NOT EXISTS 'close_pending';
ALTER TYPE "PositionStatus" ADD VALUE IF NOT EXISTS 'failed_final';

-- Migrate legacy pending locks to the new explicit pre-broadcast state.
UPDATE "Position"
SET "status" = 'pending_broadcast'
WHERE "status" = 'pending';

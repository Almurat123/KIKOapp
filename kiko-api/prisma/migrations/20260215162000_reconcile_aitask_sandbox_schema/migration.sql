-- Reconcile schema drift between environments for AITask + sandbox task artifacts/events.
-- Safe to run multiple times.

-- 1) AITask columns expected by current Prisma client
ALTER TABLE "AITask"
  ADD COLUMN IF NOT EXISTS "executionMode" TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "sandboxJobId" TEXT;

-- 2) AITask index expected by schema
CREATE INDEX IF NOT EXISTS "AITask_sandboxJobId_idx" ON "AITask"("sandboxJobId");

-- 3) Sandbox artifact/event tables used by task execution pipeline
CREATE TABLE IF NOT EXISTS "sandbox_artifacts" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "uri" TEXT NOT NULL,
  "meta" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sandbox_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sandbox_job_events" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "phase" TEXT,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sandbox_job_events_pkey" PRIMARY KEY ("id")
);

-- 4) Constraints and indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sandbox_artifacts_task_id_fkey'
  ) THEN
    ALTER TABLE "sandbox_artifacts"
      ADD CONSTRAINT "sandbox_artifacts_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "AITask"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sandbox_job_events_task_id_fkey'
  ) THEN
    ALTER TABLE "sandbox_job_events"
      ADD CONSTRAINT "sandbox_job_events_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "AITask"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sandbox_artifacts_kind_idx" ON "sandbox_artifacts"("kind");
CREATE INDEX IF NOT EXISTS "sandbox_artifacts_task_id_idx" ON "sandbox_artifacts"("task_id");
CREATE INDEX IF NOT EXISTS "sandbox_job_events_task_id_idx" ON "sandbox_job_events"("task_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sandbox_job_events_task_id_seq_key" ON "sandbox_job_events"("task_id", "seq");

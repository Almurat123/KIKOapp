ALTER TABLE "Position"
ADD COLUMN IF NOT EXISTS "entry_amount_exact" TEXT,
ADD COLUMN IF NOT EXISTS "exit_amount_exact" TEXT;

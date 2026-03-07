ALTER TABLE "copytrade_position_ledger"
  ADD COLUMN IF NOT EXISTS "tracked_entry_raw" TEXT,
  ADD COLUMN IF NOT EXISTS "tracked_remaining_raw" TEXT,
  ADD COLUMN IF NOT EXISTS "tracked_sold_raw" TEXT,
  ADD COLUMN IF NOT EXISTS "last_mirrored_target_sell_tx_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "last_mirrored_ratio_bps" INTEGER,
  ADD COLUMN IF NOT EXISTS "external_balance_detected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "exit_execution_state" TEXT;

CREATE TABLE IF NOT EXISTS "target_sell_events" (
  "id" TEXT NOT NULL,
  "chain_id" INTEGER NOT NULL,
  "target_wallet" TEXT NOT NULL,
  "token_address" TEXT NOT NULL,
  "target_sell_tx_hash" TEXT NOT NULL,
  "target_sell_ratio_bps" INTEGER,
  "target_full_exit_verified" BOOLEAN NOT NULL DEFAULT false,
  "target_remaining_balance_raw" TEXT,
  "detected_at" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "target_sell_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "target_sell_events_identity_key"
  ON "target_sell_events"("chain_id", "target_wallet", "token_address", "target_sell_tx_hash");
CREATE INDEX IF NOT EXISTS "idx_target_sell_events_lookup"
  ON "target_sell_events"("chain_id", "target_wallet", "token_address", "updated_at" DESC);

CREATE TABLE IF NOT EXISTS "position_exit_intents" (
  "id" TEXT NOT NULL,
  "position_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "config_id" TEXT NOT NULL,
  "chain_id" INTEGER NOT NULL,
  "token_address" TEXT NOT NULL,
  "exit_reason" TEXT NOT NULL,
  "source_event_id" TEXT,
  "target_sell_tx_hash" TEXT,
  "desired_sell_raw" TEXT,
  "intent_version" INTEGER NOT NULL DEFAULT 1,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "lane" TEXT NOT NULL,
  "not_before" TIMESTAMP(3),
  "lifecycle_state" TEXT NOT NULL,
  "last_reason_code" TEXT,
  "identity_key" TEXT NOT NULL,
  "execution_tx_hash" TEXT,
  "claimed_by" TEXT,
  "claimed_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "position_exit_intents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "position_exit_intents_identity_key"
  ON "position_exit_intents"("identity_key");
CREATE INDEX IF NOT EXISTS "idx_position_exit_intents_lane"
  ON "position_exit_intents"("lane", "lifecycle_state", "not_before", "priority", "created_at" ASC);
CREATE INDEX IF NOT EXISTS "idx_position_exit_intents_position"
  ON "position_exit_intents"("position_id", "updated_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'position_exit_intents_source_event_id_fkey'
  ) THEN
    ALTER TABLE "position_exit_intents"
      ADD CONSTRAINT "position_exit_intents_source_event_id_fkey"
      FOREIGN KEY ("source_event_id") REFERENCES "target_sell_events"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

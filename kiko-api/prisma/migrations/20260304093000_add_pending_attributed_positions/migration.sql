CREATE TABLE IF NOT EXISTS "pending_attributed_positions" (
    "id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "token_address" TEXT NOT NULL,
    "entry_tx_hash" TEXT NOT NULL,
    "leader_buy_tx_hash" TEXT,
    "expected_amount_raw" TEXT,
    "expected_amount_dec" DECIMAL(38,18),
    "status" TEXT NOT NULL DEFAULT 'armed',
    "reason_code" TEXT,
    "target_sell_tx_hash" TEXT,
    "exit_tx_hash" TEXT,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pending_attributed_positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pending_attributed_positions_position_id_key"
    ON "pending_attributed_positions"("position_id");

CREATE INDEX IF NOT EXISTS "pending_attributed_positions_user_chain_token_status_idx"
    ON "pending_attributed_positions"("user_id", "chain_id", "token_address", "status");

CREATE INDEX IF NOT EXISTS "pending_attributed_positions_entry_tx_hash_idx"
    ON "pending_attributed_positions"("entry_tx_hash");

CREATE INDEX IF NOT EXISTS "pending_attributed_positions_target_sell_tx_hash_idx"
    ON "pending_attributed_positions"("target_sell_tx_hash");

ALTER TABLE "pending_attributed_positions"
    ADD CONSTRAINT "pending_attributed_positions_position_id_fkey"
    FOREIGN KEY ("position_id") REFERENCES "Position"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

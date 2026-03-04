CREATE TABLE "copytrade_position_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "token_address" TEXT NOT NULL,
    "target_wallet" TEXT NOT NULL,
    "leader_buy_tx_hash" TEXT,
    "target_sell_tx_hash" TEXT,
    "follower_buy_tx_hash" TEXT,
    "follower_exit_tx_hash" TEXT,
    "lifecycle_state" TEXT NOT NULL,
    "target_full_exit_verified" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_owned_amount_raw" TEXT,
    "pending_owned_amount_raw" TEXT,
    "effective_owned_amount_raw" TEXT,
    "sellable_amount_raw" TEXT,
    "last_execution_state" TEXT,
    "last_execution_reason_code" TEXT,
    "position_id_legacy" TEXT,
    "pending_lot_id_legacy" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "copytrade_position_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "copytrade_position_ledger_identity_key"
ON "copytrade_position_ledger"("user_id", "config_id", "chain_id", "token_address", "leader_buy_tx_hash");

CREATE UNIQUE INDEX "copytrade_position_ledger_position_id_legacy_key"
ON "copytrade_position_ledger"("position_id_legacy");

CREATE UNIQUE INDEX "copytrade_position_ledger_pending_lot_id_legacy_key"
ON "copytrade_position_ledger"("pending_lot_id_legacy");

CREATE INDEX "copytrade_position_ledger_user_id_lifecycle_state_idx"
ON "copytrade_position_ledger"("user_id", "lifecycle_state");

CREATE INDEX "copytrade_position_ledger_target_wallet_chain_id_token_address_idx"
ON "copytrade_position_ledger"("target_wallet", "chain_id", "token_address");

CREATE INDEX "copytrade_position_ledger_follower_buy_tx_hash_idx"
ON "copytrade_position_ledger"("follower_buy_tx_hash");

CREATE INDEX "copytrade_position_ledger_follower_exit_tx_hash_idx"
ON "copytrade_position_ledger"("follower_exit_tx_hash");

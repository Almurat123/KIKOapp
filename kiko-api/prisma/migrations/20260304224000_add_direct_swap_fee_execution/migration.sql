CREATE TABLE "direct_swap_fee_execution" (
    "id" TEXT NOT NULL,
    "fee_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "source_tx_hash" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "fee_token" TEXT NOT NULL,
    "fee_recipient" TEXT NOT NULL,
    "fee_bps" INTEGER NOT NULL,
    "fee_amount" TEXT,
    "fee_tx_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sending',
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_swap_fee_execution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "direct_swap_fee_execution_fee_key_key"
ON "direct_swap_fee_execution"("fee_key");

CREATE INDEX "idx_direct_swap_fee_exec_user_chain_created"
ON "direct_swap_fee_execution"("user_id", "chain_id", "created_at" DESC);

CREATE INDEX "idx_direct_swap_fee_exec_source_tx_hash"
ON "direct_swap_fee_execution"("source_tx_hash");

CREATE INDEX "idx_direct_swap_fee_exec_status_updated"
ON "direct_swap_fee_execution"("status", "updated_at" DESC);

CREATE TABLE "copytrade_orders" (
    "id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "target_wallet" TEXT NOT NULL,
    "token_in" TEXT NOT NULL,
    "token_out" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'unknown',
    "lifecycle_state" TEXT NOT NULL,
    "last_reason_code" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "user_id" TEXT,
    "config_id" TEXT,
    "detected_at" TIMESTAMP(3),
    "last_execution_at" TIMESTAMP(3),
    "metadata_json" JSONB,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copytrade_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "copytrade_order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "lifecycle_state" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copytrade_order_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "copytrade_order_executions" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tx_hash" TEXT,
    "reason_code" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copytrade_order_executions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "copytrade_orders_identity_key"
ON "copytrade_orders"("chain_id", "tx_hash", "target_wallet");

CREATE INDEX "idx_copytrade_orders_state_updated"
ON "copytrade_orders"("lifecycle_state", "updated_at" DESC);

CREATE INDEX "idx_copytrade_orders_user_created"
ON "copytrade_orders"("user_id", "created_at" DESC);

CREATE INDEX "idx_copytrade_orders_config_created"
ON "copytrade_orders"("config_id", "created_at" DESC);

CREATE INDEX "idx_copytrade_order_events_order_created"
ON "copytrade_order_events"("order_id", "created_at");

CREATE INDEX "idx_copytrade_order_events_reason_created"
ON "copytrade_order_events"("reason_code", "created_at" DESC);

CREATE UNIQUE INDEX "copytrade_order_executions_order_attempt_key"
ON "copytrade_order_executions"("order_id", "attempt_no");

CREATE INDEX "idx_copytrade_order_executions_status_created"
ON "copytrade_order_executions"("status", "created_at" DESC);

CREATE INDEX "idx_copytrade_order_executions_tx_hash"
ON "copytrade_order_executions"("tx_hash");

ALTER TABLE "copytrade_orders"
ADD CONSTRAINT "copytrade_orders_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("privyDid")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "copytrade_orders"
ADD CONSTRAINT "copytrade_orders_config_id_fkey"
FOREIGN KEY ("config_id") REFERENCES "CopyTradeConfig"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "copytrade_order_events"
ADD CONSTRAINT "copytrade_order_events_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "copytrade_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "copytrade_order_executions"
ADD CONSTRAINT "copytrade_order_executions_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "copytrade_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

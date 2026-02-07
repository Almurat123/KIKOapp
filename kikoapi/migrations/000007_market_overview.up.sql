-- AlterTable
ALTER TABLE "MarketOverview" ADD COLUMN     "btcDomChange24h" DECIMAL(65,30),
ADD COLUMN     "mcapChange24h" DECIMAL(65,30),
ADD COLUMN     "stablecoinsMcap" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "billing_usage_ledger" (
    "id" TEXT NOT NULL,
    "assistant_message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "model_category" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "tool_calls_count" INTEGER NOT NULL DEFAULT 0,
    "usd_cost" DECIMAL NOT NULL DEFAULT 0,
    "date_utc" DATE NOT NULL,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_usage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_billing" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date_utc" DATE NOT NULL,
    "total_usd" DECIMAL NOT NULL DEFAULT 0,
    "token_price_usd" DECIMAL NOT NULL DEFAULT 0,
    "tokens_due" DECIMAL NOT NULL DEFAULT 0,
    "token_address" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "tx_hash" TEXT,
    "failure_reason" TEXT,
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_blocks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date_utc" DATE NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "auth_key_id" TEXT,
    "terms_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "consented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_usage_ledger_assistant_message_id_key" ON "billing_usage_ledger"("assistant_message_id");

-- CreateIndex
CREATE INDEX "billing_usage_ledger_user_id_date_utc_idx" ON "billing_usage_ledger"("user_id", "date_utc");

-- CreateIndex
CREATE INDEX "billing_usage_ledger_model_category_idx" ON "billing_usage_ledger"("model_category");

-- CreateIndex
CREATE INDEX "daily_billing_user_id_date_utc_idx" ON "daily_billing"("user_id", "date_utc");

-- CreateIndex
CREATE UNIQUE INDEX "daily_billing_user_id_date_utc_key" ON "daily_billing"("user_id", "date_utc");

-- CreateIndex
CREATE INDEX "billing_blocks_user_id_date_utc_idx" ON "billing_blocks"("user_id", "date_utc");

-- CreateIndex
CREATE UNIQUE INDEX "billing_blocks_user_id_date_utc_key" ON "billing_blocks"("user_id", "date_utc");

-- CreateIndex
CREATE INDEX "billing_consents_user_id_idx" ON "billing_consents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_consents_user_id_chain_id_key" ON "billing_consents"("user_id", "chain_id");

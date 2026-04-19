-- CreateTable
CREATE TABLE "generated_image_usage_ledger" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "model_family" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "image_count" INTEGER NOT NULL DEFAULT 1,
    "free_image_count" INTEGER NOT NULL DEFAULT 0,
    "billed_image_count" INTEGER NOT NULL DEFAULT 0,
    "usd_cost" DECIMAL NOT NULL DEFAULT 0,
    "date_utc" DATE NOT NULL,
    "context_type" TEXT NOT NULL,
    "context_id" TEXT NOT NULL,
    "source" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_image_usage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generated_image_usage_ledger_request_id_key" ON "generated_image_usage_ledger"("request_id");

-- CreateIndex
CREATE INDEX "generated_image_usage_ledger_user_id_date_utc_idx" ON "generated_image_usage_ledger"("user_id", "date_utc");

-- CreateIndex
CREATE INDEX "generated_image_usage_ledger_model_family_status_idx" ON "generated_image_usage_ledger"("model_family", "status");

-- AddForeignKey
ALTER TABLE "generated_image_usage_ledger" ADD CONSTRAINT "generated_image_usage_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE CASCADE ON UPDATE CASCADE;

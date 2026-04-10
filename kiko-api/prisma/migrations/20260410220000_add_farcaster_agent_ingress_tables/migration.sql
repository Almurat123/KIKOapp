-- CreateTable
CREATE TABLE "farcaster_conversation_mappings" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'farcaster',
    "user_id" TEXT,
    "farcaster_fid" INTEGER NOT NULL,
    "farcaster_username" TEXT,
    "channel" TEXT NOT NULL,
    "root_cast_hash" TEXT,
    "parent_cast_hash" TEXT,
    "chat_session_id" TEXT NOT NULL,
    "round_trip_count" INTEGER NOT NULL DEFAULT 0,
    "rollover_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_inbound_at" TIMESTAMP(3),
    "last_outbound_at" TIMESTAMP(3),
    "last_inbound_cast_hash" TEXT,
    "last_outbound_cast_hash" TEXT,
    "last_inbound_event_id" TEXT,
    "last_outbound_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farcaster_conversation_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farcaster_event_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT,
    "farcaster_fid" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "source_id" TEXT,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'received',
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farcaster_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farcaster_message_deliveries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "farcaster_fid" INTEGER NOT NULL,
    "conversation_mapping_id" TEXT,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "source_message_id" TEXT,
    "provider_message_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farcaster_message_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "farcaster_conversation_mappings_user_id_status_idx" ON "farcaster_conversation_mappings"("user_id", "status");

-- CreateIndex
CREATE INDEX "farcaster_conversation_mappings_farcaster_fid_channel_sta_idx" ON "farcaster_conversation_mappings"("farcaster_fid", "channel", "status");

-- CreateIndex
CREATE INDEX "farcaster_conversation_mappings_root_cast_hash_idx" ON "farcaster_conversation_mappings"("root_cast_hash");

-- CreateIndex
CREATE UNIQUE INDEX "farcaster_event_logs_event_id_key" ON "farcaster_event_logs"("event_id");

-- CreateIndex
CREATE INDEX "farcaster_event_logs_farcaster_fid_channel_created_at_idx" ON "farcaster_event_logs"("farcaster_fid", "channel", "created_at" DESC);

-- CreateIndex
CREATE INDEX "farcaster_event_logs_status_created_at_idx" ON "farcaster_event_logs"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "farcaster_message_deliveries_idempotency_key_key" ON "farcaster_message_deliveries"("idempotency_key");

-- CreateIndex
CREATE INDEX "farcaster_message_deliveries_user_id_created_at_idx" ON "farcaster_message_deliveries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "farcaster_message_deliveries_fid_chan_created_idx" ON "farcaster_message_deliveries"("farcaster_fid", "channel", "created_at" DESC);

-- CreateIndex
CREATE INDEX "farcaster_message_deliveries_mapping_created_idx" ON "farcaster_message_deliveries"("conversation_mapping_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "farcaster_message_deliveries_status_created_at_idx" ON "farcaster_message_deliveries"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "farcaster_conversation_mappings" ADD CONSTRAINT "farcaster_conversation_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farcaster_conversation_mappings" ADD CONSTRAINT "farcaster_conversation_mappings_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farcaster_event_logs" ADD CONSTRAINT "farcaster_event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farcaster_message_deliveries" ADD CONSTRAINT "farcaster_message_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farcaster_message_deliveries" ADD CONSTRAINT "farcaster_message_deliveries_conversation_mapping_id_fkey" FOREIGN KEY ("conversation_mapping_id") REFERENCES "farcaster_conversation_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "xUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "xUsername" TEXT,
  ADD COLUMN IF NOT EXISTS "xLinkedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "xDmOptInAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "xAccessTokenRef" TEXT,
  ADD COLUMN IF NOT EXISTS "xRefreshTokenRef" TEXT,
  ADD COLUMN IF NOT EXISTS "xNotificationsMutedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'User_xUserId_key'
  ) THEN
    CREATE UNIQUE INDEX "User_xUserId_key" ON "User"("xUserId");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "x_conversation_mappings" (
  "id" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'x',
  "user_id" TEXT,
  "x_user_id" TEXT NOT NULL,
  "x_username" TEXT,
  "channel" TEXT NOT NULL,
  "root_tweet_id" TEXT,
  "x_dm_conversation_id" TEXT,
  "chat_session_id" TEXT NOT NULL,
  "round_trip_count" INTEGER NOT NULL DEFAULT 0,
  "rollover_count" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "last_inbound_at" TIMESTAMP(3),
  "last_outbound_at" TIMESTAMP(3),
  "last_inbound_message_id" TEXT,
  "last_outbound_message_id" TEXT,
  "last_inbound_event_id" TEXT,
  "last_outbound_event_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "x_conversation_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "x_event_logs" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "user_id" TEXT,
  "x_user_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "source_id" TEXT,
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'received',
  "error_message" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "x_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "x_message_deliveries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "x_user_id" TEXT NOT NULL,
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
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "x_message_deliveries_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'x_event_logs_event_id_key'
  ) THEN
    CREATE UNIQUE INDEX "x_event_logs_event_id_key" ON "x_event_logs"("event_id");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'x_message_deliveries_idempotency_key_key'
  ) THEN
    CREATE UNIQUE INDEX "x_message_deliveries_idempotency_key_key" ON "x_message_deliveries"("idempotency_key");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "x_conversation_mappings_user_id_status_idx" ON "x_conversation_mappings"("user_id", "status");
CREATE INDEX IF NOT EXISTS "x_conversation_mappings_x_user_id_channel_status_idx" ON "x_conversation_mappings"("x_user_id", "channel", "status");
CREATE INDEX IF NOT EXISTS "x_conversation_mappings_root_tweet_id_idx" ON "x_conversation_mappings"("root_tweet_id");
CREATE INDEX IF NOT EXISTS "x_conversation_mappings_x_dm_conversation_id_idx" ON "x_conversation_mappings"("x_dm_conversation_id");
CREATE INDEX IF NOT EXISTS "x_event_logs_x_user_id_channel_created_at_idx" ON "x_event_logs"("x_user_id", "channel", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "x_event_logs_status_created_at_idx" ON "x_event_logs"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "x_message_deliveries_user_id_created_at_idx" ON "x_message_deliveries"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "x_message_deliveries_x_user_id_channel_created_at_idx" ON "x_message_deliveries"("x_user_id", "channel", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "x_message_deliveries_conversation_mapping_id_created_at_idx" ON "x_message_deliveries"("conversation_mapping_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "x_message_deliveries_status_created_at_idx" ON "x_message_deliveries"("status", "created_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'x_conversation_mappings_user_id_fkey'
  ) THEN
    ALTER TABLE "x_conversation_mappings"
      ADD CONSTRAINT "x_conversation_mappings_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'x_conversation_mappings_chat_session_id_fkey'
  ) THEN
    ALTER TABLE "x_conversation_mappings"
      ADD CONSTRAINT "x_conversation_mappings_chat_session_id_fkey"
      FOREIGN KEY ("chat_session_id") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'x_event_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "x_event_logs"
      ADD CONSTRAINT "x_event_logs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'x_message_deliveries_user_id_fkey'
  ) THEN
    ALTER TABLE "x_message_deliveries"
      ADD CONSTRAINT "x_message_deliveries_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'x_message_deliveries_conversation_mapping_id_fkey'
  ) THEN
    ALTER TABLE "x_message_deliveries"
      ADD CONSTRAINT "x_message_deliveries_conversation_mapping_id_fkey"
      FOREIGN KEY ("conversation_mapping_id") REFERENCES "x_conversation_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

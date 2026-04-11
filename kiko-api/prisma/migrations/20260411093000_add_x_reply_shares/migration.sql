-- X reply shares let the bot respond on X with a safe public link instead of
-- posting full AI-generated text directly on the platform.
CREATE TABLE "x_reply_shares" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "user_id" TEXT,
  "x_user_id" TEXT NOT NULL,
  "conversation_mapping_id" TEXT,
  "chat_session_id" TEXT NOT NULL,
  "source_tweet_id" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "opened_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "x_reply_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "x_reply_shares_token_key" ON "x_reply_shares"("token");
CREATE INDEX "x_reply_shares_user_id_created_at_idx" ON "x_reply_shares"("user_id", "created_at" DESC);
CREATE INDEX "x_reply_shares_chat_session_id_created_at_idx" ON "x_reply_shares"("chat_session_id", "created_at" DESC);
CREATE INDEX "x_reply_shares_expires_at_idx" ON "x_reply_shares"("expires_at");

ALTER TABLE "x_reply_shares"
ADD CONSTRAINT "x_reply_shares_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("privyDid") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "x_reply_shares"
ADD CONSTRAINT "x_reply_shares_conversation_mapping_id_fkey"
FOREIGN KEY ("conversation_mapping_id") REFERENCES "x_conversation_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "x_reply_shares"
ADD CONSTRAINT "x_reply_shares_chat_session_id_fkey"
FOREIGN KEY ("chat_session_id") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "x_oauth_credentials" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'x',
    "bot_user_id" TEXT,
    "bot_username" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_type" TEXT,
    "scope" TEXT,
    "expires_at" TIMESTAMP(3),
    "last_authorized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "x_oauth_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "x_oauth_credentials_provider_key" ON "x_oauth_credentials"("provider");

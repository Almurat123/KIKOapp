-- CreateTable
CREATE TABLE "Chain" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "rpcUrl" TEXT,
    "explorerUrl" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "decimals" INTEGER,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "privyDid" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "solanaWalletAddress" TEXT,
    "farcasterFid" INTEGER,
    "farcasterUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "referralCode" TEXT,
    "referredBy" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainType" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" TEXT NOT NULL DEFAULT 'default',
    "defaultSwapAmount" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "defaultSwapUnit" TEXT NOT NULL DEFAULT 'native',
    "checkTokenBeforeSwap" BOOLEAN NOT NULL DEFAULT true,
    "quickSwapMode" BOOLEAN NOT NULL DEFAULT false,
    "swapMethod" TEXT NOT NULL DEFAULT 'swap_card',
    "slippageMode" TEXT NOT NULL DEFAULT 'auto',
    "customSlippage" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "mevProtection" BOOLEAN NOT NULL DEFAULT true,
    "priceDeviationCheck" BOOLEAN NOT NULL DEFAULT true,
    "copyTradeAIMode" TEXT NOT NULL DEFAULT 'disabled',
    "fastSwapMode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyTradeConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetWallet" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 8453,
    "buyAmountUsd" DOUBLE PRECISION NOT NULL,
    "maxSlippageBps" INTEGER NOT NULL DEFAULT 300,
    "minMarketCapUsd" DOUBLE PRECISION,
    "minLiquidityUsd" DOUBLE PRECISION,
    "minTargetValueUsd" DOUBLE PRECISION,
    "takeProfitPct" DOUBLE PRECISION,
    "stopLossPct" DOUBLE PRECISION,
    "mirrorSell" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "aiAnalysisMode" TEXT NOT NULL DEFAULT 'disabled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyTradeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyTradeAnalysis" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "aiDecision" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "analysisJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyTradeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedWallet" (
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "lastCheckedTx" TEXT,
    "activeConfigs" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastTradeAt" TIMESTAMP(3),
    "nickName" TEXT,
    "totalTradesTracked" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedWallet_pkey" PRIMARY KEY ("address","chainId")
);

-- CreateTable
CREATE TABLE "PolymarketCopyConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetWallet" TEXT NOT NULL,
    "betSizeUsd" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxOpenBets" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mirrorSell" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketCopyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" SERIAL NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'eth',
    "tx_hash" TEXT NOT NULL,
    "tx_type" TEXT NOT NULL,
    "from_address" TEXT,
    "to_address" TEXT,
    "token_symbol" TEXT,
    "token_address" TEXT,
    "token_in_symbol" TEXT,
    "token_out_symbol" TEXT,
    "amount" TEXT,
    "value_usd" DOUBLE PRECISION,
    "block_number" BIGINT,
    "block_timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolymarketPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "marketSlug" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "costBasis" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "profitLossPct" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'open',
    "exitReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PolymarketPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolymarketApiCreds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "passphrase" TEXT NOT NULL,
    "nonce" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketApiCreds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolymarketAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "marketTitle" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "assetId" TEXT,
    "orderId" TEXT,
    "txHash" TEXT,
    "size" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT,
    "chainId" INTEGER NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "entryAmount" TEXT NOT NULL,
    "entryTxHash" TEXT NOT NULL,
    "entryUsdValue" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "profitLossPct" DOUBLE PRECISION,
    "exitTxHash" TEXT,
    "exitReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "executionDelayMs" INTEGER,
    "exitAmount" TEXT,
    "exitPrice" DOUBLE PRECISION,
    "exitUsdValue" DOUBLE PRECISION,
    "holdDurationHours" DOUBLE PRECISION,
    "leaderBuyAmount" DOUBLE PRECISION,
    "leaderBuyPrice" DOUBLE PRECISION,
    "leaderBuyValueUsd" DOUBLE PRECISION,
    "leaderTxHash" TEXT,
    "ourGasPriceGwei" DOUBLE PRECISION,
    "ourGasUsed" TEXT,
    "ourSlippageBps" INTEGER,
    "realizedPnlPct" DOUBLE PRECISION,
    "realizedPnlUsd" DOUBLE PRECISION,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeExecutionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "configId" TEXT,
    "tokenAddress" TEXT,
    "chainId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'grok-2-1212',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reasoningContent" TEXT,
    "type" TEXT NOT NULL DEFAULT 'text',
    "data" TEXT,
    "transactionStatus" TEXT,
    "transactionHash" TEXT,
    "citations" TEXT,
    "usage" TEXT,
    "toolCalls" TEXT,
    "toolCallId" TEXT,
    "messageIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITask" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userMessageId" TEXT,
    "assistantMessageId" TEXT,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "toolContext" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AITask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageChunk" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkType" TEXT NOT NULL,
    "content" TEXT,
    "reasoningContent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "tokens" TEXT,
    "chains" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "paragraphId" TEXT,
    "paragraphUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "model" TEXT,
    "channel" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeDecision" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT,
    "tokenName" TEXT,
    "chainId" INTEGER NOT NULL,
    "userAmountUsd" DOUBLE PRECISION NOT NULL,
    "targetWallet" TEXT,
    "launchpadType" TEXT NOT NULL,
    "liquidity" DOUBLE PRECISION NOT NULL,
    "contractAgeHours" DOUBLE PRECISION NOT NULL,
    "userSizeLayer" JSONB NOT NULL,
    "liquidityLayer" JSONB NOT NULL,
    "structureLayer" JSONB NOT NULL,
    "stageLayer" JSONB NOT NULL,
    "tokenIntelLayer" JSONB NOT NULL,
    "finalDecision" TEXT NOT NULL,
    "overallRiskScore" DOUBLE PRECISION NOT NULL,
    "slippageEstimate" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "aiRationale" TEXT,
    "fullOutputJson" TEXT NOT NULL,
    "actualExecuted" BOOLEAN,
    "actualProfitPct" DOUBLE PRECISION,
    "actualOutcome" TEXT,
    "outcomeNotes" TEXT,
    "outcomeUpdatedAt" TIMESTAMP(3),
    "analysisTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cache" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "MarketOverview" (
    "id" SERIAL NOT NULL,
    "globalMarketCap" DECIMAL(65,30),
    "volume24h" DECIMAL(65,30),
    "activeUsers" BIGINT,
    "ethGasPrice" VARCHAR(50),
    "fearGreedIndex" INTEGER,
    "fearGreedClassification" VARCHAR(50),
    "bitcoinDominance" DECIMAL(65,30),
    "altcoinSeasonIndex" DECIMAL(65,30),
    "globalOpenInterest" DECIMAL(65,30),
    "gasLevel" DECIMAL(65,30),
    "gasLevelStatus" VARCHAR(20),
    "bvix" DECIMAL(65,30),
    "evix" DECIMAL(65,30),
    "liquidityStressIndex" DECIMAL(65,30),
    "liquidityStressStatus" VARCHAR(20),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOverview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainMetric" (
    "id" SERIAL NOT NULL,
    "chain_name" VARCHAR(50) NOT NULL,
    "tvl" DECIMAL(65,30),
    "tvl_change_24h" DECIMAL(65,30),
    "volume_24h" DECIMAL(65,30),
    "txns_24h" BIGINT,
    "pools_count" INTEGER,
    "tokens_count" INTEGER,
    "active_wallets" BIGINT,
    "gas_price" VARCHAR(50),
    "contracts24h" INTEGER,
    "contracts7d" INTEGER,
    "logo_url" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolMetric" (
    "id" SERIAL NOT NULL,
    "protocol_name" VARCHAR(100) NOT NULL,
    "protocol_symbol" VARCHAR(20),
    "category" VARCHAR(50),
    "tvl" DECIMAL(65,30),
    "tvl_change_1d" DECIMAL(65,30),
    "tvl_change_7d" DECIMAL(65,30),
    "volume_24h" DECIMAL(65,30),
    "chains" TEXT[],
    "mcap_tvl_ratio" DECIMAL(65,30),
    "logo_url" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendingToken" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'eth',
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "image_url" TEXT,
    "price" DECIMAL(65,30),
    "price_change_5m" DECIMAL(65,30),
    "price_change_1h" DECIMAL(65,30),
    "price_change_6h" DECIMAL(65,30),
    "price_change_24h" DECIMAL(65,30),
    "volume_24h" DECIMAL(65,30),
    "liquidity" DECIMAL(65,30),
    "fdv" DECIMAL(65,30),
    "rank" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trending_casts" (
    "cast_hash" TEXT NOT NULL,
    "fid" INTEGER NOT NULL,
    "author_username" TEXT,
    "author_display_name" TEXT,
    "author_avatar" TEXT,
    "author_verified" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "embeds" JSONB DEFAULT '[]',
    "parent_cast_fid" INTEGER,
    "parent_cast_hash" TEXT,
    "stats_likes" INTEGER NOT NULL DEFAULT 0,
    "stats_recasts" INTEGER NOT NULL DEFAULT 0,
    "stats_replies" INTEGER NOT NULL DEFAULT 0,
    "heat_score" DECIMAL(10,2),
    "rank" INTEGER,
    "is_base_app_coin" BOOLEAN NOT NULL DEFAULT false,
    "base_app_coin_metadata" JSONB,
    "coin_value" DECIMAL(65,30),
    "author_bio" TEXT,
    "mentions" JSONB DEFAULT '[]',
    "author_creator_coin" TEXT,
    "author_twitter" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trending_casts_pkey" PRIMARY KEY ("cast_hash")
);

-- CreateTable
CREATE TABLE "quality_farcaster_users" (
    "id" SERIAL NOT NULL,
    "fid" INTEGER NOT NULL,
    "username" VARCHAR(100),
    "display_name" VARCHAR(200),
    "followers" INTEGER NOT NULL DEFAULT 0,
    "following" INTEGER NOT NULL DEFAULT 0,
    "total_casts" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "source" VARCHAR(50) DEFAULT 'dune',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "has_creator_coin" BOOLEAN NOT NULL DEFAULT false,
    "creator_coin_address" VARCHAR(100),
    "last_coin_check" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_farcaster_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_rules" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "condition_value" DECIMAL(65,30) NOT NULL,
    "action" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderWalletStats" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "buyTrades" INTEGER NOT NULL DEFAULT 0,
    "sellTrades" INTEGER NOT NULL DEFAULT 0,
    "totalVolumeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedPnlUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unrealizedPnlUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPnlUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winCount" INTEGER NOT NULL DEFAULT 0,
    "lossCount" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestTradePnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "worstTradePnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgTradePnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstTradeAt" TIMESTAMP(3),
    "lastTradeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderWalletStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "logins" INTEGER NOT NULL DEFAULT 0,
    "chatMessages" INTEGER NOT NULL DEFAULT 0,
    "swapsCount" INTEGER NOT NULL DEFAULT 0,
    "swapVolumeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "copyTrades" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT,
    "tokenInAddress" TEXT NOT NULL,
    "tokenInSymbol" TEXT,
    "tokenInAmount" TEXT NOT NULL,
    "tokenInUsd" DOUBLE PRECISION,
    "tokenOutAddress" TEXT NOT NULL,
    "tokenOutSymbol" TEXT,
    "tokenOutAmount" TEXT,
    "tokenOutUsd" DOUBLE PRECISION,
    "slippageBps" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "aiSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "SwapHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReferral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "rewardStatus" TEXT NOT NULL DEFAULT 'pending',
    "rewardAmount" DOUBLE PRECISION,
    "rewardedAt" TIMESTAMP(3),
    "refereeSwapCount" INTEGER NOT NULL DEFAULT 0,
    "refereeSwapVolumeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCleanedAt" TIMESTAMP(3),
    "lastCleanedCount" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chain_name_key" ON "Chain"("name");

-- CreateIndex
CREATE INDEX "Token_symbol_idx" ON "Token"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Token_chainId_address_key" ON "Token"("chainId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "User_privyDid_key" ON "User"("privyDid");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "WalletExport_userId_idx" ON "WalletExport"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletExport_userId_walletAddress_key" ON "WalletExport"("userId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "CopyTradeConfig_targetWallet_idx" ON "CopyTradeConfig"("targetWallet");

-- CreateIndex
CREATE INDEX "CopyTradeConfig_userId_idx" ON "CopyTradeConfig"("userId");

-- CreateIndex
CREATE INDEX "CopyTradeAnalysis_configId_idx" ON "CopyTradeAnalysis"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedWallet_address_chainId_key" ON "TrackedWallet"("address", "chainId");

-- CreateIndex
CREATE INDEX "PolymarketCopyConfig_targetWallet_idx" ON "PolymarketCopyConfig"("targetWallet");

-- CreateIndex
CREATE INDEX "PolymarketCopyConfig_userId_idx" ON "PolymarketCopyConfig"("userId");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_address_idx" ON "wallet_transactions"("wallet_address");

-- CreateIndex
CREATE INDEX "wallet_transactions_block_timestamp_idx" ON "wallet_transactions"("block_timestamp");

-- CreateIndex
CREATE INDEX "wallet_transactions_chain_idx" ON "wallet_transactions"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_tx_hash_wallet_address_key" ON "wallet_transactions"("tx_hash", "wallet_address");

-- CreateIndex
CREATE INDEX "PolymarketPosition_userId_idx" ON "PolymarketPosition"("userId");

-- CreateIndex
CREATE INDEX "PolymarketPosition_status_idx" ON "PolymarketPosition"("status");

-- CreateIndex
CREATE INDEX "PolymarketPosition_conditionId_idx" ON "PolymarketPosition"("conditionId");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketApiCreds_userId_key" ON "PolymarketApiCreds"("userId");

-- CreateIndex
CREATE INDEX "PolymarketApiCreds_walletAddress_idx" ON "PolymarketApiCreds"("walletAddress");

-- CreateIndex
CREATE INDEX "PolymarketAction_userId_idx" ON "PolymarketAction"("userId");

-- CreateIndex
CREATE INDEX "PolymarketAction_createdAt_idx" ON "PolymarketAction"("createdAt");

-- CreateIndex
CREATE INDEX "Position_userId_idx" ON "Position"("userId");

-- CreateIndex
CREATE INDEX "Position_status_idx" ON "Position"("status");

-- CreateIndex
CREATE INDEX "Position_tokenAddress_idx" ON "Position"("tokenAddress");

-- CreateIndex
CREATE INDEX "TradeExecutionLog_userId_idx" ON "TradeExecutionLog"("userId");

-- CreateIndex
CREATE INDEX "TradeExecutionLog_tokenAddress_idx" ON "TradeExecutionLog"("tokenAddress");

-- CreateIndex
CREATE INDEX "TradeExecutionLog_status_idx" ON "TradeExecutionLog"("status");

-- CreateIndex
CREATE INDEX "TradeExecutionLog_createdAt_idx" ON "TradeExecutionLog"("createdAt");

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_messageIndex_idx" ON "ChatMessage"("messageIndex");

-- CreateIndex
CREATE INDEX "AITask_sessionId_idx" ON "AITask"("sessionId");

-- CreateIndex
CREATE INDEX "AITask_status_idx" ON "AITask"("status");

-- CreateIndex
CREATE INDEX "MessageChunk_messageId_idx" ON "MessageChunk"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageChunk_messageId_chunkIndex_key" ON "MessageChunk"("messageId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_slug_key" ON "NewsArticle"("slug");

-- CreateIndex
CREATE INDEX "NewsArticle_status_idx" ON "NewsArticle"("status");

-- CreateIndex
CREATE INDEX "NewsArticle_createdAt_idx" ON "NewsArticle"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationLog_userId_idx" ON "ModerationLog"("userId");

-- CreateIndex
CREATE INDEX "ModerationLog_sessionId_idx" ON "ModerationLog"("sessionId");

-- CreateIndex
CREATE INDEX "ModerationLog_createdAt_idx" ON "ModerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "JudgeDecision_tokenAddress_idx" ON "JudgeDecision"("tokenAddress");

-- CreateIndex
CREATE INDEX "JudgeDecision_chainId_idx" ON "JudgeDecision"("chainId");

-- CreateIndex
CREATE INDEX "JudgeDecision_finalDecision_idx" ON "JudgeDecision"("finalDecision");

-- CreateIndex
CREATE INDEX "JudgeDecision_createdAt_idx" ON "JudgeDecision"("createdAt");

-- CreateIndex
CREATE INDEX "FavoriteToken_userId_idx" ON "FavoriteToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteToken_userId_chain_address_key" ON "FavoriteToken"("userId", "chain", "address");

-- CreateIndex
CREATE INDEX "Cache_expiresAt_idx" ON "Cache"("expiresAt");

-- CreateIndex
CREATE INDEX "MarketOverview_updatedAt_idx" ON "MarketOverview"("updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ChainMetric_chain_name_key" ON "ChainMetric"("chain_name");

-- CreateIndex
CREATE INDEX "ChainMetric_updatedAt_idx" ON "ChainMetric"("updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolMetric_protocol_name_key" ON "ProtocolMetric"("protocol_name");

-- CreateIndex
CREATE INDEX "ProtocolMetric_category_idx" ON "ProtocolMetric"("category");

-- CreateIndex
CREATE INDEX "ProtocolMetric_updatedAt_idx" ON "ProtocolMetric"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "TrendingToken_rank_idx" ON "TrendingToken"("rank");

-- CreateIndex
CREATE INDEX "TrendingToken_updatedAt_idx" ON "TrendingToken"("updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TrendingToken_chain_address_key" ON "TrendingToken"("chain", "address");

-- CreateIndex
CREATE UNIQUE INDEX "quality_farcaster_users_fid_key" ON "quality_farcaster_users"("fid");

-- CreateIndex
CREATE INDEX "quality_farcaster_users_fid_idx" ON "quality_farcaster_users"("fid");

-- CreateIndex
CREATE INDEX "quality_farcaster_users_followers_idx" ON "quality_farcaster_users"("followers" DESC);

-- CreateIndex
CREATE INDEX "quality_farcaster_users_is_active_idx" ON "quality_farcaster_users"("is_active");

-- CreateIndex
CREATE INDEX "LeaderWalletStats_address_idx" ON "LeaderWalletStats"("address");

-- CreateIndex
CREATE INDEX "LeaderWalletStats_winRate_idx" ON "LeaderWalletStats"("winRate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderWalletStats_address_chainId_key" ON "LeaderWalletStats"("address", "chainId");

-- CreateIndex
CREATE INDEX "UserActivity_userId_idx" ON "UserActivity"("userId");

-- CreateIndex
CREATE INDEX "UserActivity_date_idx" ON "UserActivity"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivity_userId_date_key" ON "UserActivity"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SwapHistory_txHash_key" ON "SwapHistory"("txHash");

-- CreateIndex
CREATE INDEX "SwapHistory_userId_idx" ON "SwapHistory"("userId");

-- CreateIndex
CREATE INDEX "SwapHistory_chainId_idx" ON "SwapHistory"("chainId");

-- CreateIndex
CREATE INDEX "SwapHistory_status_idx" ON "SwapHistory"("status");

-- CreateIndex
CREATE INDEX "SwapHistory_createdAt_idx" ON "SwapHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserReferral_refereeId_key" ON "UserReferral"("refereeId");

-- CreateIndex
CREATE INDEX "UserReferral_referrerId_idx" ON "UserReferral"("referrerId");

-- CreateIndex
CREATE INDEX "UserReferral_referralCode_idx" ON "UserReferral"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "DataRetentionPolicy_tableName_key" ON "DataRetentionPolicy"("tableName");

-- AddForeignKey
ALTER TABLE "WalletExport" ADD CONSTRAINT "WalletExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTradeConfig" ADD CONSTRAINT "CopyTradeConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTradeAnalysis" ADD CONSTRAINT "CopyTradeAnalysis_configId_fkey" FOREIGN KEY ("configId") REFERENCES "CopyTradeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketCopyConfig" ADD CONSTRAINT "PolymarketCopyConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketPosition" ADD CONSTRAINT "PolymarketPosition_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PolymarketCopyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketPosition" ADD CONSTRAINT "PolymarketPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketAction" ADD CONSTRAINT "PolymarketAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITask" ADD CONSTRAINT "AITask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageChunk" ADD CONSTRAINT "MessageChunk_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteToken" ADD CONSTRAINT "FavoriteToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapHistory" ADD CONSTRAINT "SwapHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- KIKO Database Schema
-- Market Overview Data Table
CREATE TABLE IF NOT EXISTS market_overview (
  id SERIAL PRIMARY KEY,
  global_market_cap NUMERIC,
  volume_24h NUMERIC,
  active_users BIGINT,
  eth_gas_price VARCHAR(50),
  fear_greed_index INTEGER,
  fear_greed_classification VARCHAR(50),
  bitcoin_dominance NUMERIC,
  altcoin_season_index NUMERIC,
  global_open_interest NUMERIC,
  gas_level NUMERIC,
  gas_level_status VARCHAR(20),
  bvix NUMERIC,
  evix NUMERIC,
  liquidity_stress_index NUMERIC,
  liquidity_stress_status VARCHAR(20),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chain Metrics Table
CREATE TABLE IF NOT EXISTS chain_metrics (
  id SERIAL PRIMARY KEY,
  chain_name VARCHAR(50) UNIQUE NOT NULL,
  tvl NUMERIC,
  tvl_change_24h NUMERIC,
  volume_24h NUMERIC,
  txns_24h BIGINT,
  pools_count INTEGER,
  tokens_count INTEGER,
  active_wallets BIGINT,
  gas_price VARCHAR(50),
  logo_url TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Protocol Metrics Table
CREATE TABLE IF NOT EXISTS protocol_metrics (
  id SERIAL PRIMARY KEY,
  protocol_name VARCHAR(100) NOT NULL,
  protocol_symbol VARCHAR(20),
  category VARCHAR(50),
  tvl NUMERIC,
  tvl_change_1d NUMERIC,
  tvl_change_7d NUMERIC,
  volume_24h NUMERIC,
  chains TEXT[],
  mcap_tvl_ratio NUMERIC,
  logo_url TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(protocol_name)
);

-- Trending Tokens Table (for Ethereum chain initially)
CREATE TABLE IF NOT EXISTS trending_tokens (
  id SERIAL PRIMARY KEY,
  chain VARCHAR(50) NOT NULL DEFAULT 'eth',
  address VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  network VARCHAR(50) NOT NULL,
  price NUMERIC,
  price_change_5m NUMERIC,
  price_change_1h NUMERIC,
  price_change_6h NUMERIC,
  price_change_24h NUMERIC,
  volume_24h NUMERIC,
  liquidity NUMERIC,
  fdv NUMERIC,
  rank INTEGER,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chain, address)
);

-- Add new columns if they don't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trending_tokens' AND column_name='price_change_5m') THEN
    ALTER TABLE trending_tokens ADD COLUMN price_change_5m NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trending_tokens' AND column_name='price_change_1h') THEN
    ALTER TABLE trending_tokens ADD COLUMN price_change_1h NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trending_tokens' AND column_name='price_change_6h') THEN
    ALTER TABLE trending_tokens ADD COLUMN price_change_6h NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='protocol_metrics' AND column_name='logo_url') THEN
    ALTER TABLE protocol_metrics ADD COLUMN logo_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chain_metrics' AND column_name='logo_url') THEN
    ALTER TABLE chain_metrics ADD COLUMN logo_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallet_transactions' AND column_name='block_timestamp') THEN
    ALTER TABLE wallet_transactions ADD COLUMN block_timestamp TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallet_transactions' AND column_name='chain') THEN
    ALTER TABLE wallet_transactions ADD COLUMN chain VARCHAR(50) DEFAULT 'eth';
  END IF;
END $$;

-- Flash News Table
CREATE TABLE IF NOT EXISTS flash_news (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(200) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(100),
  level VARCHAR(20) DEFAULT 'normal',
  url TEXT,
  published_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- News Articles Table
CREATE TABLE IF NOT EXISTS news_articles (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(500) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  source VARCHAR(100) NOT NULL,
  source_logo VARCHAR(10),
  published_at TIMESTAMP NOT NULL,
  tags TEXT[],
  image_url TEXT,
  url TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


-- Trending Casts Table (Farcaster)
CREATE TABLE IF NOT EXISTS trending_casts (
  id SERIAL PRIMARY KEY,
  cast_hash VARCHAR(100) UNIQUE NOT NULL,
  fid INTEGER NOT NULL,
  author_username VARCHAR(100),
  author_display_name VARCHAR(200),
  author_avatar TEXT,
  author_verified BOOLEAN DEFAULT FALSE,
  text TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  embeds JSONB,
  parent_cast_fid INTEGER,
  parent_cast_hash VARCHAR(100),
  stats_likes INTEGER DEFAULT 0,
  stats_recasts INTEGER DEFAULT 0,
  stats_replies INTEGER DEFAULT 0,
  heat_score NUMERIC(5, 2) DEFAULT 0,
  rank INTEGER,
  is_base_app_coin BOOLEAN DEFAULT FALSE,
  base_app_coin_metadata JSONB,
  coin_value NUMERIC,
  author_bio TEXT,
  mentions JSONB,
  author_creator_coin TEXT,
  author_twitter TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- User Management Tables (Sync with Prisma)
-- =============================================

-- User linked to Privy
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "privyDid" TEXT UNIQUE NOT NULL,
  "walletAddress" TEXT UNIQUE NOT NULL,
  "email" TEXT UNIQUE,
  "solanaWalletAddress" TEXT,
  "referralCode" TEXT UNIQUE,
  "referredBy" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Wallet Key Export Record
CREATE TABLE IF NOT EXISTS "WalletExport" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "walletAddress" TEXT NOT NULL,
  "chainType" TEXT NOT NULL,
  "exportedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("userId", "walletAddress")
);

-- User Settings
CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "userRole" TEXT DEFAULT 'default',
  "defaultSwapAmount" DOUBLE PRECISION DEFAULT 100,
  "defaultSwapUnit" TEXT DEFAULT 'native',
  "checkTokenBeforeSwap" BOOLEAN DEFAULT TRUE,
  "quickSwapMode" BOOLEAN DEFAULT FALSE,
  "swapMethod" TEXT DEFAULT 'swap_card',
  "slippageMode" TEXT DEFAULT 'auto',
  "customSlippage" DOUBLE PRECISION DEFAULT 0.5,
  "mevProtection" BOOLEAN DEFAULT TRUE,
  "priceDeviationCheck" BOOLEAN DEFAULT TRUE,
  "copyTradeAIMode" TEXT DEFAULT 'disabled',
  "fastSwapMode" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Wallet Transaction History (Sync with Prisma model name)
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
  "id" SERIAL PRIMARY KEY,
  "walletAddress" TEXT NOT NULL,
  "chain" TEXT DEFAULT 'eth',
  "txHash" TEXT NOT NULL,
  "txType" TEXT NOT NULL,
  "fromAddress" TEXT,
  "toAddress" TEXT,
  "tokenSymbol" TEXT,
  "tokenAddress" TEXT,
  "tokenInSymbol" TEXT,
  "tokenOutSymbol" TEXT,
  "amount" TEXT,
  "valueUsd" DOUBLE PRECISION,
  "blockNumber" BIGINT,
  "blockTimestamp" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("txHash", "walletAddress")
);

-- Tracked Wallet
CREATE TABLE IF NOT EXISTS "TrackedWallet" (
  "address" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "lastCheckedTx" TEXT,
  "activeConfigs" INTEGER DEFAULT 0,
  total_trades_tracked INTEGER DEFAULT 0,
  last_trade_at TIMESTAMP,
  nick_name TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY ("address", "chainId")
);

-- Copy Trade Configuration
CREATE TABLE IF NOT EXISTS "CopyTradeConfig" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "targetWallet" TEXT NOT NULL,
  "chainId" INTEGER DEFAULT 8453,
  "buyAmountUsd" DOUBLE PRECISION NOT NULL,
  "maxSlippageBps" INTEGER DEFAULT 300,
  "minMarketCapUsd" DOUBLE PRECISION,
  "minLiquidityUsd" DOUBLE PRECISION,
  "minTargetValueUsd" DOUBLE PRECISION,
  "takeProfitPct" DOUBLE PRECISION,
  "stopLossPct" DOUBLE PRECISION,
  "mirrorSell" BOOLEAN DEFAULT TRUE,
  "status" TEXT DEFAULT 'active',
  "aiAnalysisMode" TEXT DEFAULT 'disabled',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Position Table
CREATE TABLE IF NOT EXISTS "Position" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "configId" TEXT NOT NULL,
  "tokenAddress" TEXT NOT NULL,
  "tokenSymbol" TEXT,
  "chainId" INTEGER NOT NULL,
  "entryPrice" DOUBLE PRECISION NOT NULL,
  "entryAmount" TEXT NOT NULL,
  "entryTxHash" TEXT NOT NULL,
  "entryUsdValue" DOUBLE PRECISION NOT NULL,
  currentPrice DOUBLE PRECISION,
  profitLossPct DOUBLE PRECISION,
  leaderTxHash TEXT,
  leaderBuyPrice DOUBLE PRECISION,
  leaderBuyAmount DOUBLE PRECISION,
  leaderBuyValueUsd DOUBLE PRECISION,
  ourSlippageBps INTEGER,
  exitPrice DOUBLE PRECISION,
  exitAmount TEXT,
  exitUsdValue DOUBLE PRECISION,
  status TEXT DEFAULT 'open',
  createdAt TIMESTAMP DEFAULT NOW(),
  closedAt TIMESTAMP
);

-- Create indexes for the new Prisma-aligned tables
CREATE INDEX IF NOT EXISTS "idx_User_privyDid" ON "User"("privyDid");
CREATE INDEX IF NOT EXISTS "idx_WalletExport_userId" ON "WalletExport"("userId");
CREATE INDEX IF NOT EXISTS "idx_CopyTradeConfig_userId" ON "CopyTradeConfig"("userId");
CREATE INDEX IF NOT EXISTS "idx_Position_userId" ON "Position"("userId");
CREATE INDEX IF NOT EXISTS "idx_Position_status" ON "Position"("status");

-- Legacy Indexes (matching original sql structure)
CREATE INDEX IF NOT EXISTS idx_market_overview_updated_at ON market_overview(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chain_metrics_updated_at ON chain_metrics(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_protocol_metrics_updated_at ON protocol_metrics(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_protocol_metrics_category ON protocol_metrics(category);
CREATE INDEX IF NOT EXISTS idx_trending_tokens_chain ON trending_tokens(chain);
CREATE INDEX IF NOT EXISTS idx_trending_tokens_updated_at ON trending_tokens(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_tokens_rank ON trending_tokens(chain, rank);
CREATE INDEX IF NOT EXISTS idx_flash_news_published_at ON flash_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_flash_news_level ON flash_news(level);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_articles_tags ON news_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_trending_casts_heat_score ON trending_casts(heat_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_casts_rank ON trending_casts(rank);
CREATE INDEX IF NOT EXISTS idx_trending_casts_timestamp ON trending_casts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trending_casts_fid ON trending_casts(fid);

-- =============================================
-- Wallet Monitor Tables
-- =============================================

-- User watched wallets
CREATE TABLE IF NOT EXISTS watched_wallets (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,  -- Privy user ID
  address VARCHAR(100) NOT NULL,
  alias VARCHAR(100),
  labels TEXT[],
  chain VARCHAR(50) DEFAULT 'eth',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, address)
);

-- Wallet groups (strategies)
CREATE TABLE IF NOT EXISTS wallet_groups (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#71717a',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallet-group membership (many-to-many)
CREATE TABLE IF NOT EXISTS wallet_group_members (
  wallet_id INTEGER REFERENCES watched_wallets(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES wallet_groups(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (wallet_id, group_id)
);

-- Cached wallet transactions (for feed display)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(100) NOT NULL,
  chain VARCHAR(50) DEFAULT 'eth',
  tx_hash VARCHAR(100) NOT NULL,
  tx_type VARCHAR(20) NOT NULL,  -- BUY, SELL, SWAP, TRANSFER
  from_address VARCHAR(100),
  to_address VARCHAR(100),
  token_symbol VARCHAR(50),
  token_address VARCHAR(100),
  token_in_symbol VARCHAR(50),
  token_out_symbol VARCHAR(50),
  amount VARCHAR(100),
  value_usd NUMERIC,
  block_number BIGINT,
  block_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tx_hash, wallet_address)
);

-- Indexes for wallet tables
CREATE INDEX IF NOT EXISTS idx_watched_wallets_user_id ON watched_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_wallets_address ON watched_wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallet_groups_user_id ON wallet_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_address ON wallet_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_timestamp ON wallet_transactions(block_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_chain ON wallet_transactions(chain);

-- =============================================
-- Quality Farcaster Users Table
-- =============================================

-- Stores high-quality Farcaster users discovered from Dune Analytics
CREATE TABLE IF NOT EXISTS quality_farcaster_users (
  id SERIAL PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL,
  username VARCHAR(100),
  display_name VARCHAR(200),
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  total_casts INTEGER DEFAULT 0,
  engagement_rate NUMERIC(10, 4) DEFAULT 0,
  source VARCHAR(50) DEFAULT 'dune',  -- dune, manual, snapchain
  is_active BOOLEAN DEFAULT TRUE,
  has_creator_coin BOOLEAN DEFAULT FALSE,
  creator_coin_address VARCHAR(100),
  last_coin_check TIMESTAMP,
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for quality users
CREATE INDEX IF NOT EXISTS idx_quality_users_fid ON quality_farcaster_users(fid);
CREATE INDEX IF NOT EXISTS idx_quality_users_followers ON quality_farcaster_users(followers DESC);
CREATE INDEX IF NOT EXISTS idx_quality_users_active ON quality_farcaster_users(is_active);
CREATE INDEX IF NOT EXISTS idx_quality_users_source ON quality_farcaster_users(source);

-- Add new columns if they don't exist (must be BEFORE index on these columns)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quality_farcaster_users' AND column_name='has_creator_coin') THEN
    ALTER TABLE quality_farcaster_users ADD COLUMN has_creator_coin BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quality_farcaster_users' AND column_name='creator_coin_address') THEN
    ALTER TABLE quality_farcaster_users ADD COLUMN creator_coin_address VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quality_farcaster_users' AND column_name='last_coin_check') THEN
    ALTER TABLE quality_farcaster_users ADD COLUMN last_coin_check TIMESTAMP;
  END IF;
END $$;

-- Index on coin column (after column exists)
CREATE INDEX IF NOT EXISTS idx_quality_users_coin ON quality_farcaster_users(has_creator_coin);


-- =============================================
-- Favorites and AI Rules Tables
-- =============================================

-- User Favorite Tokens
CREATE TABLE IF NOT EXISTS favorite_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL, -- Privy user ID
  chain VARCHAR(50) NOT NULL DEFAULT 'eth',
  address VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, chain, address)
);

-- AI Token Rules (e.g., Auto-buy conditions)
CREATE TABLE IF NOT EXISTS token_rules (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  address VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- e.g., 'PRICE_DROP', 'PRICE_RISE'
  condition_value NUMERIC NOT NULL, -- e.g., 30 for 30%
  action VARCHAR(50) NOT NULL, -- e.g., 'BUY', 'NOTIFY'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for favorites and rules
CREATE INDEX IF NOT EXISTS idx_favorite_tokens_user ON favorite_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_token_rules_user ON token_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_token_rules_token ON token_rules(chain, address);

-- =============================================
-- Chat Architecture: Backend-Task-Based System
-- =============================================

-- Chat Sessions (Conversations)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,  -- Privy user ID (DID)
  title VARCHAR(500) DEFAULT 'New Chat',
  model VARCHAR(50) DEFAULT 'deepseek-chat',
  status VARCHAR(20) DEFAULT 'active',  -- active, archived
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- user, assistant, system, tool
  content TEXT NOT NULL DEFAULT '',
  reasoning_content TEXT,  -- For thinking mode (DeepSeek Reasoner, Grok Reasoning)
  citations JSONB,  -- Array of citation URLs
  usage JSONB,  -- Token usage stats {prompt_tokens, completion_tokens, total_tokens}
  tool_calls JSONB,  -- Tool calls made by assistant
  tool_call_id VARCHAR(100),  -- For tool response messages
  message_index INTEGER NOT NULL,  -- Order within session
  status VARCHAR(20) DEFAULT 'complete',  -- streaming, complete, error
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI Tasks (for background execution)
CREATE TABLE IF NOT EXISTS ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  assistant_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  model VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'queued',  -- queued, running, done, error, cancelled
  error_message TEXT,
  tool_context JSONB,  -- {userId, walletAddress, chainId} for tool execution
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Message Chunks (for streaming persistence)
CREATE TABLE IF NOT EXISTS message_chunks (
  id SERIAL PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT,
  reasoning_content TEXT,
  chunk_type VARCHAR(20) DEFAULT 'content',  -- content, reasoning, tool_call, tool_result, citation
  metadata JSONB,  -- Additional data (tool name, status, etc.)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, chunk_index)
);

-- Indexes for Chat System
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_order ON chat_messages(session_id, message_index);
CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_session ON ai_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created ON ai_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_message_chunks_message ON message_chunks(message_id, chunk_index);

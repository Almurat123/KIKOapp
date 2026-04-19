-- Billing tables for usage-based charging

CREATE TABLE IF NOT EXISTS billing_usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_message_id UUID UNIQUE NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  model VARCHAR(50) NOT NULL,
  model_category VARCHAR(20) NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  tool_calls_count INTEGER DEFAULT 0,
  usd_cost NUMERIC DEFAULT 0,
  date_utc DATE NOT NULL,
  is_free BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_user_date ON billing_usage_ledger(user_id, date_utc);
CREATE INDEX IF NOT EXISTS idx_billing_usage_category ON billing_usage_ledger(model_category);

CREATE TABLE IF NOT EXISTS generated_image_usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(100) UNIQUE NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  model VARCHAR(50) NOT NULL,
  model_family VARCHAR(50) NOT NULL,
  quality VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'reserved',
  image_count INTEGER DEFAULT 1,
  free_image_count INTEGER DEFAULT 0,
  billed_image_count INTEGER DEFAULT 0,
  usd_cost NUMERIC DEFAULT 0,
  date_utc DATE NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  context_id VARCHAR(100) NOT NULL,
  source VARCHAR(50),
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_image_usage_user_date ON generated_image_usage_ledger(user_id, date_utc);
CREATE INDEX IF NOT EXISTS idx_generated_image_usage_family_status ON generated_image_usage_ledger(model_family, status);

CREATE TABLE IF NOT EXISTS daily_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  date_utc DATE NOT NULL,
  total_usd NUMERIC DEFAULT 0,
  token_price_usd NUMERIC DEFAULT 0,
  tokens_due NUMERIC DEFAULT 0,
  token_address VARCHAR(100) NOT NULL,
  chain_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  tx_hash TEXT,
  failure_reason TEXT,
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date_utc)
);

CREATE INDEX IF NOT EXISTS idx_daily_billing_user_date ON daily_billing(user_id, date_utc);

CREATE TABLE IF NOT EXISTS billing_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  date_utc DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date_utc)
);

CREATE INDEX IF NOT EXISTS idx_billing_blocks_user_date ON billing_blocks(user_id, date_utc);

CREATE TABLE IF NOT EXISTS billing_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  wallet_address VARCHAR(100) NOT NULL,
  chain_id INTEGER NOT NULL,
  auth_key_id TEXT,
  terms_version TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  consented_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_consents_user ON billing_consents(user_id);

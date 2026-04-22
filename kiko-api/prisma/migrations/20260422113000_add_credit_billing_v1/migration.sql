ALTER TABLE generated_image_usage_ledger
ADD COLUMN IF NOT EXISTS free_request_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE REFERENCES "User"("privyDid") ON DELETE CASCADE,
    available_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    reserved_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "User"("privyDid") ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
    deposit_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'detected',
    chain_id INTEGER NOT NULL,
    asset_symbol TEXT NOT NULL,
    token_address TEXT,
    from_address TEXT,
    to_address TEXT,
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL DEFAULT 0,
    amount_raw TEXT NOT NULL,
    amount_human NUMERIC(20, 8) NOT NULL DEFAULT 0,
    price_usd NUMERIC(20, 8) NOT NULL DEFAULT 0,
    usd_value NUMERIC(20, 8) NOT NULL DEFAULT 0,
    paid_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    bonus_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    remaining_paid_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    remaining_bonus_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    held_paid_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    held_bonus_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    confirmations INTEGER NOT NULL DEFAULT 0,
    required_confirmations INTEGER NOT NULL DEFAULT 1,
    metadata JSONB,
    credited_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_credit_deposits_user_status_created
    ON credit_deposits(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_deposits_account_status
    ON credit_deposits(account_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_deposits_chain_asset_status
    ON credit_deposits(chain_id, asset_symbol, status);

CREATE TABLE IF NOT EXISTS credit_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "User"("privyDid") ON DELETE CASCADE,
    entry_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    paid_credits_delta NUMERIC(20, 8) NOT NULL DEFAULT 0,
    bonus_credits_delta NUMERIC(20, 8) NOT NULL DEFAULT 0,
    available_after_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    reserved_after_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_entries_user_created
    ON credit_ledger_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_entries_account_created
    ON credit_ledger_entries(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_entries_source
    ON credit_ledger_entries(source_type, source_id);

CREATE TABLE IF NOT EXISTS credit_ledger_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_entry_id UUID NOT NULL REFERENCES credit_ledger_entries(id) ON DELETE CASCADE,
    deposit_id UUID NOT NULL REFERENCES credit_deposits(id) ON DELETE CASCADE,
    paid_credits_delta NUMERIC(20, 8) NOT NULL DEFAULT 0,
    bonus_credits_delta NUMERIC(20, 8) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(ledger_entry_id, deposit_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_allocations_deposit_created
    ON credit_ledger_allocations(deposit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "User"("privyDid") ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
    deposit_id UUID NOT NULL UNIQUE REFERENCES credit_deposits(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    chain_id INTEGER NOT NULL,
    asset_symbol TEXT NOT NULL,
    token_address TEXT,
    refund_to_address TEXT NOT NULL,
    requested_paid_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    reclaimed_bonus_credits NUMERIC(20, 8) NOT NULL DEFAULT 0,
    refund_amount_human NUMERIC(20, 8) NOT NULL DEFAULT 0,
    payout_tx_hash TEXT,
    failure_reason TEXT,
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_refund_requests_user_status_created
    ON credit_refund_requests(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_refund_requests_account_status
    ON credit_refund_requests(account_id, status);

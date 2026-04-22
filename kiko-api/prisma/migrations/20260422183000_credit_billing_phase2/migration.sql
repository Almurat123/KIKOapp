ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';

ALTER TABLE credit_refund_requests
ADD COLUMN IF NOT EXISTS approved_by_user_id TEXT;

ALTER TABLE credit_refund_requests
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

ALTER TABLE credit_refund_requests
ADD COLUMN IF NOT EXISTS approved_note TEXT;

ALTER TABLE credit_refund_requests
ADD COLUMN IF NOT EXISTS resolved_by_user_id TEXT;

ALTER TABLE credit_refund_requests
ADD COLUMN IF NOT EXISTS resolved_note TEXT;

CREATE TABLE IF NOT EXISTS credit_deposit_watcher_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watcher_key TEXT NOT NULL UNIQUE,
    chain_id INTEGER NOT NULL,
    payment_address TEXT NOT NULL,
    cursor_block TEXT,
    last_webhook_block TEXT,
    last_webhook_at TIMESTAMP,
    last_reconciled_at TIMESTAMP,
    stats JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_deposit_watcher_states_chain_payment
    ON credit_deposit_watcher_states(chain_id, payment_address);

// Package repositories: Billing data access (from kiko-api repositories/billingRepository.ts).

package repositories

import (
	"context"

	"gorm.io/gorm"
)

// BillingRepository handles billing_usage_ledger, billing_blocks, daily_billing, billing_consents.
type BillingRepository struct {
	db *gorm.DB
}

// NewBillingRepository creates a BillingRepository.
func NewBillingRepository(db *gorm.DB) *BillingRepository {
	return &BillingRepository{db: db}
}

// GetDailyUsageCount returns count of usage records for user/date/modelCategory.
func (r *BillingRepository) GetDailyUsageCount(ctx context.Context, userID, dateUtc, modelCategory string) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).Raw(
		`SELECT COUNT(*) FROM billing_usage_ledger WHERE user_id = ? AND date_utc = ?::date AND model_category = ?`,
		userID, dateUtc, modelCategory,
	).Scan(&count).Error
	return int(count), err
}

// GetDailyTotalUsageCount returns total usage count for user/date.
func (r *BillingRepository) GetDailyTotalUsageCount(ctx context.Context, userID, dateUtc string) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).Raw(
		`SELECT COUNT(*) FROM billing_usage_ledger WHERE user_id = ? AND date_utc = ?::date`,
		userID, dateUtc,
	).Scan(&count).Error
	return int(count), err
}

// GetDailyPaidUsdTotal returns sum of paid usd_cost for user/date.
func (r *BillingRepository) GetDailyPaidUsdTotal(ctx context.Context, userID, dateUtc string) (float64, error) {
	var total *float64
	err := r.db.WithContext(ctx).Raw(
		`SELECT COALESCE(SUM(usd_cost), 0) FROM billing_usage_ledger WHERE user_id = ? AND date_utc = ?::date AND is_free = FALSE`,
		userID, dateUtc,
	).Scan(&total).Error
	if err != nil {
		return 0, err
	}
	if total == nil {
		return 0, nil
	}
	return *total, nil
}

// InsertUsageRecordParams holds params for InsertUsageRecord.
type InsertUsageRecordParams struct {
	AssistantMessageID string
	UserID             string
	Model              string
	ModelCategory      string
	PromptTokens       int
	CompletionTokens   int
	TotalTokens        int
	ToolCallsCount     int
	UsdCost            float64
	DateUtc            string
	IsFree             bool
}

// InsertUsageRecord inserts a row into billing_usage_ledger (ON CONFLICT DO NOTHING).
func (r *BillingRepository) InsertUsageRecord(ctx context.Context, p InsertUsageRecordParams) error {
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO billing_usage_ledger (
			id, assistant_message_id, user_id, model, model_category,
			prompt_tokens, completion_tokens, total_tokens, tool_calls_count,
			usd_cost, date_utc, is_free
		) VALUES (
			gen_random_uuid(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::date, ?
		) ON CONFLICT (assistant_message_id) DO NOTHING`,
		p.AssistantMessageID, p.UserID, p.Model, p.ModelCategory,
		p.PromptTokens, p.CompletionTokens, p.TotalTokens, p.ToolCallsCount,
		p.UsdCost, p.DateUtc, p.IsFree,
	).Error
}

// HasBillingBlock returns true if a block exists for user/date.
func (r *BillingRepository) HasBillingBlock(ctx context.Context, userID, dateUtc string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Raw(
		`SELECT COUNT(*) FROM billing_blocks WHERE user_id = ? AND date_utc = ?::date`,
		userID, dateUtc,
	).Scan(&count).Error
	return count > 0, err
}

// CreateBillingBlock inserts a billing block.
func (r *BillingRepository) CreateBillingBlock(ctx context.Context, userID, dateUtc, reason string) error {
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO billing_blocks (user_id, date_utc, reason) VALUES (?, ?, ?) ON CONFLICT (user_id, date_utc) DO NOTHING`,
		userID, dateUtc, reason,
	).Error
}

// ClearBillingBlock deletes the block for user/date.
func (r *BillingRepository) ClearBillingBlock(ctx context.Context, userID, dateUtc string) error {
	return r.db.WithContext(ctx).Exec(
		`DELETE FROM billing_blocks WHERE user_id = ? AND date_utc = ?::date`,
		userID, dateUtc,
	).Error
}

// DailyAggregate holds user_id and total_usd for a date.
type DailyAggregate struct {
	UserID   string
	TotalUsd float64
}

// GetDailyAggregates returns per-user paid totals for a date.
func (r *BillingRepository) GetDailyAggregates(ctx context.Context, dateUtc string) ([]DailyAggregate, error) {
	var out []DailyAggregate
	err := r.db.WithContext(ctx).Raw(
		`SELECT user_id, COALESCE(SUM(usd_cost), 0) AS total_usd FROM billing_usage_ledger WHERE date_utc = ?::date AND is_free = FALSE GROUP BY user_id`,
		dateUtc,
	).Scan(&out).Error
	return out, err
}

// UpsertDailyBillingParams for upserting daily_billing.
type UpsertDailyBillingParams struct {
	UserID        string
	DateUtc       string
	TotalUsd      float64
	TokenPriceUsd float64
	TokensDue     float64
	TokenAddress  string
	ChainID       int
}

// UpsertDailyBilling inserts or updates daily_billing.
func (r *BillingRepository) UpsertDailyBilling(ctx context.Context, p UpsertDailyBillingParams) error {
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO daily_billing (user_id, date_utc, total_usd, token_price_usd, tokens_due, token_address, chain_id, status)
		 VALUES (?, ?::date, ?, ?, ?, ?, ?, 'pending')
		 ON CONFLICT (user_id, date_utc) DO UPDATE SET
		 total_usd = EXCLUDED.total_usd, token_price_usd = EXCLUDED.token_price_usd, tokens_due = EXCLUDED.tokens_due,
		 token_address = EXCLUDED.token_address, chain_id = EXCLUDED.chain_id, updated_at = NOW()`,
		p.UserID, p.DateUtc, p.TotalUsd, p.TokenPriceUsd, p.TokensDue, p.TokenAddress, p.ChainID,
	).Error
}

// GetDailyBillingStatus returns status and tx_hash for user/date.
func (r *BillingRepository) GetDailyBillingStatus(ctx context.Context, userID, dateUtc string) (status string, txHash *string, err error) {
	var row struct {
		Status string
		TxHash *string
	}
	err = r.db.WithContext(ctx).Raw(
		`SELECT status, tx_hash FROM daily_billing WHERE user_id = ? AND date_utc = ?::date LIMIT 1`,
		userID, dateUtc,
	).Scan(&row).Error
	if err != nil {
		return "", nil, err
	}
	return row.Status, row.TxHash, nil
}

// UpdateDailyBillingStatusParams for updating status.
type UpdateDailyBillingStatusParams struct {
	UserID        string
	DateUtc       string
	Status        string
	Attempts      int
	TxHash        *string
	FailureReason *string
}

// UpdateDailyBillingStatus updates daily_billing status/attempts/tx_hash/failure_reason.
func (r *BillingRepository) UpdateDailyBillingStatus(ctx context.Context, p UpdateDailyBillingStatusParams) error {
	return r.db.WithContext(ctx).Exec(
		`UPDATE daily_billing SET status = ?, attempts = ?, tx_hash = ?, failure_reason = ?, last_attempt_at = NOW(), updated_at = NOW()
		 WHERE user_id = ? AND date_utc = ?::date`,
		p.Status, p.Attempts, p.TxHash, p.FailureReason, p.UserID, p.DateUtc,
	).Error
}

// GetActiveBillingConsent returns id and terms_version for user/chainId if active.
func (r *BillingRepository) GetActiveBillingConsent(ctx context.Context, userID string, chainID int) (id, termsVersion string, ok bool, err error) {
	var row struct {
		ID           string
		TermsVersion string
	}
	err = r.db.WithContext(ctx).Raw(
		`SELECT id, terms_version FROM billing_consents WHERE user_id = ? AND chain_id = ? AND status = 'active' LIMIT 1`,
		userID, chainID,
	).Scan(&row).Error
	if err != nil {
		return "", "", false, err
	}
	return row.ID, row.TermsVersion, row.ID != "", nil
}

// UpsertBillingConsentParams for consent upsert.
type UpsertBillingConsentParams struct {
	UserID       string
	WalletAddress string
	ChainID      int
	AuthKeyID    *string
	TermsVersion string
	Source       *string
}

// UpsertBillingConsent inserts or updates billing_consents.
func (r *BillingRepository) UpsertBillingConsent(ctx context.Context, p UpsertBillingConsentParams) error {
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO billing_consents (user_id, wallet_address, chain_id, auth_key_id, terms_version, status, consented_at, source)
		 VALUES (?, ?, ?, ?, ?, 'active', NOW(), ?)
		 ON CONFLICT (user_id, chain_id) DO UPDATE SET
		 wallet_address = EXCLUDED.wallet_address, auth_key_id = EXCLUDED.auth_key_id, terms_version = EXCLUDED.terms_version,
		 status = 'active', consented_at = NOW(), revoked_at = NULL, source = EXCLUDED.source, updated_at = NOW()`,
		p.UserID, p.WalletAddress, p.ChainID, p.AuthKeyID, p.TermsVersion, p.Source,
	).Error
}

// RevokeBillingConsent sets status to revoked for user/chainId.
func (r *BillingRepository) RevokeBillingConsent(ctx context.Context, userID string, chainID int) error {
	return r.db.WithContext(ctx).Exec(
		`UPDATE billing_consents SET status = 'revoked', revoked_at = NOW(), updated_at = NOW() WHERE user_id = ? AND chain_id = ?`,
		userID, chainID,
	).Error
}

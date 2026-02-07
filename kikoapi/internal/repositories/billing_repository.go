// Package repositories: Billing data access (stub; full impl from kiko-api repositories/billingRepository.ts).

package repositories

import "context"

// BillingRepository handles billing-related tables (BillingUsageLedger, DailyBilling, etc.).
type BillingRepository struct{}

// NewBillingRepository creates a BillingRepository.
func NewBillingRepository() *BillingRepository {
	return &BillingRepository{}
}

// InsertUsageRecord is a stub for inserting usage into billing_usage_ledger.
func (r *BillingRepository) InsertUsageRecord(ctx context.Context, userId, assistantMessageId, model, modelCategory string, promptTokens, completionTokens, toolCallsCount int, usdCost float64, dateUtc string, isFree bool) error {
	// TODO: implement with db
	return nil
}

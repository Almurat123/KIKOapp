package jobs

import "context"

// BillingJob runs billing-related scheduled tasks (e.g. daily aggregation).
type BillingJob struct{}

// Run runs one billing job cycle. Stub: no-op until wired.
func (j *BillingJob) Run(ctx context.Context) error {
	_ = ctx
	return nil
}

package jobs

import "context"

// MarketDataJob refreshes market overview, chains data, and protocols data.
type MarketDataJob struct {
	// Dependencies (repos, API clients) can be injected when wiring
}

// Run runs one market data refresh cycle. Stub: no-op until services are wired.
func (j *MarketDataJob) Run(ctx context.Context) error {
	_ = ctx
	return nil
}

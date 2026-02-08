// Package jobs: Scheduled and background jobs (from kiko-api src/jobs).

package jobs

import "context"

// Runner runs all registered jobs (market data, token data, social, billing, position monitor, chat worker).
type Runner struct {
	marketData *MarketDataJob
	tokenData  *TokenDataJob
	socialData *SocialDataJob
	billing    *BillingJob
	position   *PositionMonitorJob
	chat       *ChatWorker
}

// NewRunner creates a job runner with default job instances.
func NewRunner() *Runner {
	return &Runner{
		marketData: &MarketDataJob{},
		tokenData:  &TokenDataJob{},
		socialData: &SocialDataJob{},
		billing:    &BillingJob{},
		position:   &PositionMonitorJob{},
		chat:       &ChatWorker{},
	}
}

// Start starts background jobs. Call Stop to release resources.
func (r *Runner) Start(ctx context.Context) error {
	// Jobs are stub Run() only; no tickers started yet to avoid panic
	return nil
}

// Stop stops all jobs.
func (r *Runner) Stop() {}

// RunJob runs a single job by name once (for -job=marketData etc.). No panic.
func (r *Runner) RunJob(ctx context.Context, name string) error {
	switch name {
	case "marketData":
		return r.marketData.Run(ctx)
	case "tokenData":
		return r.tokenData.Run(ctx)
	case "socialData":
		return r.socialData.Run(ctx)
	case "billing":
		return r.billing.Run(ctx)
	case "positionMonitor":
		return r.position.Run(ctx)
	case "chatWorker":
		return r.chat.Run(ctx)
	default:
		return nil
	}
}

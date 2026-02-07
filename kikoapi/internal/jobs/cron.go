// Package jobs: Scheduled and background jobs (from kiko-api src/jobs).
// Stub: cron/ticker logic to be wired in main.

package jobs

import "context"

// Runner runs all registered jobs (market data, token data, social, billing, position monitor, chat worker).
type Runner struct{}

// NewRunner creates a job runner.
func NewRunner() *Runner {
	return &Runner{}
}

// Start starts background jobs. Call Stop to release resources.
func (r *Runner) Start(ctx context.Context) error {
	// TODO: start marketDataJob, tokenDataJob, socialDataJob, billingJob, positionMonitorJob, chatWorker
	return nil
}

// Stop stops all jobs.
func (r *Runner) Stop() {}

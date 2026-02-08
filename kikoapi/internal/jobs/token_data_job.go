package jobs

import "context"

// TokenDataJob refreshes token metadata/trending data.
type TokenDataJob struct{}

// Run runs one token data refresh cycle. Stub: no-op until wired.
func (j *TokenDataJob) Run(ctx context.Context) error {
	_ = ctx
	return nil
}

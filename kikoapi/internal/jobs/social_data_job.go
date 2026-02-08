package jobs

import "context"

// SocialDataJob refreshes social/trending casts data.
type SocialDataJob struct{}

// Run runs one social data refresh cycle. Stub: no-op until wired.
func (j *SocialDataJob) Run(ctx context.Context) error {
	_ = ctx
	return nil
}

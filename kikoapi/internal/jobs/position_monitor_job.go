package jobs

import "context"

// PositionMonitorJob monitors open positions and triggers alerts/take-profit.
type PositionMonitorJob struct{}

// Run runs one position monitor cycle. Stub: no-op until wired.
func (j *PositionMonitorJob) Run(ctx context.Context) error {
	_ = ctx
	return nil
}

package services

import (
	"context"

	"kikoapi/internal/config"
)

// UsageAccess checks billing/usage and records usage. Stub until billing is wired.
type UsageAccess struct {
	Config *config.Env
}

// CheckAccess returns whether the user can perform the action (e.g. AI chat). Stub: returns true.
func (u *UsageAccess) CheckAccess(ctx context.Context, userID string, category string) (allowed bool, err error) {
	_ = ctx
	_ = userID
	_ = category
	if u != nil && u.Config != nil && !u.Config.Billing.Enabled {
		return true, nil
	}
	return true, nil
}

// RecordUsage records usage for billing. Stub: no-op.
func (u *UsageAccess) RecordUsage(ctx context.Context, userID string, category string, amount float64) error {
	_ = ctx
	_ = userID
	_ = category
	_ = amount
	return nil
}

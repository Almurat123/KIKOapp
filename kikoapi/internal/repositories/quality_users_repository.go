// Package repositories: Quality Farcaster users (stub).

package repositories

import "context"

// QualityUsersRepository handles quality_farcaster_users table.
type QualityUsersRepository struct{}

// NewQualityUsersRepository creates a QualityUsersRepository.
func NewQualityUsersRepository() *QualityUsersRepository {
	return &QualityUsersRepository{}
}

// GetActiveFids is a stub.
func (r *QualityUsersRepository) GetActiveFids(ctx context.Context) ([]int, error) {
	return nil, nil
}

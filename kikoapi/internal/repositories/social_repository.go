// Package repositories: Social/trending casts (stub; full impl from kiko-api repositories/socialRepository.ts).

package repositories

import (
	"context"

	"kikoapi/internal/types"
)

// SocialRepository handles trending_casts and social data.
type SocialRepository struct{}

// NewSocialRepository creates a SocialRepository.
func NewSocialRepository() *SocialRepository {
	return &SocialRepository{}
}

// GetTrendingCasts is a stub returning empty slice.
func (r *SocialRepository) GetTrendingCasts(ctx context.Context, limit int) ([]types.TrendingCast, error) {
	return nil, nil
}

// SaveTrendingCasts is a stub.
func (r *SocialRepository) SaveTrendingCasts(ctx context.Context, casts []types.TrendingCast) error {
	return nil
}

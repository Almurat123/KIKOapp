// Package repositories: Market/chain metrics (stub; full impl from kiko-api repositories/marketRepository.ts).

package repositories

import "context"

// MarketRepository handles MarketOverview, ChainMetric, etc.
type MarketRepository struct{}

// NewMarketRepository creates a MarketRepository.
func NewMarketRepository() *MarketRepository {
	return &MarketRepository{}
}

// GetChainsData is a stub returning empty slice.
func (r *MarketRepository) GetChainsData(ctx context.Context) ([]interface{}, error) {
	return nil, nil
}

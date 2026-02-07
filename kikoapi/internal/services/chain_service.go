// Package services: Chain list (uses chain repo).

package services

import (
	"context"

	"kikoapi/internal/db"
	"kikoapi/internal/repositories"
)

// ChainService provides chain data.
type ChainService struct {
	chainRepo *repositories.ChainRepository
}

// NewChainService creates a ChainService.
func NewChainService(chainRepo *repositories.ChainRepository) *ChainService {
	return &ChainService{chainRepo: chainRepo}
}

// ListChains returns all active chains.
func (s *ChainService) ListChains(ctx context.Context) ([]db.Chain, error) {
	return s.chainRepo.ListAll(ctx)
}

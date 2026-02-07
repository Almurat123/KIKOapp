// Package repositories: Chain data access (from kiko-api repositories/chainRepository.ts).

package repositories

import (
	"context"

	"gorm.io/gorm"

	"kikoapi/internal/db"
)

// ChainRepository handles Chain table access.
type ChainRepository struct {
	db *gorm.DB
}

// NewChainRepository creates a ChainRepository.
func NewChainRepository(database *gorm.DB) *ChainRepository {
	return &ChainRepository{db: database}
}

// ListAll returns all active chains.
func (r *ChainRepository) ListAll(ctx context.Context) ([]db.Chain, error) {
	var out []db.Chain
	err := r.db.WithContext(ctx).Where("\"isActive\" = ?", true).Find(&out).Error
	return out, err
}

// GetByID returns one chain by id.
func (r *ChainRepository) GetByID(ctx context.Context, id int) (*db.Chain, error) {
	var c db.Chain
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&c).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

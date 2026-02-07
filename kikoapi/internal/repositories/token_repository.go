// Package repositories: Token data access (from kiko-api repositories/tokenRepository.ts).

package repositories

import (
	"context"

	"gorm.io/gorm"

	"kikoapi/internal/db"
)

// TokenRepository handles Token table access.
type TokenRepository struct {
	db *gorm.DB
}

// NewTokenRepository creates a TokenRepository.
func NewTokenRepository(database *gorm.DB) *TokenRepository {
	return &TokenRepository{db: database}
}

// FindByChainAndAddress returns a token by chainId and address.
func (r *TokenRepository) FindByChainAndAddress(ctx context.Context, chainID int, address string) (*db.Token, error) {
	var t db.Token
	err := r.db.WithContext(ctx).Where("\"chainId\" = ? AND address = ?", chainID, address).First(&t).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// Create creates a new token.
func (r *TokenRepository) Create(ctx context.Context, token *db.Token) error {
	return r.db.WithContext(ctx).Create(token).Error
}

// Save updates or creates a token (upsert by chainId+address).
func (r *TokenRepository) Save(ctx context.Context, token *db.Token) error {
	return r.db.WithContext(ctx).Save(token).Error
}

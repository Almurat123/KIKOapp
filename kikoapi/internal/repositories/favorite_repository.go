// Package repositories: FavoriteToken data access.

package repositories

import (
	"context"

	"gorm.io/gorm"

	"kikoapi/internal/db"
)

// FavoriteRepository handles FavoriteToken table access.
type FavoriteRepository struct {
	db *gorm.DB
}

// NewFavoriteRepository creates a FavoriteRepository.
func NewFavoriteRepository(database *gorm.DB) *FavoriteRepository {
	return &FavoriteRepository{db: database}
}

// ListByUser returns all favorite tokens for a user.
func (r *FavoriteRepository) ListByUser(ctx context.Context, userID string) ([]db.FavoriteToken, error) {
	var out []db.FavoriteToken
	err := r.db.WithContext(ctx).Where("\"userId\" = ?", userID).Find(&out).Error
	return out, err
}

// Add adds a favorite (caller must set id).
func (r *FavoriteRepository) Add(ctx context.Context, f *db.FavoriteToken) error {
	return r.db.WithContext(ctx).Create(f).Error
}

// Delete removes a favorite by userID, chain, address.
func (r *FavoriteRepository) Delete(ctx context.Context, userID, chain, address string) error {
	return r.db.WithContext(ctx).Where("\"userId\" = ? AND chain = ? AND address = ?", userID, chain, address).Delete(&db.FavoriteToken{}).Error
}

// Exists returns true if the favorite exists.
func (r *FavoriteRepository) Exists(ctx context.Context, userID, chain, address string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&db.FavoriteToken{}).Where("\"userId\" = ? AND chain = ? AND address = ?", userID, chain, address).Count(&count).Error
	return count > 0, err
}

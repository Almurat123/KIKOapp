// Package repositories: User data access (from kiko-api repositories).

package repositories

import (
	"context"

	"gorm.io/gorm"

	"kikoapi/internal/db"
)

// UserRepository handles User table access.
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a UserRepository.
func NewUserRepository(database *gorm.DB) *UserRepository {
	return &UserRepository{db: database}
}

// FindByPrivyDid returns a user by privyDid.
func (r *UserRepository) FindByPrivyDid(ctx context.Context, privyDid string) (*db.User, error) {
	var u db.User
	err := r.db.WithContext(ctx).Where("\"privyDid\" = ?", privyDid).First(&u).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// FindByWalletAddress returns a user by wallet address.
func (r *UserRepository) FindByWalletAddress(ctx context.Context, wallet string) (*db.User, error) {
	var u db.User
	err := r.db.WithContext(ctx).Where("\"walletAddress\" = ?", wallet).First(&u).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// Create creates a new user.
func (r *UserRepository) Create(ctx context.Context, user *db.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// Save updates the user.
func (r *UserRepository) Save(ctx context.Context, user *db.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

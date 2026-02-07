// Package services: Favorites (uses favorite repo).

package services

import (
	"context"

	"kikoapi/internal/db"
	"kikoapi/internal/repositories"
)

// FavoritesService manages user favorite tokens.
type FavoritesService struct {
	favRepo *repositories.FavoriteRepository
}

// NewFavoritesService creates a FavoritesService.
func NewFavoritesService(favRepo *repositories.FavoriteRepository) *FavoritesService {
	return &FavoritesService{favRepo: favRepo}
}

// List returns favorites for a user.
func (s *FavoritesService) List(ctx context.Context, userID string) ([]db.FavoriteToken, error) {
	return s.favRepo.ListByUser(ctx, userID)
}

// Add adds a favorite (caller must generate id, e.g. cuid).
func (s *FavoritesService) Add(ctx context.Context, f *db.FavoriteToken) error {
	return s.favRepo.Add(ctx, f)
}

// Remove removes a favorite.
func (s *FavoritesService) Remove(ctx context.Context, userID, chain, address string) error {
	return s.favRepo.Delete(ctx, userID, chain, address)
}

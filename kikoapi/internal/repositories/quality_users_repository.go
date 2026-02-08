// Package repositories: Quality Farcaster users (from kiko-api repositories/qualityUsersRepository.ts).

package repositories

import (
	"context"

	"gorm.io/gorm"
)

// QualityFarcasterUser for get/save.
type QualityFarcasterUser struct {
	Fid                int
	Username           *string
	DisplayName        *string
	Pfp                *string
	Bio                *string
	Followers          *int
	Following          *int
	TotalCasts         *int
	EngagementRate     *float64
	Source             *string
	IsActive           bool
	HasCreatorCoin     bool
	CreatorCoinAddress *string
}

// QualityUsersRepository handles quality_farcaster_users table.
type QualityUsersRepository struct {
	db *gorm.DB
}

// NewQualityUsersRepository creates a QualityUsersRepository.
func NewQualityUsersRepository(database *gorm.DB) *QualityUsersRepository {
	return &QualityUsersRepository{db: database}
}

// GetQualityFids returns active FIDs ordered by followers desc, limit 2000.
func (r *QualityUsersRepository) GetQualityFids(ctx context.Context) ([]int, error) {
	var fids []int
	err := r.db.WithContext(ctx).Raw(
		`SELECT fid FROM quality_farcaster_users WHERE is_active = true ORDER BY followers DESC LIMIT 2000`,
	).Scan(&fids).Error
	return fids, err
}

// GetQualityUsers returns active users with limit.
func (r *QualityUsersRepository) GetQualityUsers(ctx context.Context, limit int) ([]QualityFarcasterUser, error) {
	if limit <= 0 {
		limit = 100
	}
	var rows []struct {
		Fid             int      `gorm:"column:fid"`
		Username        *string  `gorm:"column:username"`
		DisplayName     *string  `gorm:"column:display_name"`
		Pfp             *string  `gorm:"column:pfp"`
		Bio             *string  `gorm:"column:bio"`
		Followers       *int     `gorm:"column:followers"`
		Following       *int     `gorm:"column:following"`
		TotalCasts      *int     `gorm:"column:total_casts"`
		EngagementRate  *float64 `gorm:"column:engagement_rate"`
		Source          *string  `gorm:"column:source"`
		IsActive        bool     `gorm:"column:is_active"`
		HasCreatorCoin  bool     `gorm:"column:has_creator_coin"`
		CreatorCoinAddress *string `gorm:"column:creator_coin_address"`
	}
	err := r.db.WithContext(ctx).Raw(
		`SELECT fid, username, display_name, pfp, bio, followers, following, total_casts, engagement_rate, source, is_active, has_creator_coin, creator_coin_address FROM quality_farcaster_users WHERE is_active = true ORDER BY followers DESC LIMIT ?`,
		limit,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]QualityFarcasterUser, 0, len(rows))
	for _, row := range rows {
		out = append(out, QualityFarcasterUser{
			Fid: row.Fid, Username: row.Username, DisplayName: row.DisplayName, Pfp: row.Pfp, Bio: row.Bio,
			Followers: row.Followers, Following: row.Following, TotalCasts: row.TotalCasts, EngagementRate: row.EngagementRate,
			Source: row.Source, IsActive: row.IsActive, HasCreatorCoin: row.HasCreatorCoin, CreatorCoinAddress: row.CreatorCoinAddress,
		})
	}
	return out, nil
}

// SaveQualityUsers upserts users (one by one).
func (r *QualityUsersRepository) SaveQualityUsers(ctx context.Context, users []QualityFarcasterUser) (int, error) {
	saved := 0
	for _, u := range users {
		err := r.db.WithContext(ctx).Exec(
			`INSERT INTO quality_farcaster_users (fid, username, display_name, pfp, bio, followers, following, total_casts, engagement_rate, source, is_active, has_creator_coin, creator_coin_address, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
			 ON CONFLICT (fid) DO UPDATE SET username = EXCLUDED.username, display_name = EXCLUDED.display_name, pfp = EXCLUDED.pfp, bio = EXCLUDED.bio, followers = EXCLUDED.followers, following = EXCLUDED.following, total_casts = EXCLUDED.total_casts, engagement_rate = EXCLUDED.engagement_rate, is_active = EXCLUDED.is_active, has_creator_coin = EXCLUDED.has_creator_coin, creator_coin_address = EXCLUDED.creator_coin_address, updated_at = NOW()`,
			u.Fid, u.Username, u.DisplayName, u.Pfp, u.Bio, u.Followers, u.Following, u.TotalCasts, u.EngagementRate, u.Source, u.IsActive, u.HasCreatorCoin, u.CreatorCoinAddress,
		).Error
		if err != nil {
			return saved, err
		}
		saved++
	}
	return saved, nil
}

// GetActiveFids is an alias for GetQualityFids (stub compatibility).
func (r *QualityUsersRepository) GetActiveFids(ctx context.Context) ([]int, error) {
	return r.GetQualityFids(ctx)
}

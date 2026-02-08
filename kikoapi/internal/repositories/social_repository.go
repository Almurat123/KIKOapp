// Package repositories: Social/trending casts (from kiko-api repositories/socialRepository.ts).

package repositories

import (
	"context"

	"gorm.io/gorm"

	"kikoapi/internal/types"
)

// SocialRepository handles trending_casts and social data.
type SocialRepository struct {
	db *gorm.DB
}

// NewSocialRepository creates a SocialRepository.
func NewSocialRepository(database *gorm.DB) *SocialRepository {
	return &SocialRepository{db: database}
}

// GetLastUpdateTime returns max updated_at from trending_casts.
func (r *SocialRepository) GetLastUpdateTime(ctx context.Context) (interface{}, error) {
	var t *string
	err := r.db.WithContext(ctx).Raw(`SELECT MAX("updated_at") FROM trending_casts`).Scan(&t).Error
	return t, err
}

// GetTrendingCasts returns casts from trending_casts ordered by rank, limit.
func (r *SocialRepository) GetTrendingCasts(ctx context.Context, limit int) ([]types.TrendingCast, error) {
	if limit <= 0 {
		limit = 50
	}
	var rows []struct {
		CastHash     string  `gorm:"column:cast_hash"`
		Fid          int     `gorm:"column:fid"`
		AuthorUsername *string `gorm:"column:author_username"`
		AuthorDisplayName *string `gorm:"column:author_display_name"`
		AuthorAvatar *string `gorm:"column:author_avatar"`
		Text         string  `gorm:"column:text"`
		Timestamp    string  `gorm:"column:timestamp"`
		StatsLikes   int     `gorm:"column:stats_likes"`
		StatsRecasts int     `gorm:"column:stats_recasts"`
		StatsReplies int     `gorm:"column:stats_replies"`
		HeatScore    *float64 `gorm:"column:heat_score"`
		Rank         *int    `gorm:"column:rank"`
	}
	err := r.db.WithContext(ctx).Raw(
		`SELECT cast_hash, fid, author_username, author_display_name, author_avatar, text, timestamp, stats_likes, stats_recasts, stats_replies, heat_score, rank FROM trending_casts ORDER BY rank ASC NULLS LAST LIMIT ?`,
		limit,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]types.TrendingCast, 0, len(rows))
	for _, row := range rows {
		username := ""
		if row.AuthorUsername != nil {
			username = *row.AuthorUsername
		}
		displayName := ""
		if row.AuthorDisplayName != nil {
			displayName = *row.AuthorDisplayName
		}
		avatar := ""
		if row.AuthorAvatar != nil {
			avatar = *row.AuthorAvatar
		}
		rank := 0
		if row.Rank != nil {
			rank = *row.Rank
		}
		out = append(out, types.TrendingCast{
			Hash:  row.CastHash,
			Fid:   row.Fid,
			Author: types.TrendingCastAuthor{Username: username, DisplayName: displayName, Avatar: avatar},
			Text:  row.Text,
			Timestamp: row.Timestamp,
			Stats: types.TrendingCastStats{Likes: row.StatsLikes, Recasts: row.StatsRecasts, Replies: row.StatsReplies},
			HeatScore: row.HeatScore,
			Rank:  rank,
		})
	}
	return out, nil
}

// SaveTrendingCasts upserts casts into trending_casts (simplified: one-by-one upsert).
func (r *SocialRepository) SaveTrendingCasts(ctx context.Context, casts []types.TrendingCast) error {
	if len(casts) == 0 {
		return nil
	}
	for i, c := range casts {
		likes := 0
		if v, ok := c.Stats.Likes.(int); ok {
			likes = v
		}
		recasts := 0
		if v, ok := c.Stats.Recasts.(int); ok {
			recasts = v
		}
		replies := 0
		if v, ok := c.Stats.Replies.(int); ok {
			replies = v
		}
		heatScore := 0.0
		if c.HeatScore != nil {
			if v, ok := c.HeatScore.(float64); ok {
				heatScore = v
			}
		}
		err := r.db.WithContext(ctx).Exec(
			`INSERT INTO trending_casts (cast_hash, fid, author_username, author_display_name, author_avatar, text, timestamp, stats_likes, stats_recasts, stats_replies, heat_score, rank, updated_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?::timestamp, ?, ?, ?, ?, ?, NOW(), NOW())
			 ON CONFLICT (cast_hash) DO UPDATE SET fid = EXCLUDED.fid, author_username = EXCLUDED.author_username, author_display_name = EXCLUDED.author_display_name, author_avatar = EXCLUDED.author_avatar, text = EXCLUDED.text, timestamp = EXCLUDED.timestamp, stats_likes = EXCLUDED.stats_likes, stats_recasts = EXCLUDED.stats_recasts, stats_replies = EXCLUDED.stats_replies, heat_score = EXCLUDED.heat_score, rank = EXCLUDED.rank, updated_at = NOW()`,
			c.Hash, c.Fid, c.Author.Username, c.Author.DisplayName, c.Author.Avatar, c.Text, c.Timestamp, likes, recasts, replies, heatScore, i+1,
		).Error
		if err != nil {
			return err
		}
	}
	return nil
}

// Package types: Social feed types.
// Migrated from kiko-api/src/types/social.ts

package types

// TrendingCastAuthor is the author of a cast.
type TrendingCastAuthor struct {
	Fid          int    `json:"fid"`
	Username     string `json:"username"`
	DisplayName  string `json:"displayName"`
	Avatar       string `json:"avatar"`
	Pfp          string `json:"pfp,omitempty"`
	Bio          string `json:"bio,omitempty"`
	CreatorCoin  interface{} `json:"creatorCoin,omitempty"`
	Twitter      string `json:"twitter,omitempty"`
	Verified     bool   `json:"verified,omitempty"`
}

// ParentCastID references a parent cast.
type ParentCastID struct {
	Fid  int    `json:"fid"`
	Hash string `json:"hash"`
}

// TrendingCastStats holds like/recast/reply counts.
type TrendingCastStats struct {
	Likes   interface{} `json:"likes"`   // number or string
	Recasts interface{} `json:"recasts"`
	Replies interface{} `json:"replies"`
}

// TrendingCast represents a trending cast from social feed.
type TrendingCast struct {
	Hash                 string            `json:"hash"`
	Fid                  int               `json:"fid"`
	Author               TrendingCastAuthor `json:"author"`
	Text                 string            `json:"text"`
	Timestamp            string            `json:"timestamp"` // Date | string
	Embeds               []interface{}     `json:"embeds"`
	ParentCastID         *ParentCastID     `json:"parentCastId,omitempty"`
	Stats                TrendingCastStats `json:"stats"`
	HeatScore            interface{}       `json:"heatScore"` // number | string
	Rank                 int               `json:"rank"`
	BaseAppCoinMetadata  interface{}      `json:"baseAppCoinMetadata,omitempty"`
	CoinValue            string            `json:"coinValue,omitempty"`
	Mentions             interface{}       `json:"mentions,omitempty"`
	IsBaseAppCoin        bool              `json:"isBaseAppCoin,omitempty"`
}

// SocialFeedItemAuthor is author for feed item.
type SocialFeedItemAuthor struct {
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Avatar      string `json:"avatar"`
}

// SocialFeedItem is a single item in the social feed.
type SocialFeedItem struct {
	ID             string              `json:"id"`
	Hash           string              `json:"hash"`
	Text           string              `json:"text"`
	Author         SocialFeedItemAuthor `json:"author"`
	Timestamp      string              `json:"timestamp"`
	Likes          int                 `json:"likes"`
	Recasts        int                 `json:"recasts"`
	Replies        int                 `json:"replies"`
	IsBaseAppCoin  bool                `json:"isBaseAppCoin,omitempty"`
	CastTwitter    string              `json:"castTwitter,omitempty"`
}

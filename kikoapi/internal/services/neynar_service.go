package services

import "context"

// NeynarService provides Farcaster/Neynar API access. Stub until API key and client are wired.
type NeynarService struct {
	APIKey string
}

// GetUserByFid returns Farcaster user by FID. Stub: returns nil.
func (n *NeynarService) GetUserByFid(ctx context.Context, fid int64) (interface{}, error) {
	_ = ctx
	_ = fid
	_ = n.APIKey
	return nil, nil
}

// GetTrendingCasts returns trending casts. Stub: returns nil.
func (n *NeynarService) GetTrendingCasts(ctx context.Context) ([]interface{}, error) {
	_ = ctx
	return nil, nil
}

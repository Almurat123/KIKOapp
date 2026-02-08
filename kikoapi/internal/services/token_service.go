package services

import "context"

// TokenInfo holds address, symbol, decimals for a token.
type TokenInfo struct {
	Address  string
	Symbol   string
	Name     string
	Decimals int
}

// TokenService resolves token info by symbol or address. Stub until DexScreener/registry is wired.
type TokenService struct{}

// GetTokenInfo returns token info for the given token (address or symbol) on chain. Stub: returns nil.
func (t *TokenService) GetTokenInfo(ctx context.Context, token string, chainID int) (*TokenInfo, error) {
	_ = ctx
	_ = token
	_ = chainID
	return nil, nil
}

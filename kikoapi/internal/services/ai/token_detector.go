package ai

import "context"

// TokenInfo holds token address, symbol, chain, and optional market/launchpad data.
type TokenInfo struct {
	Address      string
	Symbol       string
	Name         string
	ChainID      int
	ChainName    string
	Price        float64
	PriceChange24h float64
	MarketCap    float64
	Volume24h    float64
	Launchpad    *LaunchpadInfo
}

// LaunchpadInfo identifies launchpad provider and opaque data.
type LaunchpadInfo struct {
	Provider string // zora, clanker, paragraph, etc.
	Data     interface{}
}

// TokenFinder finds a token by address (any chain). Implemented by dexscreener/gecko client.
type TokenFinder interface {
	FindToken(ctx context.Context, address string) (*TokenInfo, error)
}

// FindTokenOnAnyChain searches for token globally. Stub: returns nil until TokenFinder is wired.
func FindTokenOnAnyChain(ctx context.Context, address string, finder TokenFinder) (*TokenInfo, error) {
	if finder == nil {
		return nil, nil
	}
	return finder.FindToken(ctx, address)
}

package news

import (
	"context"
	"regexp"
	"strings"
	"time"
)

// Chains to collect (base, solana, bnb smart chain).
var DefaultChains = []string{"base", "solana", "bnb smart chain"}

const (
	tokensPerChain = 3
	duration       = "1h"
	maxMarketCap   = 1_000_000_000
)

var (
	stablecoinSymbols = map[string]bool{
		"USDT": true, "USDC": true, "DAI": true, "BUSD": true, "TUSD": true, "FRAX": true,
		"USDP": true, "GUSD": true, "LUSD": true, "WETH": true, "WBTC": true, "WBNB": true,
	}
	wrappedSymbols = map[string]bool{
		"WETH": true, "WBTC": true, "WBNB": true, "WMATIC": true, "wSOL": true, "WSOL": true,
		"stETH": true, "wstETH": true, "rETH": true, "cbETH": true,
	}
	customExclusions = map[string]bool{
		"VIRTUAL": true, "AERO": true, "AVNT": true, "ZORA": true, "CARV": true,
	}
	filteredNamePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)^wrapped\s`),
		regexp.MustCompile(`(?i)^bridged\s`),
		regexp.MustCompile(`(?i)^staked\s`),
		regexp.MustCompile(`(?i)liquid\s*staked`),
		regexp.MustCompile(`(?i)\spegged$`),
		regexp.MustCompile(`(?i)stablecoin`),
		regexp.MustCompile(`(?i)\swrapped\s`),
	}
)

// TrendingProvider fetches raw trending tokens per chain (e.g. DexScreener). Stub in this package.
type TrendingProvider interface {
	GetTrendingByChain(ctx context.Context, chain string, limit int, duration string) ([]TrendingToken, error)
}

// ShouldFilterToken returns true if the token should be excluded from news.
func ShouldFilterToken(symbol, name string) bool {
	upper := strings.ToUpper(symbol)
	if stablecoinSymbols[upper] || wrappedSymbols[symbol] || wrappedSymbols[upper] || customExclusions[upper] {
		return true
	}
	for _, p := range filteredNamePatterns {
		if p.MatchString(name) {
			return true
		}
	}
	return false
}

// CollectTrendingTokens returns filtered trending tokens; uses provider if non-nil, else returns empty.
func CollectTrendingTokens(ctx context.Context, exclusionList map[string]bool, provider TrendingProvider) (*NewsTrendingData, error) {
	if provider == nil {
		return &NewsTrendingData{Chains: DefaultChains, Timestamp: time.Now().UnixMilli()}, nil
	}
	var all []TrendingToken
	for _, chain := range DefaultChains {
		list, err := provider.GetTrendingByChain(ctx, chain, 30, duration)
		if err != nil {
			continue
		}
		var filtered []TrendingToken
		for _, t := range list {
			if ShouldFilterToken(t.Symbol, t.Name) {
				continue
			}
			if exclusionList[strings.ToUpper(t.Symbol)] {
				continue
			}
			if customExclusions[strings.ToUpper(t.Symbol)] {
				continue
			}
			if t.MarketCap > maxMarketCap {
				continue
			}
			filtered = append(filtered, t)
			if len(filtered) >= tokensPerChain {
				break
			}
		}
		all = append(all, filtered...)
	}
	return &NewsTrendingData{
		Tokens:    all,
		Chains:    DefaultChains,
		Timestamp: time.Now().UnixMilli(),
	}, nil
}

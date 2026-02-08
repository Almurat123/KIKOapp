package dex

// PoolInfo holds on-chain pool data (V2/V3/V4/Aerodrome).
type PoolInfo struct {
	PoolAddress   string   `json:"poolAddress"`
	Token0         string   `json:"token0"`
	Token1         string   `json:"token1"`
	Token0Symbol   string   `json:"token0Symbol,omitempty"`
	Token1Symbol   string   `json:"token1Symbol,omitempty"`
	Token0Decimals *int     `json:"token0Decimals,omitempty"`
	Token1Decimals *int     `json:"token1Decimals,omitempty"`
	Reserve0       string   `json:"reserve0,omitempty"`
	Reserve1       string   `json:"reserve1,omitempty"`
	Liquidity      string   `json:"liquidity,omitempty"`
	SqrtPriceX96   string   `json:"sqrtPriceX96,omitempty"`
	Fee            *int     `json:"fee,omitempty"`
	TVLUsd         *float64 `json:"tvlUsd,omitempty"`
	Price          *float64 `json:"price,omitempty"`
	Version        string   `json:"version,omitempty"` // "v2" | "v3" | "v4" | "aerodrome"
	Dex            string   `json:"dex,omitempty"`     // "uniswap" | "pancake" | "aerodrome"
}

package dex

import "math/big"

// DexQuote is a single DEX quote (router, amount out, calldata).
type DexQuote struct {
	Dex          string    // e.g. "Uniswap V3"
	Router       string    // Router contract address
	AmountOut    *big.Int  // Expected output amount
	AmountOutMin *big.Int  // Minimum output (with slippage)
	GasEstimate  *big.Int  // Estimated gas cost
	Calldata     string    // Pre-encoded transaction data
	Path         SwapPath  // Swap path details
	PriceImpact  float64   // Price impact percentage
}

// SwapPath holds token path and fee/stable info.
type SwapPath struct {
	TokenIn            string   `json:"tokenIn"`
	TokenOut           string   `json:"tokenOut"`
	Fee                *int     `json:"fee,omitempty"`     // V3 fee tier (500, 3000, 10000)
	Stable             *bool    `json:"stable,omitempty"` // Aerodrome: stable vs volatile
	IntermediateTokens []string `json:"intermediateTokens,omitempty"`
}

// SwapParams are inputs for getting a quote or building a swap.
type SwapParams struct {
	TokenIn     string
	TokenOut    string
	AmountIn    *big.Int
	Recipient   string
	SlippageBps int   // e.g. 50 = 0.5%
	Deadline    *int64 // Unix timestamp; optional
}

// SwapResult is the result of a swap execution.
type SwapResult struct {
	Success   bool
	TxHash    string
	AmountOut *big.Int
	GasUsed   *big.Int
	Error     string
}

// RouterType is the DEX router type.
type RouterType string

const (
	RouterTypeV3        RouterType = "v3"
	RouterTypeV2        RouterType = "v2"
	RouterTypeAerodrome RouterType = "aerodrome"
	RouterTypeUniversal RouterType = "universal"
)

// RouterConfig is a DEX router address and type per chain.
type RouterConfig struct {
	Name    string
	Address string
	Type    RouterType
	ChainID int
}

// V3SwapRouters maps chainId -> Uniswap V3 SwapRouter.
var V3SwapRouters = map[int]RouterConfig{
	1:     {Name: "Uniswap V3", Address: "0xE592427A0AEce92De3Edee1F18E0157C05861564", Type: RouterTypeV3, ChainID: 1},
	8453:  {Name: "Uniswap V3", Address: "0x2626664c2603336E57B271c5C0b26F421741e481", Type: RouterTypeV3, ChainID: 8453},
	42161: {Name: "Uniswap V3", Address: "0xE592427A0AEce92De3Edee1F18E0157C05861564", Type: RouterTypeV3, ChainID: 42161},
}

// AerodromeRouter is the Aerodrome router on Base.
var AerodromeRouter = RouterConfig{
	Name: "Aerodrome", Address: "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", Type: RouterTypeAerodrome, ChainID: 8453,
}

// PancakeRouters holds PancakeSwap V3/V2 on BSC.
var PancakeRouters = map[string]RouterConfig{
	"v3": {Name: "PancakeSwap V3", Address: "0x1b81D678ffb9C0263b24A97847620C99d213eB14", Type: RouterTypeV3, ChainID: 56},
	"v2": {Name: "PancakeSwap V2", Address: "0x10ED43C718714eb63d5aA57B78B54704E256024E", Type: RouterTypeV2, ChainID: 56},
}

// V3FeeTiers are 0.05%, 0.3%, 1%.
var V3FeeTiers = []int{500, 3000, 10000}

// DefaultDeadlineSeconds is default swap deadline (30 min).
const DefaultDeadlineSeconds = 1800

// MaxUint256 is the maximum uint256 value.
var MaxUint256 = new(big.Int).SetBytes([]byte{
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
})

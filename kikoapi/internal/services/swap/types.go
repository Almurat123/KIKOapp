package swap

import "context"

// SwapQuote is a quote from a swap provider.
type SwapQuote struct {
	Provider        string
	AmountInBase    string
	AmountOutBase   string
	AmountOutHuman  string
	PriceImpact     float64
	GasEstimate     string
	To              string
	Data            string
	Value           string
	AllowanceTarget string
	ExpiresAt       int64
	Metadata        map[string]interface{}
}

// SwapRequest is the input for getting a quote or executing a swap.
type SwapRequest struct {
	UserID        string
	WalletAddress string
	TokenIn       string
	TokenOut      string
	AmountIn      string
	ChainID       int
	SlippageBps   int
	FeeContext    string // "swap" | "launchpad" | "copy_trade"
	IsSell        bool
}

// SwapResult is the result of executing a swap.
type SwapResult struct {
	Success    bool
	TxHash     string
	Status     string // SUCCESS | ACTION_REQUIRED | FAILED
	AmountOut  string
	Error      string
	Method     string
	ApprovalTx *ApprovalTx
	Metadata   map[string]interface{}
	Confirmed  bool
	BlockNumber int
}

// ApprovalTx is a separate approval transaction (EVM).
type ApprovalTx struct {
	To      string
	Data    string
	Value   string
	ChainID int
}

// SwapProvider gets quotes for a given chain/token pair.
type SwapProvider interface {
	Name() string
	SupportedChains() []int
	GetQuote(ctx context.Context, request *SwapRequest) (*SwapQuote, error)
	SupportsToken(ctx context.Context, token string, chainID int) (bool, error)
}

// Executor executes a swap (sign + broadcast + optional wait).
type Executor interface {
	Execute(ctx context.Context, userID string, quote *SwapQuote, request *SwapRequest) (*SwapResult, error)
	SupportsChain(chainID int) bool
}

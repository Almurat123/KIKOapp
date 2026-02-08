package swap

import "context"

// UnifiedExecutor is the unified swap executor (EVM + Solana). Stub until quote/wallet/RPC are wired.
type UnifiedExecutor struct {
	evmExecutor    Executor
	solanaExecutor Executor
}

// NewUnifiedExecutor creates a unified executor with optional EVM and Solana executors.
func NewUnifiedExecutor(evm, solana Executor) *UnifiedExecutor {
	return &UnifiedExecutor{evmExecutor: evm, solanaExecutor: solana}
}

// Execute runs the swap: resolve tokens, get quote, execute. Stub returns error until wired.
func (e *UnifiedExecutor) Execute(ctx context.Context, params *ExecuteParams) (*SwapResult, error) {
	if params == nil {
		return &SwapResult{Success: false, Error: "invalid params", Method: "swap"}, nil
	}
	if params.TokenIn == "" || params.TokenOut == "" || params.TokenIn == params.TokenOut {
		return &SwapResult{Success: false, Error: "Invalid token pair", Method: "swap"}, nil
	}
	// Route by chain: Solana vs EVM would use different executors. Stub returns not implemented.
	_ = e.evmExecutor
	_ = e.solanaExecutor
	return &SwapResult{
		Success: false,
		Error:   "Swap executor not implemented",
		Method:  "swap",
	}, nil
}

// ExecuteParams are parameters for Execute (mirrors TS SwapParams).
type ExecuteParams struct {
	UserID                 string
	WalletAddress          string
	TokenIn                string
	TokenOut               string
	AmountIn               string
	ChainID                int
	SlippageBps            int
	FeeContext             string
	FeeBpsOverride         int
	IsSell                 bool
	MessageID              string
	ExcludeDex             string
	AccessToken            string
	WaitForConfirmation    bool
	ConfirmationTimeoutMs  int
	ReturnOnConfirmTimeout bool
	SpeedUpAfterMs         int
	SpeedUpBumpBps         int
	TransferRetry           bool
}

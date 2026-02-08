package dex

import "context"

// GetPancakeQuote returns a PancakeSwap quote (BSC only). Stub: returns nil until RPC is wired.
func GetPancakeQuote(ctx context.Context, _ RPCCaller, params *SwapParams, chainID int) (*DexQuote, error) {
	if chainID != 56 || params == nil {
		return nil, nil
	}
	_ = ctx
	return nil, nil
}

// BuildPancakeSwapTransaction returns quote + approval + swap tx. Stub: returns nil.
func BuildPancakeSwapTransaction(ctx context.Context, caller RPCCaller, params *SwapParams, chainID int) (*BuildSwapResult, error) {
	q, err := GetPancakeQuote(ctx, caller, params, chainID)
	if err != nil || q == nil {
		return nil, err
	}
	return &BuildSwapResult{Quote: q, SwapTx: TxData{To: q.Router, Data: q.Calldata, Value: "0x0"}}, nil
}

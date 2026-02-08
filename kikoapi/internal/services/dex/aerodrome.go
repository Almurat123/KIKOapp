package dex

import "context"

// GetAerodromeQuote returns an Aerodrome quote (Base only). Stub: returns nil until RPC is wired.
func GetAerodromeQuote(ctx context.Context, _ RPCCaller, params *SwapParams, chainID int) (*DexQuote, error) {
	if chainID != 8453 || params == nil {
		return nil, nil
	}
	_ = ctx
	return nil, nil
}

// BuildAerodromeSwapTransaction returns quote + approval + swap tx. Stub: returns nil.
func BuildAerodromeSwapTransaction(ctx context.Context, caller RPCCaller, params *SwapParams, chainID int) (*BuildSwapResult, error) {
	q, err := GetAerodromeQuote(ctx, caller, params, chainID)
	if err != nil || q == nil {
		return nil, err
	}
	return &BuildSwapResult{Quote: q, SwapTx: TxData{To: q.Router, Data: q.Calldata, Value: "0x0"}}, nil
}

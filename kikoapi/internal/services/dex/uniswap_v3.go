package dex

import "context"

// GetV3Quote returns a Uniswap V3 quote for the given params. Stub: returns nil until RPC/Quoter is wired.
func GetV3Quote(ctx context.Context, _ RPCCaller, params *SwapParams, chainID int) (*DexQuote, error) {
	if params == nil {
		return nil, nil
	}
	_ = chainID
	return nil, nil
}

// BuildV3SwapTransaction returns quote + approval tx (if needed) + swap tx. Stub: returns nil.
func BuildV3SwapTransaction(ctx context.Context, caller RPCCaller, params *SwapParams, chainID int) (*BuildSwapResult, error) {
	q, err := GetV3Quote(ctx, caller, params, chainID)
	if err != nil || q == nil {
		return nil, err
	}
	return &BuildSwapResult{Quote: q, SwapTx: TxData{To: q.Router, Data: q.Calldata, Value: "0x0"}}, nil
}

// BuildSwapResult holds quote, optional approval tx, and swap tx.
type BuildSwapResult struct {
	Quote       *DexQuote
	ApprovalTx  *TxData
	SwapTx      TxData
}

// TxData is to/data/value for a transaction.
type TxData struct {
	To    string
	Data  string
	Value string
}

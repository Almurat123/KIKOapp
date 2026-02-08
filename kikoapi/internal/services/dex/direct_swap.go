package dex

import (
	"context"
	"math/big"
	"strings"
)

// Gas price estimates by chain (wei). Used for net output comparison.
var gasPriceWei = map[int]*big.Int{
	1:     big.NewInt(30 * 1e9),
	8453:  big.NewInt(1e7),           // 0.01 gwei
	42161: big.NewInt(1e8),
	56:    big.NewInt(3 * 1e9),
	137:   big.NewInt(50 * 1e9),
}

// GetBestQuote returns the best DEX quote (highest net output) for the given params.
func GetBestQuote(ctx context.Context, caller RPCCaller, params *SwapParams, chainID int) (*DexQuote, error) {
	if params == nil {
		return nil, nil
	}
	var quotes []*DexQuote
	if q, _ := GetV3Quote(ctx, caller, params, chainID); q != nil && q.AmountOut != nil && q.AmountOut.Sign() > 0 {
		quotes = append(quotes, q)
	}
	if chainID == 8453 {
		if q, _ := GetAerodromeQuote(ctx, caller, params, chainID); q != nil && q.AmountOut != nil && q.AmountOut.Sign() > 0 {
			quotes = append(quotes, q)
		}
	}
	if chainID == 56 {
		if q, _ := GetPancakeQuote(ctx, caller, params, chainID); q != nil && q.AmountOut != nil && q.AmountOut.Sign() > 0 {
			quotes = append(quotes, q)
		}
	}
	if len(quotes) == 0 {
		return nil, nil
	}
	gasPrice := gasPriceWei[chainID]
	if gasPrice == nil {
		gasPrice = big.NewInt(20 * 1e9)
	}
	best := quotes[0]
	bestScore := new(big.Int).Set(best.AmountOut)
	for i := 1; i < len(quotes); i++ {
		q := quotes[i]
		score := q.AmountOut
		if score.Cmp(bestScore) > 0 {
			bestScore = score
			best = q
		} else if score.Cmp(bestScore) == 0 && q.GasEstimate != nil && best.GasEstimate != nil && q.GasEstimate.Cmp(best.GasEstimate) < 0 {
			best = q
		}
	}
	return best, nil
}

// BuildBestSwapTransaction returns the best quote and ready-to-sign approval (if needed) + swap tx.
func BuildBestSwapTransaction(ctx context.Context, caller RPCCaller, params *SwapParams, chainID int) (*BuildSwapResult, error) {
	best, err := GetBestQuote(ctx, caller, params, chainID)
	if err != nil || best == nil {
		return nil, err
	}
	switch {
	case strings.Contains(best.Dex, "Aerodrome"):
		return BuildAerodromeSwapTransaction(ctx, caller, params, chainID)
	case strings.Contains(best.Dex, "PancakeSwap"):
		return BuildPancakeSwapTransaction(ctx, caller, params, chainID)
	default:
		return BuildV3SwapTransaction(ctx, caller, params, chainID)
	}
}

// GetAllQuotes returns all valid quotes from V3, Aerodrome (Base), and Pancake (BSC).
func GetAllQuotes(ctx context.Context, caller RPCCaller, params *SwapParams, chainID int) ([]*DexQuote, error) {
	if params == nil {
		return nil, nil
	}
	var out []*DexQuote
	if q, _ := GetV3Quote(ctx, caller, params, chainID); q != nil {
		out = append(out, q)
	}
	if chainID == 8453 {
		if q, _ := GetAerodromeQuote(ctx, caller, params, chainID); q != nil {
			out = append(out, q)
		}
	}
	if chainID == 56 {
		if q, _ := GetPancakeQuote(ctx, caller, params, chainID); q != nil {
			out = append(out, q)
		}
	}
	return out, nil
}

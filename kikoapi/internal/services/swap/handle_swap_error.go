package swap

import (
	"regexp"
	"strings"
)

// HandleSwapError maps technical errors from Jupiter, 0x, Kyber to user-friendly messages.
func HandleSwapError(err interface{}) string {
	var msg string
	switch v := err.(type) {
	case error:
		msg = v.Error()
	case string:
		msg = v
	default:
		msg = "Unknown error"
	}
	msgLower := strings.ToLower(msg)

	// Kyber codes (would come from errorData in TS - here we only have message)
	if strings.Contains(msgLower, "unable to bind request body") {
		return "Swap failed: Kyber request payload invalid. Retrying may help, but this is likely a routing/build error."
	}
	if strings.Contains(msgLower, "route not found") || strings.Contains(msgLower, "route_not_found") {
		return "Swap failed: No Kyber route found for this pair. Try a smaller amount or different pair."
	}
	if strings.Contains(msgLower, "amount exceeds") && strings.Contains(msgLower, "maximum") {
		return "Swap failed: Amount exceeds maximum for this route. Try a smaller amount."
	}
	if strings.Contains(msgLower, "no eligible pool found") {
		return "Swap failed: No eligible pool found for this route. Try a different pair or smaller amount."
	}
	if strings.Contains(msgLower, "tokenin or tokenout not supported") {
		return "Swap failed: tokenIn or tokenOut not supported by Kyber."
	}

	// Slippage & price movement
	if strings.Contains(msgLower, "slippage") ||
		strings.Contains(msgLower, "price_or_slippage_too_low") ||
		strings.Contains(msgLower, "insufficient_output_amount") ||
		strings.Contains(msgLower, "uniswapv2: k") ||
		strings.Contains(msgLower, "too little received") ||
		strings.Contains(msgLower, "minamountout") ||
		strings.Contains(msgLower, "min output") ||
		strings.Contains(msgLower, "err_limit_out") ||
		strings.Contains(msgLower, "0x1771") {
		return "Swap failed: Price moved beyond slippage tolerance. Please try increasing your slippage percentage."
	}

	// Liquidity & market depth
	if strings.Contains(msgLower, "insufficient_asset_liquidity") ||
		strings.Contains(msgLower, "insufficient_liquidity") ||
		strings.Contains(msgLower, "no route found") ||
		strings.Contains(msgLower, "no route matched") ||
		strings.Contains(msgLower, "route_not_found") ||
		strings.Contains(msgLower, "pool_not_found") ||
		strings.Contains(msgLower, "pair_not_found") ||
		strings.Contains(msgLower, "could_not_fill") {
		return "Swap failed: Insufficient market liquidity or depth for this trade scale. Try reducing the amount."
	}

	// Balance & gas
	if strings.Contains(msgLower, "insufficient funds") ||
		strings.Contains(msgLower, "insufficient balance") ||
		strings.Contains(msgLower, "insufficient funds for gas") ||
		strings.Contains(msgLower, "insufficient funds for intrinsic transaction cost") ||
		strings.Contains(msgLower, "erc20: transfer amount exceeds balance") ||
		strings.Contains(msgLower, "erc20insufficientbalance") ||
		strings.Contains(msgLower, "insufficient lamports") ||
		strings.Contains(msgLower, "balance") {
		return "Swap failed: Insufficient balance for the transaction or required gas fees. Ensure you have enough native tokens."
	}

	// Allowance
	if strings.Contains(msgLower, "allowance_too_low") ||
		strings.Contains(msgLower, "insufficient allowance") ||
		(strings.Contains(msgLower, "execution reverted") && strings.Contains(msgLower, "allowance")) ||
		strings.Contains(msgLower, "transfer_from_failed") ||
		strings.Contains(msgLower, "transferhelper") {
		return "Swap failed: Token approval or allowance is insufficient. Please approve the token and retry."
	}

	// Amount too small
	if strings.Contains(msgLower, "amount too low") ||
		strings.Contains(msgLower, "amount is too low") ||
		strings.Contains(msgLower, "invalid amount") ||
		strings.Contains(msgLower, "sellamount too low") ||
		strings.Contains(msgLower, "min buy amount") ||
		strings.Contains(msgLower, "min buy amount not met") {
		return "Swap failed: Amount too small for this pair or below minimum. Try a larger amount."
	}

	// User rejected
	if strings.Contains(msgLower, "user rejected") || strings.Contains(msgLower, "user denied") || strings.Contains(msgLower, "rejected") {
		return "Swap failed: Transaction was rejected by the user."
	}

	// Timeout
	if strings.Contains(msgLower, "timeout") || strings.Contains(msgLower, "etimedout") {
		return "Swap failed: Network request timed out. Please check your connection and try again later."
	}

	// Extract JSON from "HTTP 400: {...}" for future use
	_ = regexp.MustCompile(`HTTP\s+\d+:\s*(\{.*\})`)

	if len(msg) > 100 {
		msg = msg[:100]
	}
	return "Swap failed: " + msg
}

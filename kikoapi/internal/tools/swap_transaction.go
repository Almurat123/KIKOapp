package tools

import (
	"context"

	"kikoapi/internal/tooling"
)

// PrepareSwapTransactionTool is the tool definition and stub handler for prepare_swap_transaction.
var PrepareSwapTransactionTool = &tooling.Tool{
	Definition: tooling.ToolDefinition{
		Name:        "prepare_swap_transaction",
		Description: "Prepare and optionally execute a token swap. Use when the user wants to swap, trade, or buy/sell tokens. amount_in must be a numeric string (e.g. \"0.1\"), not \"all\" or \"max\".",
		Parameters: map[string]interface{}{
			"token_in":  map[string]string{"type": "string", "description": "Source token symbol or address"},
			"token_out": map[string]string{"type": "string", "description": "Destination token symbol or address"},
			"amount_in": map[string]string{"type": "string", "description": "Numeric amount to swap (e.g. \"0.1\")"},
			"chain_id":  map[string]string{"type": "number", "description": "Chain ID (e.g. 8453 for Base)"},
			"slippage":  map[string]string{"type": "number", "description": "Slippage tolerance in percent"},
			"execute":   map[string]string{"type": "boolean", "description": "If true, execute the swap"},
		},
		Required: []string{"token_in", "token_out", "amount_in", "chain_id"},
	},
	Handler: prepareSwapTransactionHandler,
}

func prepareSwapTransactionHandler(ctx context.Context, args map[string]interface{}, tc *tooling.ToolContext) (interface{}, error) {
	_ = ctx
	_ = args
	_ = tc
	// Stub: return a placeholder until swap service is wired
	return map[string]interface{}{
		"success": false,
		"error":   "Swap not implemented",
	}, nil
}

// RegisterSwapTools registers the swap-related tools on the given registry.
func RegisterSwapTools(reg *tooling.Registry) {
	if reg != nil {
		reg.Register(PrepareSwapTransactionTool)
	}
}

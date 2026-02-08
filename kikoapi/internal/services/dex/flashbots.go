package dex

import "context"

// FlashbotsConfig configures Flashbots submission.
type FlashbotsConfig struct {
	UseFlashbots    bool
	PreferFast      bool
	MaxBlocksToWait int
}

// FlashbotsResult is the result of sending via Flashbots.
type FlashbotsResult struct {
	Success       bool
	TxHash        string
	BlockNumber   int
	Error         string
	UsedFlashbots bool
}

// SendViaFlashbots sends a signed tx via Flashbots Protect (ETH mainnet only).
// Stub: returns not supported until rpc/Flashbots client is wired.
func SendViaFlashbots(ctx context.Context, signedTxHex string, chainID int, config *FlashbotsConfig) (*FlashbotsResult, error) {
	if config == nil {
		config = &FlashbotsConfig{UseFlashbots: true, PreferFast: false, MaxBlocksToWait: 25}
	}
	if chainID != 1 {
		return &FlashbotsResult{Success: false, Error: "Flashbots only supported on ETH mainnet", UsedFlashbots: false}, nil
	}
	if !config.UseFlashbots {
		return &FlashbotsResult{Success: false, Error: "Flashbots disabled", UsedFlashbots: false}, nil
	}
	_ = signedTxHex
	return &FlashbotsResult{Success: false, Error: "Flashbots not implemented", UsedFlashbots: false}, nil
}

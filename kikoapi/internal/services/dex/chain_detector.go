package dex

import (
	"context"
	"encoding/hex"
	"strings"
)

// ERC20 symbol() selector: first 4 bytes of keccak256("symbol()")
const symbolSelectorHex = "95d89b41"

// ChainsToCheck are chains we probe for token existence.
var ChainsToCheck = []struct {
	ChainID int
	Name    string
}{
	{8453, "Base"},
	{1, "Ethereum"},
	{56, "BSC"},
	{42161, "Arbitrum"},
	{137, "Polygon"},
}

// DetectTokenChains returns chain IDs on which the token exists (symbol() call succeeds).
func DetectTokenChains(ctx context.Context, caller RPCCaller, tokenAddress string) ([]int, error) {
	addr := strings.TrimPrefix(strings.ToLower(tokenAddress), "0x")
	if len(addr) < 40 {
		return nil, nil
	}
	if len(addr) == 40 {
		addr = "0x" + addr
	}
	callData := "0x" + symbolSelectorHex

	var found []int
	for _, c := range ChainsToCheck {
		params := map[string]interface{}{
			"to":   addr,
			"data": callData,
		}
		result, err := caller.Call(ctx, c.ChainID, "eth_call", []interface{}{params, "latest"})
		if err != nil {
			continue
		}
		// Decode hex string result
		var hexStr string
		if len(result) >= 2 && result[0] == '"' {
			hexStr = string(result[1 : len(result)-1])
		} else {
			hexStr = string(result)
		}
		hexStr = strings.TrimPrefix(hexStr, "0x")
		if hexStr == "" || hexStr == "0x" || len(hexStr) <= 2 {
			continue
		}
		if _, err := hex.DecodeString(hexStr); err == nil {
			found = append(found, c.ChainID)
		}
	}
	return found, nil
}

// TokenWithChains holds address and detected chains.
type TokenWithChains struct {
	Address string
	Chains  []ChainInfo
}

// ChainInfo is chainId + name.
type ChainInfo struct {
	ChainID int
	Name    string
}

// GetTokenWithChainDetection returns token address and list of chains it exists on.
func GetTokenWithChainDetection(ctx context.Context, caller RPCCaller, tokenAddress string) (*TokenWithChains, error) {
	chainIDs, err := DetectTokenChains(ctx, caller, tokenAddress)
	if err != nil {
		return nil, err
	}
	chains := make([]ChainInfo, 0, len(chainIDs))
	for _, id := range chainIDs {
		name := "Chain"
		for _, c := range ChainsToCheck {
			if c.ChainID == id {
				name = c.Name
				break
			}
		}
		chains = append(chains, ChainInfo{ChainID: id, Name: name})
	}
	return &TokenWithChains{Address: tokenAddress, Chains: chains}, nil
}

// Package config: Chain configuration (from kiko-api chainConfig.ts).
// RPC URLs are filled from environment at runtime.

package config

import "os"

// ChainConfig describes a chain's RPC, explorer, and contract addresses.
type ChainConfig struct {
	ID                   int
	Name                 string
	RpcUrls              []string
	NativeCurrency       NativeCurrency
	WrappedNativeAddress string
	Stablecoins          []string
	ExplorerURL          string
	Contracts            ChainContracts
	APIURL               string
	GasReserve           string
	Slugs                ChainSlugs
}

type NativeCurrency struct {
	Name     string
	Symbol   string
	Decimals int
}

type ChainContracts struct {
	ZeroExProxy string
	Permit2     string
	KyberRouter string
}

type ChainSlugs struct {
	DexScreener   string
	GeckoTerminal string
}

// GetChainRPC returns the primary RPC URL for a chain from env (e.g. BASE_RPC_URL, ETH_RPC_URL).
func GetChainRPC(chainEnvKey string) string {
	return os.Getenv(chainEnvKey)
}

// Default chain IDs (match kiko-api).
const (
	ChainIDEthereum = 1
	ChainIDBase     = 8453
	ChainIDBSC      = 56
)

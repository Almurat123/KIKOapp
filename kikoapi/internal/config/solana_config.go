// Package config: Solana configuration (from kiko-api solanaConfig.ts).

package config

import "os"

// SolanaConfig holds Solana-related settings.
var SolanaConfig = struct {
	ChainID        int
	JupiterAPIURL  string
	JupiterAPIKey  string
	Tokens         SolanaTokens
	Programs       SolanaPrograms
}{
	ChainID:       900,
	JupiterAPIURL: getEnv("JUPITER_API_URL", "https://api.jup.ag/v6"),
	JupiterAPIKey:  os.Getenv("JUPITER_API_KEY"),
	Tokens: SolanaTokens{
		SOL:  "So11111111111111111111111111111111111111112",
		USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
	},
	Programs: SolanaPrograms{
		PumpFun:   "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
		RaydiumV4: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
		JupiterV6: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
	},
}

type SolanaTokens struct {
	SOL  string
	USDC string
	USDT string
}

type SolanaPrograms struct {
	PumpFun   string
	RaydiumV4 string
	JupiterV6 string
}

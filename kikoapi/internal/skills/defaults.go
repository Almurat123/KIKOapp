package skills

// DefaultSkills returns a registry pre-filled with stub skills (CopyTrade, Market, Swap, Token, Wallet, etc.).
func DefaultSkills() *Registry {
	reg := NewRegistry()
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "copy_trade", Name: "Copy Trade", Description: "Copy trading", Intents: []string{"COPY_TRADING"}, Tools: []string{"copyTrade"}},
		Prompt:  "Copy trade skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "market", Name: "Market", Description: "Market data", Intents: []string{"MARKET_ANALYSIS"}, Tools: []string{"marketOverview", "gasPrice"}},
		Prompt:  "Market skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "swap", Name: "Swap", Description: "Token swap", Intents: []string{"TRADING"}, Tools: []string{"prepareSwap", "executeSwap"}},
		Prompt:  "Swap skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "token", Name: "Token", Description: "Token info and price", Intents: []string{"TRADING", "MARKET_ANALYSIS"}, Tools: []string{"tokenInfo", "tokenPrice", "trendingTokens"}},
		Prompt:  "Token skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "wallet", Name: "Wallet", Description: "Wallet and PNL", Intents: []string{"TRADING"}, Tools: []string{"walletInfo", "userFavorites", "dunePnl"}},
		Prompt:  "Wallet skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "risk", Name: "Risk", Description: "Token risk scan", Intents: []string{"RISK_SCAN"}, Tools: []string{"tokenRisk"}},
		Prompt:  "Risk skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "social", Name: "Social", Description: "Farcaster/social", Intents: []string{"SOCIAL_SENSING"}, Tools: []string{"farcasterTrending"}},
		Prompt:  "Social skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "polymarket", Name: "Polymarket", Description: "Prediction markets", Intents: []string{"PREDICTION_MARKETS"}, Tools: []string{"polymarketTrade"}},
		Prompt:  "Polymarket skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "zora", Name: "Zora", Description: "Zora launchpad", Intents: []string{"TRADING"}, Tools: []string{"zoraTools"}},
		Prompt:  "Zora skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "token_alert", Name: "Token Alert", Description: "Token alerts", Intents: []string{"TRADING"}, Tools: []string{"tokenAlert"}},
		Prompt:  "Token alert skill.",
	})
	reg.Register(&Skill{
		Metadata: SkillMetadata{ID: "cross_chain", Name: "Cross Chain", Description: "Cross-chain", Intents: []string{"TRADING"}, Tools: []string{"crossChain"}},
		Prompt:  "Cross chain skill.",
	})
	return reg
}

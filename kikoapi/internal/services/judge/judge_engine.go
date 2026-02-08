package judge

import (
	"context"
	"time"

	"kikoapi/internal/types"
)

// TokenDataProvider provides token data for the judge (e.g. from DexScreener/GeckoTerminal).
type TokenDataProvider interface {
	GetTokenData(ctx context.Context, tokenAddress string, chainID int) (*types.TokenData, error)
}

// SecurityProvider provides token security check (e.g. RiskSkill).
type SecurityProvider interface {
	CheckTokenSecurity(ctx context.Context, tokenAddress string, chainID int) (*types.SecurityData, error)
}

// JudgeRepository persists judge decisions.
type JudgeRepository interface {
	SaveJudgeDecision(ctx context.Context, output *types.DecisionEngineOutput, analysisTimeMs int) (string, error)
}

// RunJudgeEngine runs the full 5-layer judge and returns DecisionEngineOutput.
func RunJudgeEngine(
	ctx context.Context,
	tokenAddress string,
	chainID int,
	userAmountUsd float64,
	targetWallet string,
	tokenDataProvider TokenDataProvider,
	securityProvider SecurityProvider,
	judgeRepo JudgeRepository,
	disabled bool,
) (*types.DecisionEngineOutput, error) {
	out := &types.DecisionEngineOutput{}
	out.DecisionEngine.Input = types.DecisionEngineInput{
		UserAmount:    userAmountUsd,
		TokenAddress:  tokenAddress,
		LaunchpadType: "unknown",
		Chain:         getChainName(chainID),
		ChainID:       chainID,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		TargetWallet:  targetWallet,
	}

	if disabled {
		out.DecisionEngine.FinalDecision = types.FinalDecisionOutput{
			Decision:         types.FinalAllowWithRisk,
			Reasons:          []string{"Judge engine disabled"},
			OverallRiskScore: 50,
			SlippageEstimate: 0,
		}
		out.DecisionEngine.DecisionID = "disabled"
		return out, nil
	}

	start := time.Now()

	tokenData := &types.TokenData{Address: tokenAddress, Liquidity: 0}
	securityData := &types.SecurityData{}

	if tokenDataProvider != nil {
		if td, err := tokenDataProvider.GetTokenData(ctx, tokenAddress, chainID); err == nil && td != nil {
			tokenData = td
		}
	}
	if securityProvider != nil {
		if sd, err := securityProvider.CheckTokenSecurity(ctx, tokenAddress, chainID); err == nil && sd != nil {
			securityData = sd
		}
	}

	out.DecisionEngine.Input.LaunchpadType = DetectLaunchpadType(
		tokenAddress,
		tokenData.PoolAddress,
		getChainName(chainID),
	)

	userSizeLayer := EvaluateUserSizeLayer(userAmountUsd)
	isPump := false
	for _, s := range []string{"pump", "pump.fun"} {
		if s == out.DecisionEngine.Input.LaunchpadType {
			isPump = true
			break
		}
	}
	liquidityLayer := EvaluateLiquidityLayer(
		tokenData.Liquidity,
		userAmountUsd,
		false,
		isPump,
	)
	structureLayer := EvaluateStructureLayer(
		out.DecisionEngine.Input.LaunchpadType,
		nil,
		&securityData.LpLocked,
		0.7,
	)
	nowMs := time.Now().UnixMilli()
	contractAgeMins := CalculateContractAgeMinutes(tokenData.PairCreatedAt, nowMs)
	stageLayer := EvaluateStageLayer(contractAgeMins, false)

	tokenIntelInput := DefaultTokenIntelligenceInput()
	if ctx != nil {
		if tw, web, err := AnalyzeTokenWithGrok(ctx, tokenData.Symbol, tokenAddress, "", ""); err == nil {
			if tw != nil {
				tokenIntelInput.SocialPresence.TwitterActive = tw.TwitterActive
				tokenIntelInput.SocialPresence.TwitterFollowers = tw.TwitterFollowers
				tokenIntelInput.SocialPresence.HasKolMentions = tw.HasKOLMentions
				tokenIntelInput.SocialPresence.Score = 0.5
				if tw.TwitterFollowers > 1000 {
					tokenIntelInput.SocialPresence.Score = 0.7
				}
			}
			if web != nil && web.WebsiteReachable {
				tokenIntelInput.WebsiteQuality.HasWebsite = true
				tokenIntelInput.WebsiteQuality.WebsiteReachable = true
				tokenIntelInput.WebsiteQuality.Score = 0.6
			}
		}
	}
	tokenIntelLayer := EvaluateTokenIntelligenceLayer(tokenIntelInput)

	out.DecisionEngine.Layers = types.DecisionEngineLayers{
		UserSizeLayer:         userSizeLayer,
		LiquidityLayer:        liquidityLayer,
		StructureLayer:        structureLayer,
		StageLayer:            stageLayer,
		TokenIntelligenceLayer: tokenIntelLayer,
	}

	finalInput := FinalDecisionInput{
		UserSizeLayer:         userSizeLayer,
		LiquidityLayer:        liquidityLayer,
		StructureLayer:        structureLayer,
		StageLayer:            stageLayer,
		TokenIntelligenceLayer: tokenIntelLayer,
	}
	out.DecisionEngine.FinalDecision = MakeFinalDecision(finalInput)

	analysisTimeMs := int(time.Since(start).Milliseconds())
	if judgeRepo != nil {
		if id, err := judgeRepo.SaveJudgeDecision(ctx, out, analysisTimeMs); err == nil {
			out.DecisionEngine.DecisionID = id
		}
	}

	return out, nil
}

func getChainName(chainID int) string {
	switch chainID {
	case 1:
		return "ethereum"
	case 8453:
		return "base"
	case 56:
		return "bsc"
	case 42161:
		return "arbitrum"
	case 137:
		return "polygon"
	default:
		return "unknown"
	}
}

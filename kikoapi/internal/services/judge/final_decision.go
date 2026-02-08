package judge

import (
	"kikoapi/internal/types"
)

// FinalDecisionInput holds all layer outputs for final decision.
type FinalDecisionInput struct {
	UserSizeLayer         types.UserSizeLayer
	LiquidityLayer        types.LiquidityLayer
	StructureLayer        types.StructureLayer
	StageLayer            types.StageLayer
	TokenIntelligenceLayer types.TokenIntelligenceLayer
}

// MakeFinalDecision combines all 5 layers using priority order and returns final decision.
func MakeFinalDecision(input FinalDecisionInput) types.FinalDecisionOutput {
	var reasons []string

	if input.LiquidityLayer.LiquidityDecision == types.LayerBlock {
		return types.FinalDecisionOutput{
			Decision:         types.FinalBlock,
			OverallRiskScore: input.LiquidityLayer.LiquidityRiskScore,
			SlippageEstimate: input.LiquidityLayer.SlippageEstimate,
			Reasons:          append([]string{"Liquidity layer block - pool depth too low or slippage too high"}, input.LiquidityLayer.Reasons...),
		}
	}
	if input.StructureLayer.StructureDecision == types.LayerBlock {
		return types.FinalDecisionOutput{
			Decision:         types.FinalBlock,
			OverallRiskScore: input.StructureLayer.StructureRiskScore,
			SlippageEstimate: input.LiquidityLayer.SlippageEstimate,
			Reasons:          append([]string{"Structure layer block - launchpad mechanism risk too high"}, input.StructureLayer.Reasons...),
		}
	}

	if input.TokenIntelligenceLayer.TokenIntelligenceLabel == types.TokenIntelligenceDanger {
		return types.FinalDecisionOutput{
			Decision:         types.FinalBlock,
			OverallRiskScore: input.TokenIntelligenceLayer.TokenIntelligenceScore,
			SlippageEstimate: input.LiquidityLayer.SlippageEstimate,
			Reasons:          append([]string{"Token intelligence block - project info insufficient or clear red flags"}, input.TokenIntelligenceLayer.Reasons...),
		}
	}

	overallProjectRisk := input.LiquidityLayer.LiquidityRiskScore*0.35 +
		input.StructureLayer.StructureRiskScore*0.25 +
		input.StageLayer.StageRiskScore*0.20 +
		input.TokenIntelligenceLayer.TokenIntelligenceScore*0.20

	userSizeCompat := IsUserSizeCompatible(
		input.UserSizeLayer,
		overallProjectRisk,
		input.LiquidityLayer.SlippageEstimate,
	)
	if !userSizeCompat.Compatible && input.UserSizeLayer.UserSizeLevel == types.UserSizeL4 {
		return types.FinalDecisionOutput{
			Decision:         types.FinalBlock,
			OverallRiskScore: overallProjectRisk,
			SlippageEstimate: input.LiquidityLayer.SlippageEstimate,
			Reasons:          append([]string{"User size block - position size too large for this risk level"}, userSizeCompat.Warnings...),
		}
	}

	hasLiquidityRisk := input.LiquidityLayer.LiquidityDecision == types.LayerAllowWithRisk
	hasStructureRisk := input.StructureLayer.StructureDecision == types.LayerAllowWithRisk
	hasStageRisk := input.StageLayer.StageDecision == types.LayerAllowWithRisk
	hasTokenIntelRisk := input.TokenIntelligenceLayer.TokenIntelligenceLabel == types.TokenIntelligenceWeak
	hasUserSizeRisk := !userSizeCompat.Compatible

	riskCount := 0
	if hasLiquidityRisk {
		riskCount++
	}
	if hasStructureRisk {
		riskCount++
	}
	if hasStageRisk {
		riskCount++
	}
	if hasTokenIntelRisk {
		riskCount++
	}
	if hasUserSizeRisk {
		riskCount++
	}

	var finalDecision types.FinalDecision
	switch riskCount {
	case 0:
		finalDecision = types.FinalAllow
		reasons = append(reasons, "All layers passed - risk is manageable")
	case 1:
		finalDecision = types.FinalAllowWithRisk
		reasons = append(reasons, "1 risk factor found - proceed with caution")
	case 2:
		finalDecision = types.FinalAllowWithRisk
		reasons = append(reasons, "2 risk factors found - monitor closely")
	default:
		finalDecision = types.FinalAllowWithRisk
		reasons = append(reasons, "Multiple risk factors - high caution")
	}

	if hasLiquidityRisk && len(input.LiquidityLayer.Reasons) > 0 {
		reasons = append(reasons, "Liquidity: "+input.LiquidityLayer.Reasons[0])
	}
	if hasStructureRisk && len(input.StructureLayer.Reasons) > 0 {
		reasons = append(reasons, "Structure: "+input.StructureLayer.Reasons[0])
	}
	if hasStageRisk && len(input.StageLayer.Reasons) > 0 {
		reasons = append(reasons, "Stage: "+input.StageLayer.Reasons[0])
	}
	if hasTokenIntelRisk && len(input.TokenIntelligenceLayer.Reasons) > 0 {
		reasons = append(reasons, "Token intelligence: "+input.TokenIntelligenceLayer.Reasons[0])
	}
	if hasUserSizeRisk && len(userSizeCompat.Warnings) > 0 {
		reasons = append(reasons, "User size: "+userSizeCompat.Warnings[0])
	}
	if input.TokenIntelligenceLayer.TokenIntelligenceLabel == types.TokenIntelligenceStrong {
		reasons = append(reasons, "Project information is strong and reliable")
	}
	if input.LiquidityLayer.LpDepthUSD > 50000 {
		reasons = append(reasons, "Liquidity is strong")
	}

	return types.FinalDecisionOutput{
		Decision:         finalDecision,
		OverallRiskScore: overallProjectRisk,
		SlippageEstimate: input.LiquidityLayer.SlippageEstimate,
		Reasons:          reasons,
	}
}

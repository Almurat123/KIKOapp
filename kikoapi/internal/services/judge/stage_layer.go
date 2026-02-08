package judge

import (
	"fmt"

	"kikoapi/internal/types"
)

// EvaluateStageLayer evaluates token lifecycle stage based on contract age (minutes).
func EvaluateStageLayer(contractAgeMinutes int, isMigrated bool) types.StageLayer {
	var reasons []string
	var stage types.TokenStage
	var riskScore float64
	var decision types.LayerDecision

	if isMigrated {
		stage = types.StageS4
		riskScore = 0.5
		decision = types.LayerAllowWithRisk
		reasons = append(reasons, "Token migrated - contract switch risk", "Post-migration state needs extra verification")
		return types.StageLayer{
			Stage:            stage,
			ContractAgeMins:   contractAgeMinutes,
			StageRiskScore:   riskScore,
			StageDecision:    decision,
			Reasons:          reasons,
		}
	}

	if contractAgeMinutes < 10 {
		stage = types.StageS0
		riskScore = 0.2
		decision = types.LayerAllowWithRisk
		reasons = append(reasons, fmt.Sprintf("Just created (%d minutes) - extreme uncertainty", contractAgeMinutes), "Price and liquidity may be highly volatile", "Recommend a small test size only")
	} else if contractAgeMinutes < 120 {
		stage = types.StageS1
		riskScore = 0.4
		decision = types.LayerAllowWithRisk
		ageDisplay := fmt.Sprintf("%d minutes", contractAgeMinutes)
		if contractAgeMinutes >= 60 {
			ageDisplay = fmt.Sprintf("%.1f hours", float64(contractAgeMinutes)/60)
		}
		reasons = append(reasons, fmt.Sprintf("Early stage (%s) - high volatility", ageDisplay), "Smart money entries may create opportunities")
	} else if contractAgeMinutes < 1440 {
		stage = types.StageS2
		riskScore = 0.6
		decision = types.LayerAllow
		hours := float64(contractAgeMinutes) / 60
		reasons = append(reasons, fmt.Sprintf("Mid-term (%.1f hours) - establishing pattern", hours))
	} else {
		stage = types.StageS3
		riskScore = 0.8
		decision = types.LayerAllow
		reasons = append(reasons, fmt.Sprintf("Stable (%d+ hours) - more predictable", contractAgeMinutes/60))
	}

	return types.StageLayer{
		Stage:          stage,
		ContractAgeMins: contractAgeMinutes,
		StageRiskScore: riskScore,
		StageDecision:  decision,
		Reasons:        reasons,
	}
}

// CalculateContractAgeMinutes returns contract age in minutes from pairCreatedAt (unix ms).
// If nowUnixMs is 0, current time is not applied and 0 is returned when pairCreatedAt is set.
func CalculateContractAgeMinutes(pairCreatedAt *int64, nowUnixMs int64) int {
	if pairCreatedAt == nil || *pairCreatedAt <= 0 {
		return 0
	}
	if nowUnixMs <= 0 {
		return 0
	}
	diffMs := nowUnixMs - *pairCreatedAt
	if diffMs < 0 {
		return 0
	}
	return int(diffMs / (60 * 1000))
}

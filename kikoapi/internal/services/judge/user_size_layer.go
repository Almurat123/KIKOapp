package judge

import (
	"fmt"

	"kikoapi/internal/types"
)

// EvaluateUserSizeLayer evaluates user risk profile based on trade amount (USD).
func EvaluateUserSizeLayer(userAmountUsd float64) types.UserSizeLayer {
	var level types.UserSizeLevel
	var maxSlippage, maxRisk, score float64
	var reasons []string

	if userAmountUsd < 100 {
		level = types.UserSizeL1
		maxSlippage = 0.15
		maxRisk = 0.8
		score = 0.9
		reasons = append(reasons, fmt.Sprintf("Small probe ($%.2f) - loss is manageable", userAmountUsd), "Allows higher slippage and risk tolerance")
	} else if userAmountUsd < 400 {
		level = types.UserSizeL2
		maxSlippage = 0.10
		maxRisk = 0.6
		score = 0.7
		reasons = append(reasons, fmt.Sprintf("Medium amount ($%.2f)", userAmountUsd), "Avoid extremely high-risk projects")
	} else if userAmountUsd < 1500 {
		level = types.UserSizeL3
		maxSlippage = 0.05
		maxRisk = 0.4
		score = 0.5
		reasons = append(reasons, fmt.Sprintf("Large amount ($%.2f) - be cautious", userAmountUsd), "Prefer medium/low risk projects", "Slippage above 5% triggers a warning")
	} else {
		level = types.UserSizeL4
		maxSlippage = 0.03
		maxRisk = 0.25
		score = 0.3
		reasons = append(reasons, fmt.Sprintf("Heavy position ($%.2f) - highly cautious", userAmountUsd), "Only low-risk, high-liquidity projects are suitable", "Slippage above 3% will block", "Avoid very early projects (<1 hour)")
	}

	return types.UserSizeLayer{
		UserSizeLevel:     level,
		MaxSlippageAllowed: maxSlippage,
		MaxRiskAllowed:    maxRisk,
		Score:             score,
		Reasons:           reasons,
	}
}

// UserSizeCompatibility is the result of checking user size vs project risk.
type UserSizeCompatibility struct {
	Compatible bool
	Warnings   []string
}

// IsUserSizeCompatible checks if user size is compatible with given risk level and slippage.
func IsUserSizeCompatible(userSizeLayer types.UserSizeLayer, projectRiskScore, slippageEstimate float64) UserSizeCompatibility {
	var warnings []string
	compatible := true

	if slippageEstimate > userSizeLayer.MaxSlippageAllowed {
		warnings = append(warnings, fmt.Sprintf("Slippage (%.1f%%) exceeds user tolerance (%.1f%%)",
			slippageEstimate*100, userSizeLayer.MaxSlippageAllowed*100))
		if userSizeLayer.UserSizeLevel == types.UserSizeL4 {
			compatible = false
		}
	}

	projectRisk := 1 - projectRiskScore
	if projectRisk > userSizeLayer.MaxRiskAllowed {
		warnings = append(warnings, fmt.Sprintf("Project risk (%.0f%%) exceeds user tolerance (%.0f%%)",
			projectRisk*100, userSizeLayer.MaxRiskAllowed*100))
		if userSizeLayer.UserSizeLevel == types.UserSizeL3 || userSizeLayer.UserSizeLevel == types.UserSizeL4 {
			compatible = false
		}
	}

	return UserSizeCompatibility{Compatible: compatible, Warnings: warnings}
}

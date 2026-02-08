package judge

import (
	"fmt"
	"math"

	"kikoapi/internal/types"
)

// EvaluateLiquidityLayer evaluates pool depth vs user amount for slippage/rug risk.
func EvaluateLiquidityLayer(lpDepthUsd, userAmountUsd float64, isFixedPool, isBondingCurve bool) types.LiquidityLayer {
	var reasons []string

	if isFixedPool {
		return types.LiquidityLayer{
			LpDepthUSD:         lpDepthUsd,
			UserAmountUSD:      userAmountUsd,
			SlippageEstimate:   0,
			LiquidityRiskScore: 0.9,
			LiquidityDecision:  types.LayerAllow,
			Reasons:            []string{"Fixed pool pricing - no slippage risk"},
		}
	}

	impactRatio := 0.0
	if lpDepthUsd > 0 {
		impactRatio = userAmountUsd / lpDepthUsd
	}
	slippageEstimate := impactRatio * 2
	if isBondingCurve {
		slippageEstimate = math.Min(0.95, impactRatio*3)
	} else {
		slippageEstimate = math.Min(0.95, impactRatio*2)
	}

	var riskScore float64
	var decision types.LayerDecision

	if lpDepthUsd < 1000 {
		riskScore = 0.1
		decision = types.LayerBlock
		reasons = append(reasons, fmt.Sprintf("Pool is extremely shallow ($%.0f) - high rug risk", lpDepthUsd), "Any amount will cause huge slippage")
	} else if lpDepthUsd < 5000 {
		riskScore = 0.25
		if userAmountUsd > lpDepthUsd*0.05 {
			decision = types.LayerBlock
			reasons = append(reasons, fmt.Sprintf("User amount ($%.0f) is %.1f%% of pool", userAmountUsd, impactRatio*100), "Estimated slippage too high, reduce amount")
		} else {
			decision = types.LayerAllowWithRisk
			reasons = append(reasons, fmt.Sprintf("Pool is shallow ($%.0f) - proceed with caution", lpDepthUsd))
		}
	} else if lpDepthUsd < 20000 {
		if slippageEstimate > 0.15 {
			riskScore = 0.35
			decision = types.LayerAllowWithRisk
			reasons = append(reasons, fmt.Sprintf("Estimated slippage %.1f%% - high", slippageEstimate*100))
		} else if slippageEstimate > 0.05 {
			riskScore = 0.5
			decision = types.LayerAllowWithRisk
			reasons = append(reasons, fmt.Sprintf("Estimated slippage %.1f%%", slippageEstimate*100))
		} else {
			riskScore = 0.6
			decision = types.LayerAllow
			reasons = append(reasons, fmt.Sprintf("Pool depth $%.0f - acceptable", lpDepthUsd))
		}
	} else if lpDepthUsd < 100000 {
		if slippageEstimate > 0.10 {
			riskScore = 0.55
			decision = types.LayerAllowWithRisk
			reasons = append(reasons, fmt.Sprintf("Estimated slippage %.1f%% - user amount is large", slippageEstimate*100))
		} else {
			riskScore = 0.7
			decision = types.LayerAllow
			reasons = append(reasons, fmt.Sprintf("Pool depth $%.0f - good", lpDepthUsd))
		}
	} else {
		riskScore = 0.85
		decision = types.LayerAllow
		reasons = append(reasons, fmt.Sprintf("Pool depth $%.0f - strong", lpDepthUsd))
		if slippageEstimate > 0.01 {
			reasons = append(reasons, fmt.Sprintf("Estimated slippage %.2f%%", slippageEstimate*100))
		}
	}

	if isBondingCurve {
		reasons = append(reasons, "Bonding curve - slippage increases with size")
	}

	return types.LiquidityLayer{
		LpDepthUSD:         lpDepthUsd,
		UserAmountUSD:      userAmountUsd,
		SlippageEstimate:   slippageEstimate,
		LiquidityRiskScore: riskScore,
		LiquidityDecision: decision,
		Reasons:            reasons,
	}
}

// EstimateSlippage returns a simplified slippage estimate (0-1).
func EstimateSlippage(lpDepthUsd, userAmountUsd float64, isBondingCurve bool) float64 {
	if lpDepthUsd <= 0 {
		return 1.0
	}
	impactRatio := userAmountUsd / lpDepthUsd
	multiplier := 2.0
	if isBondingCurve {
		multiplier = 3
	}
	return math.Min(0.95, impactRatio*multiplier)
}

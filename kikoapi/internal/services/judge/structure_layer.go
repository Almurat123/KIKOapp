package judge

import (
	"fmt"
	"regexp"
	"strings"

	"kikoapi/internal/types"
)

// LaunchpadConfig holds optional structure features per launchpad.
var launchpadConfigs = map[string]types.StructureFeatures{
	"pump.fun":    {HasBondingCurve: true, HasFixedPool: false, HasMigration: true, CreatorFee: 0, CurveType: "bonding_curve", LpLockInfo: "locked_after_migration", MetadataQuality: 0.5},
	"clanker":     {HasBondingCurve: false, HasFixedPool: false, HasMigration: false, CreatorFee: 0.01, CurveType: "amm", LpLockInfo: "locked", MetadataQuality: 0.5},
	"zora":        {HasBondingCurve: false, HasFixedPool: true, HasMigration: false, CreatorFee: 0.05, CurveType: "fixed", LpLockInfo: "fixed_pool", MetadataQuality: 0.5},
	"paragraph":   {HasBondingCurve: false, HasFixedPool: true, HasMigration: false, CreatorFee: 0, CurveType: "fixed", LpLockInfo: "fixed_pool", MetadataQuality: 0.5},
	"four.meme":   {HasBondingCurve: true, HasFixedPool: false, HasMigration: true, CreatorFee: 0.01, CurveType: "bonding_curve", LpLockInfo: "unlocked", MetadataQuality: 0.5},
	"bonk.fun":    {HasBondingCurve: true, HasFixedPool: false, HasMigration: true, CreatorFee: 0, CurveType: "bonding_curve", LpLockInfo: "locked_after_migration", MetadataQuality: 0.5},
	"uniswap":     {HasBondingCurve: false, HasFixedPool: false, HasMigration: false, CreatorFee: 0, CurveType: "amm", LpLockInfo: "unknown", MetadataQuality: 0.5},
	"raydium":     {HasBondingCurve: false, HasFixedPool: false, HasMigration: false, CreatorFee: 0, CurveType: "amm", LpLockInfo: "unknown", MetadataQuality: 0.5},
	"unknown":     {HasBondingCurve: false, HasFixedPool: false, HasMigration: false, CreatorFee: 0, CurveType: "unknown", LpLockInfo: "unknown", MetadataQuality: 0.5},
}

var normalizeTypeRe = regexp.MustCompile(`[\s\-_]`)

// EvaluateStructureLayer evaluates launchpad mechanism risks.
func EvaluateStructureLayer(launchpadType string, customFeatures *types.StructureFeatures, lpLocked *bool, metadataQuality float64) types.StructureLayer {
	var reasons []string
	normalized := normalizeTypeRe.ReplaceAllString(strings.ToLower(launchpadType), "")
	base, ok := launchpadConfigs[normalized]
	if !ok {
		base = launchpadConfigs["unknown"]
	}
	features := base
	if metadataQuality > 0 {
		features.MetadataQuality = metadataQuality
	}
	if lpLocked != nil {
		if *lpLocked {
			features.LpLockInfo = "locked"
		} else {
			features.LpLockInfo = "unlocked"
		}
	}
	if customFeatures != nil {
		if customFeatures.HasBondingCurve {
			features.HasBondingCurve = true
		}
		if customFeatures.HasFixedPool {
			features.HasFixedPool = true
		}
		if customFeatures.HasMigration {
			features.HasMigration = true
		}
		if customFeatures.CreatorFee > 0 {
			features.CreatorFee = customFeatures.CreatorFee
		}
		if customFeatures.CurveType != "" {
			features.CurveType = customFeatures.CurveType
		}
		if customFeatures.LpLockInfo != "" {
			features.LpLockInfo = customFeatures.LpLockInfo
		}
		if customFeatures.MetadataQuality > 0 {
			features.MetadataQuality = customFeatures.MetadataQuality
		}
	}

	riskScore := 0.5
	decision := types.LayerAllow

	if features.HasMigration {
		riskScore -= 0.1
		reasons = append(reasons, "Has migration mechanism - contract switch risk")
	}
	switch features.LpLockInfo {
	case "locked", "locked_after_migration":
		riskScore += 0.15
		reasons = append(reasons, "LP locked - reduces rug risk")
	case "unlocked":
		riskScore -= 0.2
		decision = types.LayerAllowWithRisk
		reasons = append(reasons, "LP unlocked - rug risk")
	case "unknown":
		riskScore -= 0.1
		reasons = append(reasons, "LP lock status unknown")
	}
	if features.CreatorFee > 0.05 {
		riskScore -= 0.15
		decision = types.LayerAllowWithRisk
		reasons = append(reasons, fmt.Sprintf("High creator fee (%.1f%%) - extraction risk", features.CreatorFee*100))
	} else if features.CreatorFee > 0 {
		riskScore -= 0.05
		reasons = append(reasons, fmt.Sprintf("Creator fee: %.1f%%", features.CreatorFee*100))
	}
	if features.HasBondingCurve {
		reasons = append(reasons, "Bonding curve - early buys may have price advantage")
	}
	if features.HasFixedPool {
		riskScore += 0.1
		reasons = append(reasons, "Fixed pool - no slippage risk")
	}
	if features.MetadataQuality >= 0.7 {
		riskScore += 0.1
		reasons = append(reasons, "Metadata complete")
	} else if features.MetadataQuality < 0.3 {
		riskScore -= 0.1
		reasons = append(reasons, "Metadata incomplete")
	}
	if normalized == "unknown" || !ok {
		riskScore -= 0.15
		if decision == types.LayerAllow {
			decision = types.LayerAllowWithRisk
		}
		reasons = append(reasons, "Unknown launchpad - mechanism risk unknown")
	} else {
		reasons = append([]string{"Launchpad: " + launchpadType}, reasons...)
	}

	if riskScore < 0 {
		riskScore = 0
	}
	if riskScore > 1 {
		riskScore = 1
	}
	if riskScore < 0.35 {
		decision = types.LayerBlock
		reasons = append(reasons, "Structure risk too high - block")
	}

	return types.StructureLayer{
		LaunchpadType:      launchpadType,
		StructureFeatures:  features,
		StructureRiskScore: riskScore,
		StructureDecision:  decision,
		Reasons:            reasons,
	}
}

// DetectLaunchpadType returns launchpad type from token/pool/chain. Stub: returns "unknown" until detector is wired.
func DetectLaunchpadType(tokenAddress, poolAddress, chainLower string) string {
	_ = tokenAddress
	_ = poolAddress
	_ = chainLower
	return "unknown"
}

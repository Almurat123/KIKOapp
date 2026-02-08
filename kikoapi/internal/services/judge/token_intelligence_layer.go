package judge

import (
	"kikoapi/internal/types"
)

// TokenIntelligenceInput aggregates the 5 sub-module outputs for token intelligence.
type TokenIntelligenceInput struct {
	ProjectIdentity   types.ProjectIdentity
	SocialPresence    types.SocialPresence
	NarrativeStrength types.NarrativeStrength
	WebsiteQuality    types.WebsiteQuality
	RiskSignals       types.RiskSignals
}

// EvaluateTokenIntelligenceLayer aggregates sub-modules into TokenIntelligenceLayer.
func EvaluateTokenIntelligenceLayer(input TokenIntelligenceInput) types.TokenIntelligenceLayer {
	var reasons, riskTags []string

	score := input.RiskSignals.Score*0.35 +
		input.SocialPresence.Score*0.25 +
		input.ProjectIdentity.Score*0.20 +
		input.NarrativeStrength.Score*0.10 +
		input.WebsiteQuality.Score*0.10

	var label types.TokenIntelligenceLabel
	switch {
	case score >= 0.75:
		label = types.TokenIntelligenceStrong
		reasons = append(reasons, "Project information is complete and credible")
	case score >= 0.50:
		label = types.TokenIntelligenceMedium
		reasons = append(reasons, "Project information is moderate with some risk")
	case score >= 0.25:
		label = types.TokenIntelligenceWeak
		reasons = append(reasons, "Project information is limited; credibility is questionable")
	default:
		label = types.TokenIntelligenceDanger
		reasons = append(reasons, "Project information is severely lacking or has clear red flags")
	}

	if input.RiskSignals.ScamReportsFound {
		riskTags = append(riskTags, "scam-reports")
	}
	if input.RiskSignals.RugReportsFound {
		riskTags = append(riskTags, "rug-reports")
	}
	if input.RiskSignals.HoneypotReportsFound {
		riskTags = append(riskTags, "honeypot")
	}
	if input.SocialPresence.Score >= 0.7 {
		riskTags = append(riskTags, "strong-social")
		reasons = append(reasons, "Social presence is strong")
	} else if input.SocialPresence.Score < 0.3 {
		riskTags = append(riskTags, "weak-social")
		reasons = append(reasons, "Social presence is weak or inactive")
	}
	if input.SocialPresence.HasKolMentions {
		riskTags = append(riskTags, "kol-mentioned")
	}
	if input.ProjectIdentity.Score < 0.3 {
		riskTags = append(riskTags, "no-identity")
	}
	if !input.ProjectIdentity.ContractVerified {
		riskTags = append(riskTags, "unverified-contract")
	}
	if input.NarrativeStrength.NarrativeType != "unknown" {
		riskTags = append(riskTags, input.NarrativeStrength.NarrativeType)
	}
	if input.NarrativeStrength.Score < 0.4 {
		riskTags = append(riskTags, "weak-narrative")
	}

	return types.TokenIntelligenceLayer{
		ProjectIdentity:        input.ProjectIdentity,
		SocialPresence:         input.SocialPresence,
		NarrativeStrength:      input.NarrativeStrength,
		WebsiteQuality:         input.WebsiteQuality,
		RiskSignals:            input.RiskSignals,
		TokenIntelligenceScore: score,
		TokenIntelligenceLabel: label,
		RiskTags:               riskTags,
		Reasons:                reasons,
	}
}

// DefaultTokenIntelligenceInput returns a neutral input when no external data is available.
func DefaultTokenIntelligenceInput() TokenIntelligenceInput {
	return TokenIntelligenceInput{
		ProjectIdentity:   types.ProjectIdentity{Score: 0.5},
		SocialPresence:    types.SocialPresence{Score: 0.5},
		NarrativeStrength: types.NarrativeStrength{Score: 0.5, NarrativeType: "unknown"},
		WebsiteQuality:    types.WebsiteQuality{Score: 0.5},
		RiskSignals:       types.RiskSignals{Score: 0.5},
	}
}

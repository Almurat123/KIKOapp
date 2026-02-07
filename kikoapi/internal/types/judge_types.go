// Package types: Judge System Types (Launchpad Decision Engine).
// Migrated from kiko-api/src/types/judgeTypes.ts

package types

// DecisionEngineInput is the input to the decision engine.
type DecisionEngineInput struct {
	UserAmount    float64 `json:"user_amount"`
	TokenAddress  string  `json:"token_address"`
	LaunchpadType string  `json:"launchpad_type"`
	Chain         string  `json:"chain"`
	ChainID       int     `json:"chain_id"`
	Timestamp     string  `json:"timestamp"`
	TargetWallet  string  `json:"target_wallet,omitempty"`
}

// UserSizeLevel represents user size tier.
type UserSizeLevel string

const (
	UserSizeL1 UserSizeLevel = "L1"
	UserSizeL2 UserSizeLevel = "L2"
	UserSizeL3 UserSizeLevel = "L3"
	UserSizeL4 UserSizeLevel = "L4"
)

// UserSizeLayer holds user size layer output.
type UserSizeLayer struct {
	UserSizeLevel     UserSizeLevel `json:"user_size_level"`
	MaxSlippageAllowed float64      `json:"max_slippage_allowed"`
	MaxRiskAllowed    float64      `json:"max_risk_allowed"`
	Score             float64      `json:"score"`
	Reasons           []string    `json:"reasons"`
}

// UserSizeThreshold defines min/max and label for a tier.
type UserSizeThreshold struct {
	Min   float64 `json:"min,omitempty"`
	Max   float64 `json:"max,omitempty"`
	Label string  `json:"label"`
}

// USER_SIZE_THRESHOLDS holds tier thresholds (USD).
var USER_SIZE_THRESHOLDS = map[UserSizeLevel]UserSizeThreshold{
	UserSizeL1: {Max: 100, Label: "Small Probe"},
	UserSizeL2: {Min: 100, Max: 400, Label: "Medium"},
	UserSizeL3: {Min: 400, Max: 1500, Label: "Large"},
	UserSizeL4: {Min: 1500, Label: "Heavy Position"},
}

// LayerDecision is the decision from a layer.
type LayerDecision string

const (
	LayerAllow        LayerDecision = "ALLOW"
	LayerAllowWithRisk LayerDecision = "ALLOW_WITH_RISK"
	LayerBlock        LayerDecision = "BLOCK"
)

// LiquidityLayer holds liquidity layer output.
type LiquidityLayer struct {
	LpDepthUSD         float64        `json:"lp_depth_usd"`
	UserAmountUSD      float64        `json:"user_amount_usd"`
	SlippageEstimate   float64        `json:"slippage_estimate"`
	LiquidityRiskScore float64        `json:"liquidity_risk_score"`
	LiquidityDecision LayerDecision  `json:"liquidity_decision"`
	Reasons            []string       `json:"reasons"`
}

// StructureFeatures describes launchpad structure.
type StructureFeatures struct {
	HasBondingCurve   bool    `json:"has_bonding_curve"`
	HasFixedPool      bool    `json:"has_fixed_pool"`
	HasMigration      bool    `json:"has_migration"`
	CreatorFee        float64 `json:"creator_fee"`
	CurveType         string  `json:"curve_type"`
	LpLockInfo        string  `json:"lp_lock_info"`
	MetadataQuality   float64 `json:"metadata_quality"`
}

// StructureLayer holds structure layer output.
type StructureLayer struct {
	LaunchpadType     string           `json:"launchpad_type"`
	StructureFeatures StructureFeatures `json:"structure_features"`
	StructureRiskScore float64         `json:"structure_risk_score"`
	StructureDecision LayerDecision   `json:"structure_decision"`
	Reasons           []string        `json:"reasons"`
}

// TokenStage represents token lifecycle stage.
type TokenStage string

const (
	StageS0 TokenStage = "S0"
	StageS1 TokenStage = "S1"
	StageS2 TokenStage = "S2"
	StageS3 TokenStage = "S3"
	StageS4 TokenStage = "S4"
)

// StageLayer holds stage layer output.
type StageLayer struct {
	Stage           TokenStage   `json:"stage"`
	ContractAgeMins int          `json:"contract_age_minutes"`
	StageRiskScore  float64     `json:"stage_risk_score"`
	StageDecision   LayerDecision `json:"stage_decision"`
	Reasons         []string    `json:"reasons"`
}

// StageThreshold defines stage thresholds.
type StageThreshold struct {
	Min   int     `json:"min,omitempty"`
	Max   int     `json:"max,omitempty"`
	Label string  `json:"label"`
	Risk  float64 `json:"risk,omitempty"`
}

// STAGE_THRESHOLDS holds stage thresholds (minutes).
var STAGE_THRESHOLDS = map[TokenStage]StageThreshold{
	StageS0: {Max: 10, Label: "Just Created", Risk: 0.2},
	StageS1: {Min: 10, Max: 120, Label: "Early", Risk: 0.4},
	StageS2: {Min: 120, Max: 1440, Label: "Mid-term", Risk: 0.6},
	StageS3: {Min: 1440, Label: "Stable", Risk: 0.8},
	StageS4: {Label: "Post-Migration / Special", Risk: 0.5},
}

// ProjectIdentity holds project identity metrics.
type ProjectIdentity struct {
	HasOfficialTwitter       bool    `json:"has_official_twitter"`
	HasTeamIdentity          bool    `json:"has_team_identity"`
	HasLogo                  bool    `json:"has_logo"`
	HasDescription           bool    `json:"has_description"`
	ContractVerified         bool    `json:"contract_verified"`
	ContractAgeHours         float64 `json:"contract_age_hours"`
	LaunchpadMetadataQuality float64 `json:"launchpad_metadata_quality"`
	Score                    float64 `json:"score"`
}

// SocialPresence holds social presence metrics.
type SocialPresence struct {
	TwitterActive             bool    `json:"twitter_active"`
	TwitterFollowers          int     `json:"twitter_followers"`
	HasKolMentions            bool    `json:"has_kol_mentions"`
	CommunityDiscussionLevel  float64 `json:"community_discussion_level"`
	TelegramActive            bool    `json:"telegram_active"`
	DiscordActive             bool    `json:"discord_active"`
	Score                     float64 `json:"score"`
}

// NarrativeStrength holds narrative metrics.
type NarrativeStrength struct {
	NarrativeType        string  `json:"narrative_type"`
	NarrativeStrength    float64 `json:"narrative_strength"`
	NarrativeAlignment   float64 `json:"narrative_alignment"`
	NarrativeConsistency float64 `json:"narrative_consistency"`
	Score                float64 `json:"score"`
}

// WebsiteQuality holds website quality metrics.
type WebsiteQuality struct {
	HasWebsite          bool    `json:"has_website"`
	WebsiteReachable    bool    `json:"website_reachable"`
	WebsiteDesignQuality float64 `json:"website_design_quality"`
	WebsiteContentDepth float64 `json:"website_content_depth"`
	HasDocs             bool    `json:"has_docs"`
	HasProduct          bool    `json:"has_product"`
	Score               float64 `json:"score"`
}

// RiskSignals holds risk signal metrics.
type RiskSignals struct {
	ScamReportsFound     bool    `json:"scam_reports_found"`
	RugReportsFound      bool    `json:"rug_reports_found"`
	HoneypotReportsFound bool    `json:"honeypot_reports_found"`
	NegativeSentimentScore float64 `json:"negative_sentiment_score"`
	DeployerReputation   float64 `json:"deployer_reputation"`
	Score                float64 `json:"score"`
}

// TokenIntelligenceLabel is the aggregate label.
type TokenIntelligenceLabel string

const (
	TokenIntelligenceStrong TokenIntelligenceLabel = "strong"
	TokenIntelligenceMedium TokenIntelligenceLabel = "medium"
	TokenIntelligenceWeak   TokenIntelligenceLabel = "weak"
	TokenIntelligenceDanger TokenIntelligenceLabel = "danger"
)

// TokenIntelligenceLayer holds token intelligence layer output.
type TokenIntelligenceLayer struct {
	ProjectIdentity       ProjectIdentity   `json:"project_identity"`
	SocialPresence        SocialPresence   `json:"social_presence"`
	NarrativeStrength     NarrativeStrength `json:"narrative_strength"`
	WebsiteQuality        WebsiteQuality   `json:"website_quality"`
	RiskSignals           RiskSignals      `json:"risk_signals"`
	TokenIntelligenceScore  float64         `json:"token_intelligence_score"`
	TokenIntelligenceLabel TokenIntelligenceLabel `json:"token_intelligence_label"`
	RiskTags              []string         `json:"risk_tags"`
	Reasons               []string         `json:"reasons"`
}

// FinalDecision is the final decision type.
type FinalDecision string

const (
	FinalAllow         FinalDecision = "ALLOW"
	FinalAllowWithRisk FinalDecision = "ALLOW_WITH_RISK"
	FinalBlock         FinalDecision = "BLOCK"
)

// FinalDecisionOutput holds the final decision output.
type FinalDecisionOutput struct {
	Decision           FinalDecision `json:"decision"`
	OverallRiskScore   float64       `json:"overall_risk_score"`
	OverallRiskLevel   string        `json:"overall_risk_level,omitempty"`
	SlippageEstimate   float64       `json:"slippage_estimate"`
	Reasons            []string      `json:"reasons"`
	AiRationale        string        `json:"ai_rationale,omitempty"`
}

// DecisionEngineLayers aggregates all layer outputs.
type DecisionEngineLayers struct {
	UserSizeLayer         UserSizeLayer         `json:"user_size_layer"`
	LiquidityLayer        LiquidityLayer        `json:"liquidity_layer"`
	StructureLayer        StructureLayer        `json:"structure_layer"`
	StageLayer            StageLayer            `json:"stage_layer"`
	TokenIntelligenceLayer TokenIntelligenceLayer `json:"token_intelligence_layer"`
}

// DecisionEngineOutput is the full decision engine response.
type DecisionEngineOutput struct {
	DecisionEngine struct {
		Input          DecisionEngineInput  `json:"input"`
		Layers         DecisionEngineLayers `json:"layers"`
		FinalDecision FinalDecisionOutput  `json:"final_decision"`
		DecisionID    string               `json:"decision_id,omitempty"`
	} `json:"decision_engine"`
}

// TokenData is helper type for token data.
type TokenData struct {
	Address        string  `json:"address"`
	Symbol         string  `json:"symbol"`
	Name           string  `json:"name"`
	Price          float64 `json:"price"`
	Liquidity      float64 `json:"liquidity"`
	Fdv            float64 `json:"fdv"`
	MarketCap      float64 `json:"marketCap"`
	PriceChange5m  float64 `json:"priceChange5m"`
	PriceChange1h  float64 `json:"priceChange1h"`
	PriceChange24h float64 `json:"priceChange24h"`
	PairCreatedAt  *int64  `json:"pairCreatedAt,omitempty"`
	PoolAddress    string  `json:"poolAddress,omitempty"`
	Socials        []struct {
		Type string `json:"type"`
		URL  string `json:"url"`
	} `json:"socials,omitempty"`
	Websites []struct {
		URL string `json:"url"`
	} `json:"websites,omitempty"`
}

// SecurityDataStatus is the status string for SecurityData.
type SecurityDataStatus string

const (
	SecurityStatusUnknown  SecurityDataStatus = "Unknown"
	SecurityStatusSafe     SecurityDataStatus = "Safe"
	SecurityStatusWarning  SecurityDataStatus = "Warning"
	SecurityStatusHighRisk SecurityDataStatus = "High Risk"
	SecurityStatusCritical SecurityDataStatus = "Critical"
	SecurityStatusMedium   SecurityDataStatus = "Medium"
)

// SecurityDataDetails holds security detail flags.
type SecurityDataDetails struct {
	IsOpenSource      bool `json:"isOpenSource"`
	HasRenouncedOwner bool `json:"hasRenouncedOwner"`
	IsMintable        bool `json:"isMintable"`
	CanDisableTrade   bool `json:"canDisableTrade"`
	IsBlacklisted     bool `json:"isBlacklisted"`
}

// SecurityData is helper type for token security.
type SecurityData struct {
	Status         SecurityDataStatus  `json:"status"`
	RiskScore      float64             `json:"riskScore"`
	IsHoneypot     bool                `json:"isHoneypot"`
	IsMintable     bool                `json:"isMintable"`
	IsProxy        bool                `json:"isProxy"`
	BuyTax         float64             `json:"buyTax"`
	SellTax        float64             `json:"sellTax"`
	Warnings       []string            `json:"warnings"`
	Positives      []string            `json:"positives"`
	Recommendation string              `json:"recommendation"`
	Details        SecurityDataDetails `json:"details"`
	Source         string              `json:"source"`
	LpLocked       bool                `json:"lpLocked"`
}

package ai

// IntentType is the high-level intent (TRADING, COPY_TRADING, etc.).
type IntentType string

const (
	IntentTrading          IntentType = "TRADING"
	IntentCopyTrading      IntentType = "COPY_TRADING"
	IntentMarketAnalysis   IntentType = "MARKET_ANALYSIS"
	IntentPredictionMarkets IntentType = "PREDICTION_MARKETS"
	IntentSocialSensing    IntentType = "SOCIAL_SENSING"
	IntentRiskScan         IntentType = "RISK_SCAN"
	IntentGeneralChat      IntentType = "GENERAL_CHAT"
)

// ModelType is deepseek or grok.
type ModelType string

const (
	ModelDeepseek ModelType = "deepseek"
	ModelGrok     ModelType = "grok"
)

// UserContext holds user/wallet context for the orchestrator.
type UserContext struct {
	UserAddress        string
	SolanaAddress      string
	ChainID            int
	ChainName          string
	IsWalletConnected  bool
	NativeBalance      string
	PageContext        string
	CurrentPage        string
	PendingSwapToken   *PendingSwapToken
	ToolConfig         interface{}
	IntentHints        *IntentHints
}

// PendingSwapToken is a token pending swap.
type PendingSwapToken struct {
	Address  string
	Symbol   string
	ChainID  int
}

// IntentHints provide hints for intent resolution.
type IntentHints struct {
	Conflict string
	Question string
	Labels   []string
}

// OrchestratorOptions configures the prompt orchestrator.
type OrchestratorOptions struct {
	Mode        string // "default" | "strict" | "experiment"
	Agent       string // "kiko-terminal" | "copytrade"
	RoutingMode string // "thinking" | "execution"
}

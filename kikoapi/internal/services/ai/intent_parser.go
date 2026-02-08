package ai

import "context"

// HighLevelIntentType is the same as IntentType for high-level classification.
type HighLevelIntentType = IntentType

// DetailedIntentType is a finer-grained intent (token_info, swap, etc.).
type DetailedIntentType string

const (
	DetailedTokenInfo     DetailedIntentType = "token_info"
	DetailedTokenSearch   DetailedIntentType = "token_search"
	DetailedSwap          DetailedIntentType = "swap"
	DetailedWalletInfo    DetailedIntentType = "wallet_info"
	DetailedMarketData    DetailedIntentType = "market_data"
	DetailedGeneralQuery  DetailedIntentType = "general_query"
)

// IntentDecision is the result of intent parsing.
type IntentDecision struct {
	Primary    HighLevelIntentType
	Confidence float64
	Labels     []struct {
		Label      HighLevelIntentType
		Confidence float64
	}
	Evidence  []IntentLabelScore
	Conflict  *IntentConflict
	Detailed  DetailedIntentType
}

// IntentLabelScore holds label and confidence from one source.
type IntentLabelScore struct {
	Label      HighLevelIntentType
	Confidence float64
	Evidence   []string
	Source     string // "rule" | "classifier" | "llm"
}

// IntentConflict describes conflicting intents.
type IntentConflict struct {
	Type    string
	Labels  []HighLevelIntentType
	Question string
}

// ParseIntent parses user message and context into IntentDecision. Stub: returns GENERAL_CHAT until classifier is wired.
func ParseIntent(ctx context.Context, message string, userContext *UserContext) (*IntentDecision, error) {
	_ = ctx
	_ = message
	_ = userContext
	return &IntentDecision{
		Primary:   IntentGeneralChat,
		Confidence: 0.5,
		Detailed:  DetailedGeneralQuery,
	}, nil
}

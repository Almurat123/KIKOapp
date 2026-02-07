// Package config: Environment configuration (from kiko-api env.ts).
// Variable names match kiko-api env.example.

package config

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"
)

// Env holds loaded environment configuration.
type Env struct {
	Port         int
	NodeEnv      string
	DatabaseURL  string
	Redis        RedisConfig
	APIKeys      APIKeysConfig
	AppKey       string
	XAI          XAIConfig
	DuneQueries  DuneQueriesConfig
	CORSOrigin   string
	APIConfig    APIConfig
	CacheConfig  CacheConfig
	SwapConfig   SwapConfig
	PlatformFees PlatformFeesConfig
	Billing      BillingConfig
	UsageLimits  UsageLimitsConfig
	Security     SecurityConfig
	AIModel      string
	LogLevel     string
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
}

type APIKeysConfig struct {
	Coingecko     string
	Defillama     string
	Alternative   string
	Dune          string
	SimDune       string
	Finnhub       string
	Newsapi       string
	Cryptocompare string
	Neynar        string
	Alphavantage  string
	Fred          string
	Goplus        string
	Quickintel    string
	Etherscan     string
	Routescan     string
	Blockscout    string
	Solscan       string
	Alchemy       string
	Moralis       string
	ZeroEx        string
	Jupiter       string
	OKXApiKey     string
	OKXSecretKey  string
	OKXPassphrase string
	OKXProjectID  string
	InfuraGas     string
	InfuraGasSecret string
	Infura        string
	Quicknode     string
	Helius        string
	Ankr          string
	CoinbaseCdp   string
	CoinbaseCdpKeyID string
	CoinbaseCdpKeySecret string
	Paragraph     string
	ResendApiKey  string
	CMC           string
}

type XAIConfig struct {
	APIKey string
}

type DuneQueriesConfig struct {
	APIKey                string
	MarketOverview        *int
	ChainsData            *int
	UnifiedMarket         *int
	FarcasterQualityUsers int
}

type APIConfig struct {
	RequestTimeout int
	MaxRequestSize int
	RateLimit      RateLimitConfig
}

type RateLimitConfig struct {
	WindowMs    int
	MaxRequests int
}

type CacheConfig struct {
	DefaultTTL       int
	SecurityCacheTTL int
	NewsCacheTTL    int
}

type SwapConfig struct {
	MaxTradeHistory        int
	MaxPendingTransactions int
	TradeRecordTTL         int
	PendingTransactionTTL  int
}

type PlatformFeesConfig struct {
	Enabled        bool
	SwapBps        int
	CopyTradeBps   int
	CopyTradeAiBps int
	EVMRecipient   string
	SolanaRecipient string
}

type BillingConfig struct {
	Enabled           bool
	ChainID           int
	TokenAddress      string
	TokenDecimals     int
	FeeRecipient      string
	PriceCacheTtlSec  int
	MinLiquidityUsd   float64
	DailyFreeDeepseek int
	DailyFreeGrok     int
	UsdMultiplier     float64
	ToolPricePerCall  float64
	TermsVersion      string
	DeepseekModels    []string
	GrokModels        []string
	ModelPricing      map[string]ModelPricingEntry
}

type ModelPricingEntry struct {
	PromptUsdPer1M     float64 `json:"promptUsdPer1M"`
	CompletionUsdPer1M float64 `json:"completionUsdPer1M"`
}

type UsageTier struct {
	MinBalance float64 `json:"minBalance"`
	DailyLimit int     `json:"dailyLimit"`
}

type UsageLimitsConfig struct {
	Enabled         bool
	ChainID         int
	TokenAddress    string
	TokenDecimals   int
	BaseDailyLimit  int
	Tiers           []UsageTier
}

type SecurityConfig struct {
	AlchemyWebhookSecret      string
	AlchemyWebhookSecretBase  string
	AlchemyWebhookSecretBsc   string
	AlchemyWebhookSecretSol   string
	InternalWebhookSecret     string
	AllowUnsignedAlchemyWebhook bool
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	s := os.Getenv(key)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

func getEnvFloat(key string, defaultVal float64) float64 {
	s := os.Getenv(key)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return defaultVal
	}
	return v
}

func getEnvBool(key string) bool {
	s := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	return s == "true" || s == "1"
}

func parseUsageTiers(jsonStr string, baseLimit int) []UsageTier {
	defaultTiers := []UsageTier{
		{MinBalance: 0, DailyLimit: baseLimit},
		{MinBalance: 10_000_000, DailyLimit: 20},
		{MinBalance: 50_000_000, DailyLimit: 25},
	}
	if jsonStr == "" {
		return defaultTiers
	}
	var raw []struct {
		MinBalance interface{} `json:"minBalance"`
		DailyLimit interface{} `json:"dailyLimit"`
	}
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return defaultTiers
	}
	out := make([]UsageTier, 0, len(raw))
	for _, t := range raw {
		var minB float64
		switch v := t.MinBalance.(type) {
		case float64:
			minB = v
		case int:
			minB = float64(v)
		default:
			continue
		}
		var lim int
		switch v := t.DailyLimit.(type) {
		case float64:
			lim = int(v)
		case int:
			lim = v
		default:
			lim = baseLimit
		}
		out = append(out, UsageTier{MinBalance: minB, DailyLimit: lim})
	}
	if len(out) == 0 {
		return defaultTiers
	}
	return out
}

func parseModelPricing(jsonStr string) map[string]ModelPricingEntry {
	defaultPricing := map[string]ModelPricingEntry{
		"grok-4-1-fast-reasoning":    {PromptUsdPer1M: 0.20, CompletionUsdPer1M: 0.50},
		"grok-4-1-fast-non-reasoning": {PromptUsdPer1M: 0.20, CompletionUsdPer1M: 0.50},
		"deepseek-chat":              {PromptUsdPer1M: 0.285714, CompletionUsdPer1M: 0.428571},
		"deepseek-reasoner":          {PromptUsdPer1M: 0.285714, CompletionUsdPer1M: 0.428571},
	}
	if jsonStr == "" {
		return defaultPricing
	}
	var out map[string]ModelPricingEntry
	if err := json.Unmarshal([]byte(jsonStr), &out); err != nil {
		return defaultPricing
	}
	return out
}

func splitTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// LoadEnv loads and returns environment configuration.
func LoadEnv() (*Env, error) {
	platformFeesEnabled := getEnvBool("PLATFORM_FEES_ENABLED")
	swapBps := 0
	copyTradeBps := 0
	copyTradeAiBps := 0
	if platformFeesEnabled {
		swapBps = getEnvInt("PLATFORM_FEE_SWAP_BPS", 50)
		copyTradeBps = getEnvInt("PLATFORM_FEE_COPY_TRADE_BPS", 100)
		copyTradeAiBps = getEnvInt("PLATFORM_FEE_COPY_TRADE_AI_BPS", 150)
	}

	billingChainId := getEnvInt("BILLING_CHAIN_ID", 8453)
	billingTokenDecimals := getEnvInt("BILLING_TOKEN_DECIMALS", 18)
	billingPriceCacheTtlSec := getEnvInt("BILLING_PRICE_CACHE_TTL_SEC", 600)
	billingMinLiquidityUsd := getEnvFloat("BILLING_DEXSCREENER_MIN_LIQUIDITY_USD", 5000)
	billingDailyFreeDeepseek := getEnvInt("BILLING_DAILY_FREE_DEEPSEEK", 10)
	billingDailyFreeGrok := getEnvInt("BILLING_DAILY_FREE_GROK", 3)
	billingUsdMultiplier := getEnvFloat("BILLING_USD_MULTIPLIER", 3)
	billingToolPricePerCall := getEnvFloat("BILLING_TOOL_PRICE_PER_CALL", 0.005)

	usageBaseDailyLimit := getEnvInt("USAGE_LIMITS_BASE_DAILY_LIMIT", 15)
	usageChainId := getEnvInt("USAGE_LIMITS_CHAIN_ID", 8453)
	usageTokenDecimals := getEnvInt("USAGE_LIMITS_TOKEN_DECIMALS", 18)

	duneFarcaster := getEnvInt("DUNE_FARCASTER_QUALITY_USERS_QUERY_ID", 3023113)
	var duneMarket, duneChains, duneUnified *int
	if v := getEnvInt("DUNE_MARKET_OVERVIEW_QUERY_ID", 0); v != 0 {
		duneMarket = &v
	}
	if v := getEnvInt("DUNE_CHAINS_DATA_QUERY_ID", 0); v != 0 {
		duneChains = &v
	}
	if v := getEnvInt("DUNE_UNIFIED_MARKET_QUERY_ID", 0); v != 0 {
		duneUnified = &v
	}

	deepseekModels := splitTrim(getEnv("BILLING_DEEPSEEK_MODELS", "deepseek-chat,deepseek-reasoner"), ",")
	grokModels := splitTrim(getEnv("BILLING_GROK_MODELS", "grok-4-1-fast-reasoning,grok-4-1-fast-non-reasoning"), ",")

	env := &Env{
		Port:        getEnvInt("PORT", 3001),
		NodeEnv:     getEnv("NODE_ENV", "development"),
		DatabaseURL: getEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/kiko_db"),
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: os.Getenv("REDIS_PASSWORD"),
		},
		APIKeys: APIKeysConfig{
			Coingecko:     os.Getenv("COINGECKO_API_KEY"),
			Defillama:     os.Getenv("DEFILLAMA_API_KEY"),
			Alternative:   os.Getenv("ALTERNATIVE_API_KEY"),
			Dune:          os.Getenv("DUNE_API_KEY"),
			SimDune:       os.Getenv("SIM_DUNE_API_KEY"),
			Finnhub:       os.Getenv("FINNHUB_API_KEY"),
			Newsapi:       os.Getenv("NEWSAPI_API_KEY"),
			Cryptocompare: os.Getenv("CRYPTOCOMPARE_API_KEY"),
			Neynar:        os.Getenv("NEYNAR_API_KEY"),
			Alphavantage:  os.Getenv("ALPHAVANTAGE_API_KEY"),
			Fred:          os.Getenv("FRED_API_KEY"),
			Goplus:        os.Getenv("GOPLUS_API_KEY"),
			Quickintel:    os.Getenv("QUICKINTEL_API_KEY"),
			Etherscan:     os.Getenv("ETHERSCAN_API_KEY"),
			Routescan:     os.Getenv("ROUTESCAN_API_KEY"),
			Blockscout:    os.Getenv("BLOCKSCOUT_API_KEY"),
			Solscan:       os.Getenv("SOLSCAN_API_KEY"),
			Alchemy:       os.Getenv("ALCHEMY_API_KEY"),
			Moralis:       os.Getenv("MORALIS_API_KEY"),
			ZeroEx:        os.Getenv("ZEROX_API_KEY"),
			Jupiter:       os.Getenv("JUPITER_API_KEY"),
			OKXApiKey:     os.Getenv("OKX_API_KEY"),
			OKXSecretKey:  os.Getenv("OKX_SECRET_KEY"),
			OKXPassphrase: os.Getenv("OKX_PASSPHRASE"),
			OKXProjectID:  os.Getenv("OKX_PROJECT_ID"),
			InfuraGas:     os.Getenv("INFURA_GAS_API_KEY"),
			InfuraGasSecret: os.Getenv("INFURA_GAS_API_SECRET"),
			Infura:        os.Getenv("INFURA_API_KEY"),
			Quicknode:     os.Getenv("QUICKNODE_API_KEY"),
			Helius:        os.Getenv("HELIUS_API_KEY"),
			Ankr:          os.Getenv("ANKR_API_KEY"),
			CoinbaseCdp:   os.Getenv("COINBASE_CDP_API_KEY_ID"),
			CoinbaseCdpKeyID: os.Getenv("COINBASE_CDP_API_KEY_ID"),
			CoinbaseCdpKeySecret: os.Getenv("COINBASE_CDP_API_KEY_SECRET"),
			Paragraph:     os.Getenv("PARAGRAPH_API_KEY"),
			ResendApiKey:  os.Getenv("RESEND_API_KEY"),
			CMC:           os.Getenv("CMC_PRO_API_KEY"),
		},
		AppKey: getEnv("KIKO_WEB_APP_KEY", ""),
		XAI:    XAIConfig{APIKey: getEnv("XAI_API_KEY", "")},
		DuneQueries: DuneQueriesConfig{
			APIKey:                os.Getenv("DUNE_API_KEY"),
			MarketOverview:        duneMarket,
			ChainsData:            duneChains,
			UnifiedMarket:         duneUnified,
			FarcasterQualityUsers: duneFarcaster,
		},
		CORSOrigin: getEnv("CORS_ORIGIN", "http://localhost:5173"),
		APIConfig: APIConfig{
			RequestTimeout: getEnvInt("REQUEST_TIMEOUT", 30000),
			MaxRequestSize: getEnvInt("MAX_REQUEST_SIZE", 10485760),
			RateLimit: RateLimitConfig{
				WindowMs:    getEnvInt("RATE_LIMIT_WINDOW_MS", 60000),
				MaxRequests: getEnvInt("RATE_LIMIT_MAX_REQUESTS", 500),
			},
		},
		CacheConfig: CacheConfig{
			DefaultTTL:       getEnvInt("CACHE_DEFAULT_TTL", 300),
			SecurityCacheTTL: getEnvInt("CACHE_SECURITY_TTL", 300),
			NewsCacheTTL:     getEnvInt("CACHE_NEWS_TTL", 180),
		},
		SwapConfig: SwapConfig{
			MaxTradeHistory:        getEnvInt("MAX_TRADE_HISTORY", 100),
			MaxPendingTransactions: getEnvInt("MAX_PENDING_TRANSACTIONS", 10),
			TradeRecordTTL:         getEnvInt("TRADE_RECORD_TTL", 86400000),
			PendingTransactionTTL:  getEnvInt("PENDING_TRANSACTION_TTL", 600000),
		},
		PlatformFees: PlatformFeesConfig{
			Enabled:          platformFeesEnabled,
			SwapBps:          swapBps,
			CopyTradeBps:     copyTradeBps,
			CopyTradeAiBps:   copyTradeAiBps,
			EVMRecipient:     os.Getenv("PLATFORM_FEE_EVM_RECIPIENT"),
			SolanaRecipient:  os.Getenv("PLATFORM_FEE_SOLANA_RECIPIENT"),
		},
		Billing: BillingConfig{
			Enabled:            getEnvBool("BILLING_ENABLED"),
			ChainID:            billingChainId,
			TokenAddress:       os.Getenv("BILLING_TOKEN_ADDRESS"),
			TokenDecimals:      billingTokenDecimals,
			FeeRecipient:       os.Getenv("BILLING_FEE_RECIPIENT"),
			PriceCacheTtlSec:   billingPriceCacheTtlSec,
			MinLiquidityUsd:    billingMinLiquidityUsd,
			DailyFreeDeepseek:  billingDailyFreeDeepseek,
			DailyFreeGrok:      billingDailyFreeGrok,
			UsdMultiplier:      billingUsdMultiplier,
			ToolPricePerCall:   billingToolPricePerCall,
			TermsVersion:       getEnv("BILLING_TERMS_VERSION", "billing-terms-v1"),
			DeepseekModels:     deepseekModels,
			GrokModels:         grokModels,
			ModelPricing:       parseModelPricing(os.Getenv("BILLING_MODEL_PRICING_JSON")),
		},
		UsageLimits: UsageLimitsConfig{
			Enabled:        getEnvBool("USAGE_LIMITS_ENABLED"),
			ChainID:        usageChainId,
			TokenAddress:   os.Getenv("USAGE_LIMITS_TOKEN_ADDRESS"),
			TokenDecimals:  usageTokenDecimals,
			BaseDailyLimit: usageBaseDailyLimit,
			Tiers:          parseUsageTiers(os.Getenv("USAGE_LIMITS_TIERS_JSON"), usageBaseDailyLimit),
		},
		Security: SecurityConfig{
			AlchemyWebhookSecret:        os.Getenv("ALCHEMY_WEBHOOK_SECRET"),
			AlchemyWebhookSecretBase:    os.Getenv("ALCHEMY_WEBHOOK_SECRET_BASE"),
			AlchemyWebhookSecretBsc:     os.Getenv("ALCHEMY_WEBHOOK_SECRET_BSC"),
			AlchemyWebhookSecretSol:     os.Getenv("ALCHEMY_WEBHOOK_SECRET_SOL"),
			InternalWebhookSecret:       os.Getenv("INTERNAL_WEBHOOK_SECRET"),
			AllowUnsignedAlchemyWebhook: getEnvBool("ALCHEMY_WEBHOOK_ALLOW_UNSIGNED"),
		},
		AIModel:  getEnv("AI_MODEL", "grok-4-1-fast-reasoning"),
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}
	return env, nil
}

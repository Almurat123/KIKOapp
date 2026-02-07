// Package config: Log codes and metadata (from kiko-api logRegistry.ts).

package config

// LogRole categorizes logs by intent.
type LogRole string

const (
	LogRoleAudit  LogRole = "AUDIT"
	LogRoleMetric LogRole = "METRIC"
	LogRoleEvent  LogRole = "EVENT"
	LogRoleTrace  LogRole = "TRACE"
)

// LogCode constants for structured logging.
const (
	LogSysStartup       = "SYS-1001"
	LogSysShutdown      = "SYS-1002"
	LogSysConfigChange  = "SYS-1003"
	LogSysDBConnected   = "SYS-1004"
	LogSysRedisConnected = "SYS-1005"
	LogSysError         = "SYS-1006"
	LogSysInfo          = "SYS-1007"
	LogSysAggReport     = "SYS-1008"
	LogJobHeartbeat     = "SYS-1009"

	LogWtcScanStarted   = "WTC-2001"
	LogWtcSwapDetected  = "WTC-2002"
	LogWtcTxSkipped     = "WTC-2003"
	LogWtcCacheInit     = "WTC-2004"
	LogWtcRpcError      = "WTC-2005"
	LogCtradeError      = "WTC-2006"

	LogDecSuccess         = "DEC-3001"
	LogDecFailedNoLogs    = "DEC-3002"
	LogDecFailedUnknownDex = "DEC-3003"
	LogDecPriceImpactHigh = "DEC-3004"
	LogDecAiRiskCheck     = "DEC-3005"
	LogDecSwapDetection   = "DEC-3006"
	LogDataRecovery       = "DEC-3007"
	LogDataCorruption     = "DEC-3008"

	LogExeQuoteFetched    = "EXE-4001"
	LogExeTxBroadcast     = "EXE-4002"
	LogExeTxConfirmed     = "EXE-4003"
	LogExeTxReverted      = "EXE-4004"
	LogExeGasTooLow       = "EXE-4005"
	LogExeInsufficientFunds = "EXE-4006"
	LogExeSlippageExceeded = "EXE-4007"
	LogExeMinAmountNotMet = "EXE-4008"
	LogTxStart            = "TX-4009"
	LogTxFailed           = "TX-4010"

	LogApiFetchSuccess = "API-5001"
	LogApiFetchFailed  = "API-5002"
	LogApiTimeout      = "API-5003"
	LogApiRateLimit    = "API-5004"
	LogApiAuthFailed   = "API-5005"
	LogApiNotifyFailed = "API-5006"

	LogAiIntentParsed    = "AI-6001"
	LogAiIntentFailed    = "AI-6002"
	LogAiPromptGenerated = "AI-6003"
	LogAiTokenDetected   = "AI-6004"
	LogAiLaunchpadDetected = "AI-6005"
	LogAiToolFiltered    = "AI-6006"
	LogAiApiCall         = "AI-6007"
	LogAiApiError        = "AI-6012"
	LogAiToolUsed        = "AI-6008"
	LogAiModeRouted      = "AI-6009"
	LogAiSkillsAttached  = "AI-6010"
	LogAiOrchestrator    = "AI-6011"

	LogSocCastFetched     = "SOC-7001"
	LogSocUserLookup      = "SOC-7002"
	LogSocTrendingUpdated = "SOC-7003"
	LogSocFollowDetected  = "SOC-7004"

	LogWsConnectionOpened = "WS-8001"
	LogWsConnectionClosed = "WS-8002"
	LogWsMessageReceived  = "WS-8003"
	LogWsMessageSent      = "WS-8004"
	LogWsError            = "WS-8005"

	LogDbQuerySlow          = "DB-9001"
	LogDbTransactionFailed  = "DB-9002"
	LogCacheHit             = "CH-9003"
	LogCacheMiss            = "CH-9004"
	LogCacheInvalidated     = "CH-9005"

	LogPerfMetric = "PRF-0001"
)

// LogMetadata holds optional fields for log entries.
type LogMetadata struct {
	Role      LogRole `json:"role,omitempty"`
	TraceID   string  `json:"traceId,omitempty"`
	UserID    string  `json:"userId,omitempty"`
	ChainID   int     `json:"chainId,omitempty"`
	TxHash    string  `json:"txHash,omitempty"`
	Token     string  `json:"token,omitempty"`
	DurationMs int64  `json:"durationMs,omitempty"`
	Action    string  `json:"action,omitempty"`
	Extra     map[string]interface{} `json:"-"`
}

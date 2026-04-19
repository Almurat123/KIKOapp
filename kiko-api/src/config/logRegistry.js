"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogCode = exports.LogRole = void 0;
/**
 * Log Role
 * Categorizes logs by their primary intent.
 */
var LogRole;
(function (LogRole) {
    LogRole["AUDIT"] = "AUDIT";
    LogRole["METRIC"] = "METRIC";
    LogRole["EVENT"] = "EVENT";
    LogRole["TRACE"] = "TRACE";
})(LogRole || (exports.LogRole = LogRole = {}));
var LogCode;
(function (LogCode) {
    // --- System & Infrastructure (1xxx) ---
    LogCode["SYS_STARTUP"] = "SYS-1001";
    LogCode["SYS_SHUTDOWN"] = "SYS-1002";
    LogCode["SYS_CONFIG_CHANGE"] = "SYS-1003";
    LogCode["SYS_DB_CONNECTED"] = "SYS-1004";
    LogCode["SYS_REDIS_CONNECTED"] = "SYS-1005";
    LogCode["SYS_ERROR"] = "SYS-1006";
    LogCode["SYS_INFO"] = "SYS-1007";
    LogCode["SYS_AGG_REPORT"] = "SYS-1008";
    LogCode["JOB_HEARTBEAT"] = "SYS-1009";
    // --- Watcher & Detection (2xxx) ---
    LogCode["WTC_SCAN_STARTED"] = "WTC-2001";
    LogCode["WTC_SWAP_DETECTED"] = "WTC-2002";
    LogCode["WTC_TX_SKIPPED"] = "WTC-2003";
    LogCode["WTC_CACHE_INIT"] = "WTC-2004";
    LogCode["WTC_RPC_ERROR"] = "WTC-2005";
    LogCode["CTRADE_ERROR"] = "WTC-2006";
    // --- Decoding & Analysis (3xxx) ---
    LogCode["DEC_SUCCESS"] = "DEC-3001";
    LogCode["DEC_FAILED_NO_LOGS"] = "DEC-3002";
    LogCode["DEC_FAILED_UNKNOWN_DEX"] = "DEC-3003";
    LogCode["DEC_PRICE_IMPACT_HIGH"] = "DEC-3004";
    LogCode["DEC_AI_RISK_CHECK"] = "DEC-3005";
    LogCode["DEC_SWAP_DETECTION"] = "DEC-3006";
    LogCode["DATA_RECOVERY"] = "DEC-3007";
    LogCode["DATA_CORRUPTION"] = "DEC-3008";
    // --- Execution & Blockchain (4xxx) ---
    LogCode["EXE_QUOTE_FETCHED"] = "EXE-4001";
    LogCode["EXE_TX_BROADCAST"] = "EXE-4002";
    LogCode["EXE_TX_CONFIRMED"] = "EXE-4003";
    LogCode["EXE_TX_REVERTED"] = "EXE-4004";
    LogCode["EXE_GAS_TOO_LOW"] = "EXE-4005";
    LogCode["EXE_INSUFFICIENT_FUNDS"] = "EXE-4006";
    LogCode["EXE_SLIPPAGE_EXCEEDED"] = "EXE-4007";
    LogCode["EXE_MIN_AMOUNT_NOT_MET"] = "EXE-4008";
    LogCode["TX_START"] = "TX-4009";
    LogCode["TX_FAILED"] = "TX-4010";
    // --- API & External Services (5xxx) ---
    LogCode["API_FETCH_SUCCESS"] = "API-5001";
    LogCode["API_FETCH_FAILED"] = "API-5002";
    LogCode["API_TIMEOUT"] = "API-5003";
    LogCode["API_RATE_LIMIT"] = "API-5004";
    LogCode["API_AUTH_FAILED"] = "API-5005";
    LogCode["API_NOTIFY_FAILED"] = "API-5006";
    // --- AI & Intelligence (6xxx) ---
    LogCode["AI_INTENT_PARSED"] = "AI-6001";
    LogCode["AI_INTENT_FAILED"] = "AI-6002";
    LogCode["AI_PROMPT_GENERATED"] = "AI-6003";
    LogCode["AI_TOKEN_DETECTED"] = "AI-6004";
    LogCode["AI_LAUNCHPAD_DETECTED"] = "AI-6005";
    LogCode["AI_TOOL_FILTERED"] = "AI-6006";
    LogCode["AI_API_CALL"] = "AI-6007";
    LogCode["AI_API_ERROR"] = "AI-6012";
    LogCode["AI_TOOL_USED"] = "AI-6008";
    LogCode["AI_MODE_ROUTED"] = "AI-6009";
    LogCode["AI_SKILLS_ATTACHED"] = "AI-6010";
    LogCode["AI_ORCHESTRATOR"] = "AI-6011";
    // --- Social & Farcaster (7xxx) ---
    LogCode["SOC_CAST_FETCHED"] = "SOC-7001";
    LogCode["SOC_USER_LOOKUP"] = "SOC-7002";
    LogCode["SOC_TRENDING_UPDATED"] = "SOC-7003";
    LogCode["SOC_FOLLOW_DETECTED"] = "SOC-7004";
    // --- WebSocket & Real-time (8xxx) ---
    LogCode["WS_CONNECTION_OPENED"] = "WS-8001";
    LogCode["WS_CONNECTION_CLOSED"] = "WS-8002";
    LogCode["WS_MESSAGE_RECEIVED"] = "WS-8003";
    LogCode["WS_MESSAGE_SENT"] = "WS-8004";
    LogCode["WS_ERROR"] = "WS-8005";
    // --- Database & Cache (9xxx) ---
    LogCode["DB_QUERY_SLOW"] = "DB-9001";
    LogCode["DB_TRANSACTION_FAILED"] = "DB-9002";
    LogCode["CACHE_HIT"] = "CH-9003";
    LogCode["CACHE_MISS"] = "CH-9004";
    LogCode["CACHE_INVALIDATED"] = "CH-9005";
    // --- Performance & Metrics ---
    LogCode["PERF_METRIC"] = "PRF-0001";
})(LogCode || (exports.LogCode = LogCode = {}));

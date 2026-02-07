/**
 * Log Role
 * Categorizes logs by their primary intent.
 */
export enum LogRole {
    AUDIT = 'AUDIT',   // Critical business trail (e.g. trades, auth)
    METRIC = 'METRIC',  // Quantitative data (e.g. performance, RPC stats)
    EVENT = 'EVENT',    // Lifecycle changes (e.g. startup, config)
    TRACE = 'TRACE',    // Debugging and flow information
}

export enum LogCode {
    // --- System & Infrastructure (1xxx) ---
    SYS_STARTUP = 'SYS-1001',
    SYS_SHUTDOWN = 'SYS-1002',
    SYS_CONFIG_CHANGE = 'SYS-1003',
    SYS_DB_CONNECTED = 'SYS-1004',
    SYS_REDIS_CONNECTED = 'SYS-1005',
    SYS_ERROR = 'SYS-1006',
    SYS_INFO = 'SYS-1007',
    SYS_AGG_REPORT = 'SYS-1008',
    JOB_HEARTBEAT = 'SYS-1009',

    // --- Watcher & Detection (2xxx) ---
    WTC_SCAN_STARTED = 'WTC-2001',
    WTC_SWAP_DETECTED = 'WTC-2002',
    WTC_TX_SKIPPED = 'WTC-2003', // e.g., old tx or already processed
    WTC_CACHE_INIT = 'WTC-2004',
    WTC_RPC_ERROR = 'WTC-2005',
    CTRADE_ERROR = 'WTC-2006',

    // --- Decoding & Analysis (3xxx) ---
    DEC_SUCCESS = 'DEC-3001',
    DEC_FAILED_NO_LOGS = 'DEC-3002',
    DEC_FAILED_UNKNOWN_DEX = 'DEC-3003',
    DEC_PRICE_IMPACT_HIGH = 'DEC-3004',
    DEC_AI_RISK_CHECK = 'DEC-3005',
    DEC_SWAP_DETECTION = 'DEC-3006',
    DATA_RECOVERY = 'DEC-3007',
    DATA_CORRUPTION = 'DEC-3008',

    // --- Execution & Blockchain (4xxx) ---
    EXE_QUOTE_FETCHED = 'EXE-4001',
    EXE_TX_BROADCAST = 'EXE-4002',
    EXE_TX_CONFIRMED = 'EXE-4003',
    EXE_TX_REVERTED = 'EXE-4004',
    EXE_GAS_TOO_LOW = 'EXE-4005',
    EXE_INSUFFICIENT_FUNDS = 'EXE-4006',
    EXE_SLIPPAGE_EXCEEDED = 'EXE-4007',
    EXE_MIN_AMOUNT_NOT_MET = 'EXE-4008',
    TX_START = 'TX-4009',
    TX_FAILED = 'TX-4010',

    // --- API & External Services (5xxx) ---
    API_FETCH_SUCCESS = 'API-5001',
    API_FETCH_FAILED = 'API-5002',
    API_TIMEOUT = 'API-5003',
    API_RATE_LIMIT = 'API-5004',
    API_AUTH_FAILED = 'API-5005',
    API_NOTIFY_FAILED = 'API-5006',

    // --- AI & Intelligence (6xxx) ---
    AI_INTENT_PARSED = 'AI-6001',
    AI_INTENT_FAILED = 'AI-6002',
    AI_PROMPT_GENERATED = 'AI-6003',
    AI_TOKEN_DETECTED = 'AI-6004',
    AI_LAUNCHPAD_DETECTED = 'AI-6005',
    AI_TOOL_FILTERED = 'AI-6006',
    AI_API_CALL = 'AI-6007',
    AI_API_ERROR = 'AI-6012',
    AI_TOOL_USED = 'AI-6008',
    AI_MODE_ROUTED = 'AI-6009',
    AI_SKILLS_ATTACHED = 'AI-6010',
    AI_ORCHESTRATOR = 'AI-6011',

    // --- Social & Farcaster (7xxx) ---
    SOC_CAST_FETCHED = 'SOC-7001',
    SOC_USER_LOOKUP = 'SOC-7002',
    SOC_TRENDING_UPDATED = 'SOC-7003',
    SOC_FOLLOW_DETECTED = 'SOC-7004',

    // --- WebSocket & Real-time (8xxx) ---
    WS_CONNECTION_OPENED = 'WS-8001',
    WS_CONNECTION_CLOSED = 'WS-8002',
    WS_MESSAGE_RECEIVED = 'WS-8003',
    WS_MESSAGE_SENT = 'WS-8004',
    WS_ERROR = 'WS-8005',

    // --- Database & Cache (9xxx) ---
    DB_QUERY_SLOW = 'DB-9001',
    DB_TRANSACTION_FAILED = 'DB-9002',
    CACHE_HIT = 'CH-9003',
    CACHE_MISS = 'CH-9004',
    CACHE_INVALIDATED = 'CH-9005',

    // --- Performance & Metrics ---
    PERF_METRIC = 'PRF-0001',
}

export interface LogMetadata {
    role?: LogRole;  // [Logic]: Unified role for categorization. [Ref]: implementation_plan.md
    traceId?: string;
    userId?: string;
    chainId?: number;
    txHash?: string;
    token?: string;
    durationMs?: number;
    action?: string; // Remediation step
    [key: string]: any;
}

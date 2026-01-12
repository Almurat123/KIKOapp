/**
 * Environment Configuration
 * Validates and loads environment variables
 */

export interface EnvConfig {
    port: number;
    nodeEnv: string;
    databaseUrl: string;
    redis: {
        host: string;
        port: number;
        password?: string;
    };
    apiKeys: {
        coingecko?: string;
        defillama?: string;
        alternative?: string;
        dune?: string;
        simDune?: string; // Sim by Dune API key for wallet/onchain data
        finnhub?: string; // Finnhub API key for flash news
        newsapi?: string; // NewsAPI key for news articles
        cryptocompare?: string; // CryptoCompare API key for news aggregation
        neynar?: string; // Neynar API key for Farcaster data
        alphavantage?: string; // Alpha Vantage API key (optional, free tier available)
        fred?: string; // FRED API key for economic indicators (Federal Reserve Economic Data)
        goplus?: string; // GoPlus Security API key for token security scanning
        quickintel?: string; // QuickIntel API key for honeypot detection
        etherscan?: string; // Etherscan API key for fetching contract source code
        solscan?: string; // Solscan API key
        alchemy?: string; // Alchemy API key for wallet transactions and balances
        zeroEx?: string; // 0x API key for swap quotes and prices
        jupiter?: string; // Jupiter Ultra Swap API key for Solana swaps
        okxApiKey?: string; // OKX DEX API key
        okxSecretKey?: string; // OKX DEX secret
        okxPassphrase?: string; // OKX DEX passphrase
        okxProjectId?: string; // OKX DEX project ID
        infuraGas?: string; // Infura Gas API key
        infuraGasSecret?: string; // Infura Gas API secret
        quicknode?: string; // QuickNode API key
        helius?: string; // Helius API key
        ankr?: string; // Ankr API key
        coinbaseCdp?: string; // Coinbase CDP API key for wallet token balances
        coinbaseCdpKeyId?: string; // Coinbase CDP API Key ID
        coinbaseCdpKeySecret?: string; // Coinbase CDP API Key Secret
        paragraph?: string; // Paragraph API Key
        resendApiKey?: string; // Resend API Key for notifications
    };
    xai: {
        apiKey: string;
    };
    duneQueries?: {
        apiKey?: string; // Added Dune API key for direct query execution
        marketOverview?: number;
        chainsData?: number;
        unifiedMarket?: number;
        farcasterQualityUsers?: number; // Dune query ID for Farcaster quality users (default: 3023113)
    };
    corsOrigin: string;
    // API configuration
    apiConfig: {
        requestTimeout: number; // Request timeout in ms
        maxRequestSize: number; // Max request body size in bytes
        rateLimit: {
            windowMs: number; // Rate limit window in ms
            maxRequests: number; // Max requests per window
        };
    };
    // Cache configuration
    cacheConfig: {
        defaultTtl: number; // Default cache TTL in seconds
        securityCacheTtl: number; // Security scan cache TTL in seconds
        newsCacheTtl: number; // News cache TTL in seconds
    };
    // Swap configuration
    swapConfig: {
        maxTradeHistory: number; // Max trade history records
        maxPendingTransactions: number; // Max pending transactions
        tradeRecordTtl: number; // Trade record TTL in ms
        pendingTransactionTtl: number; // Pending transaction TTL in ms
    };
    security: {
        alchemyWebhookSecret?: string; // Secret for verifying Alchemy webhooks
        internalWebhookSecret?: string; // Secret for verifying internal Go service requests
    };
    aiModel: string; // AI Model for analysis
}

function validateEnv(): EnvConfig {
    const port = parseInt(process.env.PORT || '3001', 10);
    const nodeEnv = process.env.NODE_ENV || 'development';
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kiko_db';
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required');
    }

    return {
        port,
        nodeEnv,
        databaseUrl,
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
        },
        apiKeys: {
            coingecko: process.env.COINGECKO_API_KEY,
            defillama: process.env.DEFILLAMA_API_KEY,
            alternative: process.env.ALTERNATIVE_API_KEY,
            dune: process.env.DUNE_API_KEY,
            simDune: process.env.SIM_DUNE_API_KEY,
            finnhub: process.env.FINNHUB_API_KEY,
            newsapi: process.env.NEWSAPI_API_KEY,
            cryptocompare: process.env.CRYPTOCOMPARE_API_KEY,
            neynar: process.env.NEYNAR_API_KEY,
            alphavantage: process.env.ALPHAVANTAGE_API_KEY,
            fred: process.env.FRED_API_KEY,
            goplus: process.env.GOPLUS_API_KEY,
            quickintel: process.env.QUICKINTEL_API_KEY,
            etherscan: process.env.ETHERSCAN_API_KEY,
            solscan: process.env.SOLSCAN_API_KEY, // Solscan API key
            alchemy: process.env.ALCHEMY_API_KEY,
            zeroEx: process.env.ZEROX_API_KEY,
            jupiter: process.env.JUPITER_API_KEY,
            infuraGas: process.env.INFURA_GAS_API_KEY, // Infura Gas API Key
            infuraGasSecret: process.env.INFURA_GAS_API_SECRET, // Infura Gas API Secret
            quicknode: process.env.QUICKNODE_API_KEY, // QuickNode API Key
            helius: process.env.HELIUS_API_KEY, // Helius API Key
            ankr: process.env.ANKR_API_KEY, // Ankr API Key
            coinbaseCdp: process.env.COINBASE_CDP_API_KEY_ID, // Coinbase CDP API Key ID (deprecated, use KEY_ID and KEY_SECRET)
            coinbaseCdpKeyId: process.env.COINBASE_CDP_API_KEY_ID, // Coinbase CDP API Key ID
            coinbaseCdpKeySecret: process.env.COINBASE_CDP_API_KEY_SECRET, // Coinbase CDP API Key Secret
            paragraph: process.env.PARAGRAPH_API_KEY, // Paragraph API Key
            resendApiKey: process.env.RESEND_API_KEY, // Resend API Key
        },
        xai: {
            apiKey: process.env.XAI_API_KEY || '',
        },
        duneQueries: {
            apiKey: process.env.DUNE_API_KEY, // Added Dune API key for direct query execution
            marketOverview: process.env.DUNE_MARKET_OVERVIEW_QUERY_ID
                ? parseInt(process.env.DUNE_MARKET_OVERVIEW_QUERY_ID, 10)
                : undefined,
            chainsData: process.env.DUNE_CHAINS_DATA_QUERY_ID
                ? parseInt(process.env.DUNE_CHAINS_DATA_QUERY_ID, 10)
                : undefined,
            unifiedMarket: process.env.DUNE_UNIFIED_MARKET_QUERY_ID
                ? parseInt(process.env.DUNE_UNIFIED_MARKET_QUERY_ID, 10)
                : undefined,
            farcasterQualityUsers: process.env.DUNE_FARCASTER_QUALITY_USERS_QUERY_ID
                ? parseInt(process.env.DUNE_FARCASTER_QUALITY_USERS_QUERY_ID, 10)
                : 3023113, // Default query ID from pixelhack/farcaster dashboard
        },
        corsOrigin,
        apiConfig: {
            requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
            maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760', 10), // 10MB default
            rateLimit: {
                windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
                maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10), // Increased from 100 to 500 for development
            },
        },
        cacheConfig: {
            defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10), // 5 minutes
            securityCacheTtl: parseInt(process.env.CACHE_SECURITY_TTL || '300', 10), // 5 minutes
            newsCacheTtl: parseInt(process.env.CACHE_NEWS_TTL || '180', 10), // 3 minutes
        },
        swapConfig: {
            maxTradeHistory: parseInt(process.env.MAX_TRADE_HISTORY || '100', 10),
            maxPendingTransactions: parseInt(process.env.MAX_PENDING_TRANSACTIONS || '10', 10),
            tradeRecordTtl: parseInt(process.env.TRADE_RECORD_TTL || '86400000', 10),
            pendingTransactionTtl: parseInt(process.env.PENDING_TRANSACTION_TTL || '600000', 10),
        },
        security: {
            alchemyWebhookSecret: process.env.ALCHEMY_WEBHOOK_SECRET,
            internalWebhookSecret: process.env.INTERNAL_WEBHOOK_SECRET,
        },
        aiModel: process.env.AI_MODEL || 'grok-beta',
    };
}

export const env = validateEnv();

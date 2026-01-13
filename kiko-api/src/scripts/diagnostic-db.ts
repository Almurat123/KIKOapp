import { prisma, withRetry } from '../db/prisma.js';

interface ModelDefinition {
    prismaName: string;
    dbName: string;
    columns: { name: string; type: string; default?: string; unique?: boolean }[];
    pk?: string[]; // Primary key columns if not 'id'
    uniques?: string[][]; // Composite unique constraints (e.g., [['address', 'chainId']])
}

const SCHEMA_DEFINITIONS: ModelDefinition[] = [
    {
        prismaName: 'user',
        dbName: 'User',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'privyDid', type: 'TEXT', unique: true },
            { name: 'walletAddress', type: 'TEXT', unique: true },
            { name: 'email', type: 'TEXT', unique: true },
            { name: 'solanaWalletAddress', type: 'TEXT' },
            { name: 'referralCode', type: 'TEXT', unique: true },
            { name: 'referredBy', type: 'TEXT' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'walletExport',
        dbName: 'WalletExport',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'walletAddress', type: 'TEXT' },
            { name: 'chainType', type: 'TEXT' },
            { name: 'exportedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ],
        uniques: [['userId', 'walletAddress']]
    },
    {
        prismaName: 'userSettings',
        dbName: 'UserSettings',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT', unique: true },
            { name: 'userRole', type: 'TEXT', default: "'default'" },
            { name: 'defaultSwapAmount', type: 'DOUBLE PRECISION', default: '100' },
            { name: 'defaultSwapUnit', type: 'TEXT', default: "'native'" },
            { name: 'checkTokenBeforeSwap', type: 'BOOLEAN', default: 'TRUE' },
            { name: 'quickSwapMode', type: 'BOOLEAN', default: 'FALSE' },
            { name: 'swapMethod', type: 'TEXT', default: "'swap_card'" },
            { name: 'slippageMode', type: 'TEXT', default: "'auto'" },
            { name: 'customSlippage', type: 'DOUBLE PRECISION', default: '0.5' },
            { name: 'mevProtection', type: 'BOOLEAN', default: 'TRUE' },
            { name: 'priceDeviationCheck', type: 'BOOLEAN', default: 'TRUE' },
            { name: 'copyTradeAIMode', type: 'TEXT', default: "'disabled'" },
            { name: 'fastSwapMode', type: 'BOOLEAN', default: 'FALSE' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'copyTradeConfig',
        dbName: 'CopyTradeConfig',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'targetWallet', type: 'TEXT' },
            { name: 'chainId', type: 'INTEGER', default: '8453' },
            { name: 'buyAmountUsd', type: 'DOUBLE PRECISION' },
            { name: 'maxSlippageBps', type: 'INTEGER', default: '300' },
            { name: 'minMarketCapUsd', type: 'DOUBLE PRECISION' },
            { name: 'minLiquidityUsd', type: 'DOUBLE PRECISION' },
            { name: 'minTargetValueUsd', type: 'DOUBLE PRECISION' },
            { name: 'takeProfitPct', type: 'DOUBLE PRECISION' },
            { name: 'stopLossPct', type: 'DOUBLE PRECISION' },
            { name: 'mirrorSell', type: 'BOOLEAN', default: 'TRUE' },
            { name: 'status', type: 'TEXT', default: "'active'" },
            { name: 'aiAnalysisMode', type: 'TEXT', default: "'disabled'" },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'position',
        dbName: 'Position',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'configId', type: 'TEXT' },
            { name: 'tokenAddress', type: 'TEXT' },
            { name: 'tokenSymbol', type: 'TEXT' },
            { name: 'chainId', type: 'INTEGER' },
            { name: 'entryPrice', type: 'DOUBLE PRECISION' },
            { name: 'entryAmount', type: 'TEXT' },
            { name: 'entryTxHash', type: 'TEXT' },
            { name: 'entryUsdValue', type: 'DOUBLE PRECISION' },
            { name: 'currentPrice', type: 'DOUBLE PRECISION' },
            { name: 'profitLossPct', type: 'DOUBLE PRECISION' },
            { name: 'leaderTxHash', type: 'TEXT' },
            { name: 'leaderBuyPrice', type: 'DOUBLE PRECISION' },
            { name: 'leaderBuyAmount', type: 'DOUBLE PRECISION' },
            { name: 'leaderBuyValueUsd', type: 'DOUBLE PRECISION' },
            { name: 'ourSlippageBps', type: 'INTEGER' },
            { name: 'ourGasUsed', type: 'TEXT' },
            { name: 'ourGasPriceGwei', type: 'DOUBLE PRECISION' },
            { name: 'executionDelayMs', type: 'INTEGER' },
            { name: 'exitPrice', type: 'DOUBLE PRECISION' },
            { name: 'exitAmount', type: 'TEXT' },
            { name: 'exitUsdValue', type: 'DOUBLE PRECISION' },
            { name: 'realizedPnlUsd', type: 'DOUBLE PRECISION' },
            { name: 'realizedPnlPct', type: 'DOUBLE PRECISION' },
            { name: 'holdDurationHours', type: 'DOUBLE PRECISION' },
            { name: 'exitTxHash', type: 'TEXT' },
            { name: 'exitReason', type: 'TEXT' },
            { name: 'status', type: 'TEXT', default: "'open'" },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'closedAt', type: 'TIMESTAMP' }
        ]
    },
    {
        prismaName: 'swapHistory',
        dbName: 'SwapHistory',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'chainId', type: 'INTEGER' },
            { name: 'txHash', type: 'TEXT', unique: true },
            { name: 'tokenInAddress', type: 'TEXT' },
            { name: 'tokenInSymbol', type: 'TEXT' },
            { name: 'tokenInAmount', type: 'TEXT' },
            { name: 'tokenInUsd', type: 'DOUBLE PRECISION' },
            { name: 'tokenOutAddress', type: 'TEXT' },
            { name: 'tokenOutSymbol', type: 'TEXT' },
            { name: 'tokenOutAmount', type: 'TEXT' },
            { name: 'tokenOutUsd', type: 'DOUBLE PRECISION' },
            { name: 'slippageBps', type: 'INTEGER' },
            { name: 'status', type: 'TEXT', default: "'pending'" },
            { name: 'failureReason', type: 'TEXT' },
            { name: 'source', type: 'TEXT', default: "'manual'" },
            { name: 'aiSessionId', type: 'TEXT' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'confirmedAt', type: 'TIMESTAMP' }
        ]
    },
    {
        prismaName: 'leaderWalletStats',
        dbName: 'LeaderWalletStats',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'address', type: 'TEXT' },
            { name: 'chainId', type: 'INTEGER' },
            { name: 'totalTrades', type: 'INTEGER', default: '0' },
            { name: 'buyTrades', type: 'INTEGER', default: '0' },
            { name: 'sellTrades', type: 'INTEGER', default: '0' },
            { name: 'totalVolumeUsd', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'realizedPnlUsd', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'unrealizedPnlUsd', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'totalPnlUsd', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'winCount', type: 'INTEGER', default: '0' },
            { name: 'lossCount', type: 'INTEGER', default: '0' },
            { name: 'winRate', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'bestTradePnl', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'worstTradePnl', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'avgTradePnl', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'firstTradeAt', type: 'TIMESTAMP' },
            { name: 'lastTradeAt', type: 'TIMESTAMP' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ],
        uniques: [['address', 'chainId']]
    },
    {
        prismaName: 'chatSession',
        dbName: 'ChatSession',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'model', type: 'TEXT', default: "'grok-2-1212'" },
            { name: 'status', type: 'TEXT', default: "'active'" },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'chatMessage',
        dbName: 'ChatMessage',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'sessionId', type: 'TEXT' },
            { name: 'role', type: 'TEXT' },
            { name: 'content', type: 'TEXT' },
            { name: 'reasoningContent', type: 'TEXT' },
            { name: 'type', type: 'TEXT', default: "'text'" },
            { name: 'data', type: 'TEXT' },
            { name: 'transactionStatus', type: 'TEXT' },
            { name: 'transactionHash', type: 'TEXT' },
            { name: 'citations', type: 'TEXT' },
            { name: 'usage', type: 'TEXT' },
            { name: 'toolCalls', type: 'TEXT' },
            { name: 'toolCallId', type: 'TEXT' },
            { name: 'messageIndex', type: 'INTEGER' },
            { name: 'status', type: 'TEXT', default: "'complete'" },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'userActivity',
        dbName: 'UserActivity',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'date', type: 'DATE' },
            { name: 'logins', type: 'INTEGER', default: '0' },
            { name: 'chatMessages', type: 'INTEGER', default: '0' },
            { name: 'swapsCount', type: 'INTEGER', default: '0' },
            { name: 'swapVolumeUsd', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'copyTrades', type: 'INTEGER', default: '0' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'polymarketAction',
        dbName: 'PolymarketAction',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'type', type: 'TEXT' },
            { name: 'status', type: 'TEXT' },
            { name: 'marketTitle', type: 'TEXT' },
            { name: 'marketSlug', type: 'TEXT' },
            { name: 'outcome', type: 'TEXT' },
            { name: 'assetId', type: 'TEXT' },
            { name: 'orderId', type: 'TEXT' },
            { name: 'txHash', type: 'TEXT' },
            { name: 'size', type: 'DOUBLE PRECISION' },
            { name: 'price', type: 'DOUBLE PRECISION' },
            { name: 'amount', type: 'DOUBLE PRECISION' },
            { name: 'error', type: 'TEXT' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'trackedWallet',
        dbName: 'TrackedWallet',
        columns: [
            { name: 'address', type: 'TEXT' },
            { name: 'chainId', type: 'INTEGER' },
            { name: 'lastCheckedTx', type: 'TEXT' },
            { name: 'activeConfigs', type: 'INTEGER', default: '0' },
            { name: 'totalTradesTracked', type: 'INTEGER', default: '0' },
            { name: 'lastTradeAt', type: 'TIMESTAMP' },
            { name: 'nickName', type: 'TEXT' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ],
        pk: ['address', 'chainId'],
        uniques: [['address', 'chainId']]
    },
    {
        prismaName: 'copyTradeAnalysis',
        dbName: 'CopyTradeAnalysis',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'configId', type: 'TEXT' },
            { name: 'tokenAddress', type: 'TEXT' },
            { name: 'tokenSymbol', type: 'TEXT' },
            { name: 'aiDecision', type: 'TEXT' },
            { name: 'confidenceScore', type: 'DOUBLE PRECISION' },
            { name: 'analysisJson', type: 'TEXT' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'polymarketCopyConfig',
        dbName: 'PolymarketCopyConfig',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'targetWallet', type: 'TEXT' },
            { name: 'betSizeUsd', type: 'DOUBLE PRECISION', default: '10' },
            { name: 'maxOpenBets', type: 'INTEGER', default: '10' },
            { name: 'status', type: 'TEXT', default: "'active'" },
            { name: 'mirrorSell', type: 'BOOLEAN', default: 'TRUE' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'walletTransaction',
        dbName: 'wallet_transactions',
        columns: [
            { name: 'id', type: 'SERIAL' },
            { name: 'wallet_address', type: 'TEXT' },
            { name: 'chain', type: 'TEXT', default: "'eth'" },
            { name: 'tx_hash', type: 'TEXT' },
            { name: 'tx_type', type: 'TEXT' },
            { name: 'from_address', type: 'TEXT' },
            { name: 'to_address', type: 'TEXT' },
            { name: 'token_symbol', type: 'TEXT' },
            { name: 'token_address', type: 'TEXT' },
            { name: 'token_in_symbol', type: 'TEXT' },
            { name: 'token_out_symbol', type: 'TEXT' },
            { name: 'amount', type: 'TEXT' },
            { name: 'value_usd', type: 'DOUBLE PRECISION' },
            { name: 'block_number', type: 'BIGINT' },
            { name: 'block_timestamp', type: 'TIMESTAMP' },
            { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()' }
        ],
        uniques: [['tx_hash', 'wallet_address']]
    },
    {
        prismaName: 'polymarketPosition',
        dbName: 'PolymarketPosition',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'configId', type: 'TEXT' },
            { name: 'marketSlug', type: 'TEXT' },
            { name: 'conditionId', type: 'TEXT' },
            { name: 'assetId', type: 'TEXT' },
            { name: 'question', type: 'TEXT' },
            { name: 'outcome', type: 'TEXT' },
            { name: 'entryPrice', type: 'DOUBLE PRECISION' },
            { name: 'shares', type: 'DOUBLE PRECISION' },
            { name: 'costBasis', type: 'DOUBLE PRECISION' },
            { name: 'currentPrice', type: 'DOUBLE PRECISION' },
            { name: 'profitLossPct', type: 'DOUBLE PRECISION' },
            { name: 'status', type: 'TEXT', default: "'open'" },
            { name: 'exitReason', type: 'TEXT' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'closedAt', type: 'TIMESTAMP' },
            { name: 'resolvedAt', type: 'TIMESTAMP' }
        ]
    },
    {
        prismaName: 'polymarketApiCreds',
        dbName: 'PolymarketApiCreds',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT', unique: true },
            { name: 'walletAddress', type: 'TEXT' },
            { name: 'apiKey', type: 'TEXT' },
            { name: 'apiSecret', type: 'TEXT' },
            { name: 'passphrase', type: 'TEXT' },
            { name: 'nonce', type: 'INTEGER' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'aiTask',
        dbName: 'AITask',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'sessionId', type: 'TEXT' },
            { name: 'userMessageId', type: 'TEXT' },
            { name: 'assistantMessageId', type: 'TEXT' },
            { name: 'model', type: 'TEXT' },
            { name: 'status', type: 'TEXT', default: "'queued'" },
            { name: 'errorMessage', type: 'TEXT' },
            { name: 'toolContext', type: 'TEXT' },
            { name: 'startedAt', type: 'TIMESTAMP' },
            { name: 'completedAt', type: 'TIMESTAMP' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'messageChunk',
        dbName: 'MessageChunk',
        columns: [
            { name: 'id', type: 'SERIAL' },
            { name: 'messageId', type: 'TEXT' },
            { name: 'chunkIndex', type: 'INTEGER' },
            { name: 'chunkType', type: 'TEXT' },
            { name: 'content', type: 'TEXT' },
            { name: 'reasoningContent', type: 'TEXT' },
            { name: 'metadata', type: 'TEXT' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ],
        uniques: [['messageId', 'chunkIndex']]
    },
    {
        prismaName: 'newsArticle',
        dbName: 'NewsArticle',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'slug', type: 'TEXT', unique: true },
            { name: 'summary', type: 'TEXT' },
            { name: 'content', type: 'TEXT' },
            { name: 'coverImage', type: 'TEXT' },
            { name: 'tokens', type: 'TEXT' },
            { name: 'chains', type: 'TEXT' },
            { name: 'status', type: 'TEXT', default: "'pending'" },
            { name: 'rejectionReason', type: 'TEXT' },
            { name: 'paragraphId', type: 'TEXT' },
            { name: 'paragraphUrl', type: 'TEXT' },
            { name: 'publishedAt', type: 'TIMESTAMP' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'moderationLog',
        dbName: 'ModerationLog',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'sessionId', type: 'TEXT' },
            { name: 'model', type: 'TEXT' },
            { name: 'channel', type: 'TEXT' },
            { name: 'content', type: 'TEXT' },
            { name: 'result', type: 'JSONB' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'favoriteToken',
        dbName: 'FavoriteToken',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'chain', type: 'TEXT' },
            { name: 'address', type: 'TEXT' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ],
        uniques: [['userId', 'chain', 'address']]
    },
    {
        prismaName: 'cache',
        dbName: 'Cache',
        columns: [
            { name: 'key', type: 'TEXT' },
            { name: 'value', type: 'TEXT' },
            { name: 'expiresAt', type: 'TIMESTAMP' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ],
        pk: ['key']
    },
    {
        prismaName: 'trendingToken',
        dbName: 'TrendingToken',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'chain', type: 'TEXT', default: "'eth'" },
            { name: 'address', type: 'TEXT' },
            { name: 'name', type: 'TEXT' },
            { name: 'symbol', type: 'TEXT' },
            { name: 'network', type: 'TEXT' },
            { name: 'image_url', type: 'TEXT' },
            { name: 'price', type: 'DECIMAL' },
            { name: 'price_change_5m', type: 'DECIMAL' },
            { name: 'price_change_1h', type: 'DECIMAL' },
            { name: 'price_change_6h', type: 'DECIMAL' },
            { name: 'price_change_24h', type: 'DECIMAL' },
            { name: 'volume_24h', type: 'DECIMAL' },
            { name: 'liquidity', type: 'DECIMAL' },
            { name: 'fdv', type: 'DECIMAL' },
            { name: 'rank', type: 'INTEGER' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ],
        uniques: [['chain', 'address']]
    },
    {
        prismaName: 'trendingCast',
        dbName: 'trending_casts',
        columns: [
            { name: 'cast_hash', type: 'TEXT' },
            { name: 'fid', type: 'INTEGER' },
            { name: 'author_username', type: 'TEXT' },
            { name: 'author_display_name', type: 'TEXT' },
            { name: 'author_avatar', type: 'TEXT' },
            { name: 'author_verified', type: 'BOOLEAN', default: 'FALSE' },
            { name: 'text', type: 'TEXT' },
            { name: 'timestamp', type: 'TIMESTAMP' },
            { name: 'embeds', type: 'JSONB', default: "'[]'" },
            { name: 'parent_cast_fid', type: 'INTEGER' },
            { name: 'parent_cast_hash', type: 'TEXT' },
            { name: 'stats_likes', type: 'INTEGER', default: '0' },
            { name: 'stats_recasts', type: 'INTEGER', default: '0' },
            { name: 'stats_replies', type: 'INTEGER', default: '0' },
            { name: 'heat_score', type: 'DECIMAL' },
            { name: 'rank', type: 'INTEGER' },
            { name: 'is_base_app_coin', type: 'BOOLEAN', default: 'FALSE' },
            { name: 'base_app_coin_metadata', type: 'JSONB' },
            { name: 'coin_value', type: 'DECIMAL' },
            { name: 'author_bio', type: 'TEXT' },
            { name: 'mentions', type: 'JSONB', default: "'[]'" },
            { name: 'author_creator_coin', type: 'TEXT' },
            { name: 'author_twitter', type: 'TEXT' },
            { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()' }
        ],
        pk: ['cast_hash']
    },
    {
        prismaName: 'userReferral',
        dbName: 'UserReferral',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'referrerId', type: 'TEXT' },
            { name: 'refereeId', type: 'TEXT', unique: true },
            { name: 'referralCode', type: 'TEXT' },
            { name: 'rewardStatus', type: 'TEXT', default: "'pending'" },
            { name: 'rewardAmount', type: 'DOUBLE PRECISION' },
            { name: 'rewardedAt', type: 'TIMESTAMP' },
            { name: 'refereeSwapCount', type: 'INTEGER', default: '0' },
            { name: 'refereeSwapVolumeUsd', type: 'DOUBLE PRECISION', default: '0' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'dataRetentionPolicy',
        dbName: 'DataRetentionPolicy',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'tableName', type: 'TEXT', unique: true },
            { name: 'retentionDays', type: 'INTEGER' },
            { name: 'isEnabled', type: 'BOOLEAN', default: 'TRUE' },
            { name: 'lastCleanedAt', type: 'TIMESTAMP' },
            { name: 'lastCleanedCount', type: 'INTEGER' },
            { name: 'description', type: 'TEXT' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'judgeDecision',
        dbName: 'JudgeDecision',
        columns: [
            { name: 'id', type: 'TEXT' },
            { name: 'tokenAddress', type: 'TEXT' },
            { name: 'tokenSymbol', type: 'TEXT' },
            { name: 'tokenName', type: 'TEXT' },
            { name: 'chainId', type: 'INTEGER' },
            { name: 'userAmountUsd', type: 'DOUBLE PRECISION' },
            { name: 'targetWallet', type: 'TEXT' },
            { name: 'launchpadType', type: 'TEXT' },
            { name: 'liquidity', type: 'DOUBLE PRECISION' },
            { name: 'contractAgeHours', type: 'DOUBLE PRECISION' },
            { name: 'userSizeLayer', type: 'JSONB' },
            { name: 'liquidityLayer', type: 'JSONB' },
            { name: 'structureLayer', type: 'JSONB' },
            { name: 'stageLayer', type: 'JSONB' },
            { name: 'tokenIntelLayer', type: 'JSONB' },
            { name: 'finalDecision', type: 'TEXT' },
            { name: 'overallRiskScore', type: 'DOUBLE PRECISION' },
            { name: 'slippageEstimate', type: 'DOUBLE PRECISION' },
            { name: 'reasons', type: 'JSONB' },
            { name: 'aiRationale', type: 'TEXT' },
            { name: 'fullOutputJson', type: 'TEXT' },
            { name: 'actualExecuted', type: 'BOOLEAN' },
            { name: 'actualProfitPct', type: 'DOUBLE PRECISION' },
            { name: 'actualOutcome', type: 'TEXT' },
            { name: 'outcomeNotes', type: 'TEXT' },
            { name: 'outcomeUpdatedAt', type: 'TIMESTAMP' },
            { name: 'analysisTimeMs', type: 'INTEGER' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'marketOverview',
        dbName: 'MarketOverview',
        columns: [
            { name: 'id', type: 'SERIAL' },
            { name: 'globalMarketCap', type: 'DECIMAL' },
            { name: 'volume24h', type: 'DECIMAL' },
            { name: 'activeUsers', type: 'BIGINT' },
            { name: 'ethGasPrice', type: 'VARCHAR(50)' },
            { name: 'fearGreedIndex', type: 'INTEGER' },
            { name: 'fearGreedClassification', type: 'VARCHAR(50)' },
            { name: 'bitcoinDominance', type: 'DECIMAL' },
            { name: 'altcoinSeasonIndex', type: 'DECIMAL' },
            { name: 'globalOpenInterest', type: 'DECIMAL' },
            { name: 'gasLevel', type: 'DECIMAL' },
            { name: 'gasLevelStatus', type: 'VARCHAR(20)' },
            { name: 'bvix', type: 'DECIMAL' },
            { name: 'evix', type: 'DECIMAL' },
            { name: 'liquidityStressIndex', type: 'DECIMAL' },
            { name: 'liquidityStressStatus', type: 'VARCHAR(20)' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'chainMetric',
        dbName: 'ChainMetric',
        columns: [
            { name: 'id', type: 'SERIAL' },
            { name: 'chain_name', type: 'VARCHAR(50)', unique: true },
            { name: 'tvl', type: 'DECIMAL' },
            { name: 'tvl_change_24h', type: 'DECIMAL' },
            { name: 'volume_24h', type: 'DECIMAL' },
            { name: 'txns_24h', type: 'BIGINT' },
            { name: 'pools_count', type: 'INTEGER' },
            { name: 'tokens_count', type: 'INTEGER' },
            { name: 'active_wallets', type: 'BIGINT' },
            { name: 'gas_price', type: 'VARCHAR(50)' },
            { name: 'contracts24h', type: 'INTEGER' },
            { name: 'contracts7d', type: 'INTEGER' },
            { name: 'logo_url', type: 'TEXT' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'protocolMetric',
        dbName: 'ProtocolMetric',
        columns: [
            { name: 'id', type: 'SERIAL' },
            { name: 'protocol_name', type: 'VARCHAR(100)', unique: true },
            { name: 'protocol_symbol', type: 'VARCHAR(20)' },
            { name: 'category', type: 'VARCHAR(50)' },
            { name: 'tvl', type: 'DECIMAL' },
            { name: 'tvl_change_1d', type: 'DECIMAL' },
            { name: 'tvl_change_7d', type: 'DECIMAL' },
            { name: 'volume_24h', type: 'DECIMAL' },
            { name: 'chains', type: 'TEXT[]' },
            { name: 'mcap_tvl_ratio', type: 'DECIMAL' },
            { name: 'logo_url', type: 'TEXT' },
            { name: 'updatedAt', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'createdAt', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'qualityFarcasterUser',
        dbName: 'quality_farcaster_users',
        columns: [
            { name: 'id', type: 'SERIAL' },
            { name: 'fid', type: 'INTEGER', unique: true },
            { name: 'username', type: 'VARCHAR(100)' },
            { name: 'display_name', type: 'VARCHAR(200)' },
            { name: 'followers', type: 'INTEGER', default: '0' },
            { name: 'following', type: 'INTEGER', default: '0' },
            { name: 'total_casts', type: 'INTEGER', default: '0' },
            { name: 'engagement_rate', type: 'DECIMAL', default: '0' },
            { name: 'source', type: 'VARCHAR(50)', default: "'dune'" },
            { name: 'is_active', type: 'BOOLEAN', default: 'TRUE' },
            { name: 'has_creator_coin', type: 'BOOLEAN', default: 'FALSE' },
            { name: 'creator_coin_address', type: 'VARCHAR(100)' },
            { name: 'last_coin_check', type: 'TIMESTAMP' },
            { name: 'last_verified_at', type: 'TIMESTAMP' },
            { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    },
    {
        prismaName: 'tokenRule',
        dbName: 'token_rules',
        columns: [
            { name: 'id', type: 'SERIAL' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'chain', type: 'TEXT' },
            { name: 'address', type: 'TEXT' },
            { name: 'rule_type', type: 'TEXT' },
            { name: 'condition_value', type: 'DECIMAL' },
            { name: 'action', type: 'TEXT' },
            { name: 'is_active', type: 'BOOLEAN', default: 'TRUE' },
            { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()' },
            { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()' }
        ]
    }
];

async function ensureTableAndColumns(model: ModelDefinition) {
    console.log(`\n--- Reconciling: ${model.dbName} (${model.prismaName}) ---`);

    // 1. Table existence check
    try {
        await prisma.$queryRawUnsafe(`SELECT 1 FROM "${model.dbName}" LIMIT 1`);
        console.log(`✅ Table "${model.dbName}": exists`);
    } catch (error: any) {
        console.log(`❌ Table "${model.dbName}": MISSING. Creating...`);

        // Construct CREATE TABLE SQL
        const colDefs = model.columns.map(c => {
            let def = `"${c.name}" ${c.type}`;
            if (c.name === 'id' && !model.pk) def += ' PRIMARY KEY';
            if (c.default) def += ` DEFAULT ${c.default}`;
            return def;
        }).join(', ');

        let createSql = `CREATE TABLE IF NOT EXISTS "${model.dbName}" (${colDefs}`;
        if (model.pk) {
            createSql += `, PRIMARY KEY (${model.pk.map(p => `"${p}"`).join(', ')})`;
        }
        createSql += `)`;

        try {
            await prisma.$executeRawUnsafe(createSql);
            console.log(`✅ Table "${model.dbName}": CREATED`);
        } catch (createError: any) {
            console.error(`Failed to create table "${model.dbName}":`, createError.message);
            return; // Skip column checks if table creation failed
        }
    }

    // 2. Column integrity check
    for (const col of model.columns) {
        try {
            // Using a specific SELECT to check for column existence
            await prisma.$queryRawUnsafe(`SELECT "${col.name}" FROM "${model.dbName}" LIMIT 1`);
            // console.log(`✅ ${model.dbName}.${col.name}: exists`);
        } catch (error: any) {
            console.log(`❌ Column "${model.dbName}.${col.name}": MISSING. Adding...`);
            let alterSql = `ALTER TABLE "${model.dbName}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`;
            if (col.default) alterSql += ` DEFAULT ${col.default}`;

            try {
                await withRetry(async () => {
                    await prisma.$executeRawUnsafe(alterSql);
                    if (col.unique) {
                        try {
                            await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "${model.dbName}_${col.name}_key" ON "${model.dbName}"("${col.name}")`);
                        } catch (idxErr) { }
                    }
                });
                console.log(`✅ Column "${model.dbName}.${col.name}": ADDED`);
            } catch (alterError: any) {
                console.error(`Failed to add column "${model.dbName}.${col.name}":`, alterError.message);
            }
        }
    }

    // 3. Composite unique indexes check
    if (model.uniques) {
        for (const uniqueGroup of model.uniques) {
            const indexName = `${model.dbName}_${uniqueGroup.join('_')}_key`;
            const cols = uniqueGroup.map(c => `"${c}"`).join(', ');
            console.log(`Checking composite unique index "${indexName}" on (${cols})...`);

            try {
                // CLEANUP: Remove duplicates before attempting to create unique index
                // This is critical for LeaderWalletStats where duplicates exist
                const cleanupSql = `
                    DELETE FROM "${model.dbName}" a USING "${model.dbName}" b
                    WHERE a.id < b.id
                    AND ${uniqueGroup.map(c => `a."${c}" = b."${c}"`).join(' AND ')}
                `;
                const cleanupResult = await prisma.$executeRawUnsafe(cleanupSql);
                if (cleanupResult > 0) {
                    console.log(`🧹 Cleaned up ${cleanupResult} duplicate rows from "${model.dbName}"`);
                }

                // Check if index exists by trying to create it if it doesn't
                const createIdxSql = `CREATE UNIQUE INDEX IF NOT EXISTS "${indexName}" ON "${model.dbName}" (${cols})`;
                await prisma.$executeRawUnsafe(createIdxSql);
                console.log(`✅ Composite index "${indexName}": ensured`);
            } catch (err: any) {
                console.error(`Failed to ensure composite index "${indexName}":`, err.message);
            }
        }
    }
}

async function main() {
    console.log('Starting Global DATABASE RECONCILIATION v2.0 (Super-Audit)...');
    console.log('Target: Prisma schema sync with production DB\n');

    try {
        // Run thorough reconciliation for primary models
        for (const model of SCHEMA_DEFINITIONS) {
            await ensureTableAndColumns(model);
        }

        // --- Ad-hoc checks for other important models (existence only for now) ---
        const secondaryModels = [
            'Cache', 'AITask', 'MessageChunk', 'NewsArticle', 'TrendingToken',
            'TrendingCast', 'PolymarketPosition', 'PolymarketApiCreds', 'UserReferral'
        ];

        console.log('\n--- Checking secondary model existence ---');
        for (const modelName of secondaryModels) {
            try {
                await (prisma as any)[modelName].findMany({ take: 1 });
                console.log(`✅ Table for ${modelName}: exists`);
            } catch (error) {
                console.log(`⚠️  Table for ${modelName}: potentially missing or check failed.`);
            }
        }

        console.log('\n--- RECONCILIATION COMPLETE ---');
        console.log('Please restart the server to ensure all Prisma models are properly indexed.');

    } catch (error) {
        console.error('Fatal error during reconciliation:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

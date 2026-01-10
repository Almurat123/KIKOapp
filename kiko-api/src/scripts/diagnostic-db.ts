import { prisma, withRetry } from '../db/prisma.js';

interface ModelDefinition {
    prismaName: string;
    dbName: string;
    columns: { name: string; type: string; default?: string; unique?: boolean }[];
    pk?: string[]; // Primary key columns if not 'id'
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
        ]
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
        pk: ['address', 'chainId']
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

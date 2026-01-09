import { prisma, withRetry } from '../db/prisma.js';

async function checkTable(tableName: string, columns: string[]) {
    console.log(`\n--- Checking table: "${tableName}" ---`);
    for (const column of columns) {
        try {
            await (prisma as any)[tableName].findMany({
                select: { [column]: true },
                take: 1
            });
            console.log(`✅ ${column}: exists`);
        } catch (error: any) {
            console.log(`❌ ${column}: MISSING`);
        }
    }
}

async function ensureTable(tableName: string, createSql: string) {
    try {
        await prisma.$queryRawUnsafe(`SELECT 1 FROM "${tableName}" LIMIT 1`);
        console.log(`✅ Table "${tableName}": exists`);
    } catch (error: any) {
        console.log(`❌ Table "${tableName}": MISSING. Creating...`);
        try {
            await prisma.$executeRawUnsafe(createSql);
            console.log(`✅ Table "${tableName}": CREATED`);
        } catch (createError: any) {
            console.error(`Failed to create table "${tableName}":`, createError.message);
        }
    }
}

async function fixColumn(tableName: string, dbTableName: string, columnName: string, columnDef: string, isUnique: boolean = false) {
    await withRetry(async () => {
        try {
            console.log(`Adding ${columnName} to ${dbTableName}...`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "${dbTableName}" ADD COLUMN IF NOT EXISTS "${columnName}" ${columnDef}`);
            if (isUnique) {
                await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "${dbTableName}_${columnName}_key" ON "${dbTableName}"("${columnName}")`);
            }
        } catch (error: any) {
            if (error.message.includes('already exists')) return;
            throw error;
        }
    });
}

async function main() {
    console.log('Starting Global Schema Diagnostic...');

    try {
        // --- User ---
        await checkTable('user', ['email', 'solanaWalletAddress', 'referralCode', 'referredBy']);

        // --- UserSettings ---
        await checkTable('userSettings', [
            'userRole', 'defaultSwapAmount', 'defaultSwapUnit',
            'checkTokenBeforeSwap', 'quickSwapMode', 'swapMethod',
            'slippageMode', 'customSlippage', 'mevProtection',
            'priceDeviationCheck', 'copyTradeAIMode', 'fastSwapMode',
            'createdAt', 'updatedAt'
        ]);

        // --- Position ---
        await checkTable('position', [
            'leaderTxHash', 'leaderBuyPrice', 'leaderBuyAmount', 'leaderBuyValueUsd',
            'ourSlippageBps', 'ourGasUsed', 'ourGasPriceGwei', 'executionDelayMs',
            'exitPrice', 'exitAmount', 'exitUsdValue',
            'realizedPnlUsd', 'realizedPnlPct', 'holdDurationHours', 'exitTxHash', 'exitReason'
        ]);

        // --- TrackedWallet ---
        await checkTable('trackedWallet', ['totalTradesTracked', 'lastTradeAt', 'nickName', 'createdAt', 'updatedAt']);

        // --- TrendingCast ---
        await checkTable('trendingCast', [
            'isBaseAppCoin', 'coinValue', 'authorBio', 'authorTwitter', 'authorCreatorCoin',
            'createdAt', 'updatedAt'
        ]);

        // --- UserActivity ---
        await checkTable('userActivity', ['logins', 'chatMessages', 'swapsCount', 'createdAt']);

        console.log('\nApplying fixes...');

        // --- Tables ---
        await ensureTable('DataRetentionPolicy', `
            CREATE TABLE IF NOT EXISTS "DataRetentionPolicy" (
                "id" TEXT PRIMARY KEY,
                "tableName" TEXT UNIQUE NOT NULL,
                "retentionDays" INTEGER NOT NULL,
                "isEnabled" BOOLEAN DEFAULT TRUE,
                "lastCleanedAt" TIMESTAMP,
                "lastCleanedCount" INTEGER,
                "description" TEXT,
                "createdAt" TIMESTAMP DEFAULT NOW(),
                "updatedAt" TIMESTAMP DEFAULT NOW()
            );
        `);

        await ensureTable('UserActivity', `
            CREATE TABLE IF NOT EXISTS "UserActivity" (
                "id" TEXT PRIMARY KEY,
                "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
                "date" DATE NOT NULL,
                "logins" INTEGER DEFAULT 0,
                "chatMessages" INTEGER DEFAULT 0,
                "swapsCount" INTEGER DEFAULT 0,
                "swapVolumeUsd" DOUBLE PRECISION DEFAULT 0,
                "copyTrades" INTEGER DEFAULT 0,
                "createdAt" TIMESTAMP DEFAULT NOW(),
                "updatedAt" TIMESTAMP DEFAULT NOW(),
                UNIQUE("userId", "date")
            );
        `);

        await ensureTable('UserReferral', `
            CREATE TABLE IF NOT EXISTS "UserReferral" (
                "id" TEXT PRIMARY KEY,
                "referrerId" TEXT NOT NULL,
                "refereeId" TEXT UNIQUE NOT NULL,
                "referralCode" TEXT NOT NULL,
                "rewardStatus" TEXT DEFAULT 'pending',
                "rewardAmount" DOUBLE PRECISION,
                "rewardedAt" TIMESTAMP,
                "refereeSwapCount" INTEGER DEFAULT 0,
                "refereeSwapVolumeUsd" DOUBLE PRECISION DEFAULT 0,
                "createdAt" TIMESTAMP DEFAULT NOW(),
                "updatedAt" TIMESTAMP DEFAULT NOW()
            );
        `);

        // Fix User
        await fixColumn('user', 'User', 'email', 'TEXT', true);
        await fixColumn('user', 'User', 'solanaWalletAddress', 'TEXT');
        await fixColumn('user', 'User', 'referralCode', 'TEXT', true);
        await fixColumn('user', 'User', 'referredBy', 'TEXT');

        // Fix UserSettings
        await fixColumn('userSettings', 'UserSettings', 'userRole', "TEXT DEFAULT 'default'");
        await fixColumn('userSettings', 'UserSettings', 'defaultSwapAmount', 'DOUBLE PRECISION DEFAULT 100');
        await fixColumn('userSettings', 'UserSettings', 'defaultSwapUnit', "TEXT DEFAULT 'native'");
        await fixColumn('userSettings', 'UserSettings', 'checkTokenBeforeSwap', 'BOOLEAN DEFAULT TRUE');
        await fixColumn('userSettings', 'UserSettings', 'quickSwapMode', 'BOOLEAN DEFAULT FALSE');
        await fixColumn('userSettings', 'UserSettings', 'swapMethod', "TEXT DEFAULT 'swap_card'");
        await fixColumn('userSettings', 'UserSettings', 'slippageMode', "TEXT DEFAULT 'auto'");
        await fixColumn('userSettings', 'UserSettings', 'customSlippage', 'DOUBLE PRECISION DEFAULT 0.5');
        await fixColumn('userSettings', 'UserSettings', 'mevProtection', 'BOOLEAN DEFAULT TRUE');
        await fixColumn('userSettings', 'UserSettings', 'priceDeviationCheck', 'BOOLEAN DEFAULT TRUE');
        await fixColumn('userSettings', 'UserSettings', 'copyTradeAIMode', "TEXT DEFAULT 'disabled'");
        await fixColumn('userSettings', 'UserSettings', 'fastSwapMode', 'BOOLEAN DEFAULT FALSE');
        await fixColumn('userSettings', 'UserSettings', 'createdAt', 'TIMESTAMP DEFAULT NOW()');
        await fixColumn('userSettings', 'UserSettings', 'updatedAt', 'TIMESTAMP DEFAULT NOW()');

        // Fix TrendingCast
        await fixColumn('trendingCast', 'trending_casts', 'is_base_app_coin', 'BOOLEAN DEFAULT FALSE');
        await fixColumn('trendingCast', 'trending_casts', 'base_app_coin_metadata', 'JSONB');
        await fixColumn('trendingCast', 'trending_casts', 'coin_value', 'NUMERIC');
        await fixColumn('trendingCast', 'trending_casts', 'author_bio', 'TEXT');
        await fixColumn('trendingCast', 'trending_casts', 'mentions', 'JSONB');
        await fixColumn('trendingCast', 'trending_casts', 'author_creator_coin', 'TEXT');
        await fixColumn('trendingCast', 'trending_casts', 'author_twitter', 'TEXT');
        await fixColumn('trendingCast', 'trending_casts', 'created_at', 'TIMESTAMP DEFAULT NOW()');
        await fixColumn('trendingCast', 'trending_casts', 'updated_at', 'TIMESTAMP DEFAULT NOW()');

        // Fix TrackedWallet
        await fixColumn('trackedWallet', 'TrackedWallet', 'totalTradesTracked', 'INTEGER DEFAULT 0');
        await fixColumn('trackedWallet', 'TrackedWallet', 'lastTradeAt', 'TIMESTAMP');
        await fixColumn('trackedWallet', 'TrackedWallet', 'nickName', 'TEXT');
        await fixColumn('trackedWallet', 'TrackedWallet', 'createdAt', 'TIMESTAMP DEFAULT NOW()');
        await fixColumn('trackedWallet', 'TrackedWallet', 'updatedAt', 'TIMESTAMP DEFAULT NOW()');

        // Fix Position
        await fixColumn('position', 'Position', 'leaderTxHash', 'TEXT');
        await fixColumn('position', 'Position', 'leaderBuyPrice', 'DOUBLE PRECISION');
        await fixColumn('position', 'Position', 'leaderBuyAmount', 'DOUBLE PRECISION');
        await fixColumn('position', 'Position', 'leaderBuyValueUsd', 'DOUBLE PRECISION');
        await fixColumn('position', 'Position', 'ourSlippageBps', 'INTEGER');
        await fixColumn('position', 'Position', 'ourGasUsed', 'TEXT');
        await fixColumn('position', 'Position', 'ourGasPriceGwei', 'DOUBLE PRECISION');
        await fixColumn('position', 'Position', 'executionDelayMs', 'INTEGER');
        await fixColumn('position', 'Position', 'exitPrice', 'DOUBLE PRECISION');
        await fixColumn('position', 'Position', 'exitAmount', 'TEXT');
        await fixColumn('position', 'Position', 'exitUsdValue', 'DOUBLE PRECISION');
        await fixColumn('position', 'Position', 'realizedPnlUsd', 'DOUBLE PRECISION');
        await fixColumn('position', 'Position', 'realizedPnlPct', 'DOUBLE PRECISION');
        await fixColumn('position', 'Position', 'holdDurationHours', 'DOUBLE PRECISION');
        await fixColumn('position', 'Position', 'exitTxHash', 'TEXT');
        await fixColumn('position', 'Position', 'exitReason', 'TEXT');

        console.log('\nFinal Verification Check...');
        await checkTable('userSettings', ['fastSwapMode', 'createdAt']);
        await checkTable('position', ['realizedPnlPct', 'exitReason']);
        await checkTable('userActivity', ['logins', 'createdAt']);

        console.log('\n--- Diagnostic and Fix Complete ---');
        console.log('Please restart the server to apply changes.');

    } catch (error) {
        console.error('Error during diagnostic:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

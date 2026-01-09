import { prisma } from '../db/prisma.js';

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

async function fixColumn(tableName: string, dbTableName: string, columnName: string, columnDef: string, isUnique: boolean = false) {
    try {
        console.log(`Adding ${columnName} to ${dbTableName}...`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${dbTableName}" ADD COLUMN IF NOT EXISTS "${columnName}" ${columnDef}`);
        if (isUnique) {
            await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "${dbTableName}_${columnName}_key" ON "${dbTableName}"("${columnName}")`);
        }
    } catch (error: any) {
        console.error(`Failed to fix ${columnName}:`, error.message);
    }
}

async function main() {
    console.log('Starting Global Schema Diagnostic...');

    try {
        // --- User ---
        await checkTable('user', ['email', 'solanaWalletAddress', 'referralCode', 'referredBy']);

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

        console.log('\nApplying fixes...');

        // Fix User
        await fixColumn('user', 'User', 'email', 'TEXT', true);
        await fixColumn('user', 'User', 'solanaWalletAddress', 'TEXT');
        await fixColumn('user', 'User', 'referralCode', 'TEXT', true);
        await fixColumn('user', 'User', 'referredBy', 'TEXT');

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
        await checkTable('user', ['email', 'solanaWalletAddress', 'referralCode', 'referredBy']);
        await checkTable('position', [
            'ourGasUsed', 'realizedPnlUsd', 'exitTxHash'
        ]);
        await checkTable('trackedWallet', ['totalTradesTracked', 'createdAt']);
        await checkTable('trendingCast', ['isBaseAppCoin', 'createdAt']);

        console.log('\n--- Diagnostic and Fix Complete ---');
        console.log('Please restart the server to apply changes.');

    } catch (error) {
        console.error('Error during diagnostic:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

import prisma from '../db/prisma.js';

interface DefaultPolicy {
    tableName: string;
    retentionDays: number;
    description: string;
}

const DEFAULT_POLICIES: DefaultPolicy[] = [
    { tableName: 'ChatMessage', retentionDays: 30, description: 'AI chat history' },
    { tableName: 'MessageChunk', retentionDays: 3, description: 'Streaming chunks for messages' },
    { tableName: 'TrendingCast', retentionDays: 7, description: 'Farcaster trending casts' },
    { tableName: 'WalletTransaction', retentionDays: 90, description: 'Tracked wallet transaction history' },
    // Cache handled internally, JudgeDecision permanent
];

/**
 * Initialize default retention policies if they don't exist
 */
export async function initializePolicies() {
    try {
        console.log('[DataRetention] Checking retention policies...');

        for (const policy of DEFAULT_POLICIES) {
            const existing = await prisma.dataRetentionPolicy.findUnique({
                where: { tableName: policy.tableName }
            });

            if (!existing) {
                await prisma.dataRetentionPolicy.create({
                    data: {
                        tableName: policy.tableName,
                        retentionDays: policy.retentionDays,
                        description: policy.description,
                        isEnabled: true
                    }
                });
                console.log(`[DataRetention] Created default policy for ${policy.tableName}`);
            }
        }
    } catch (error) {
        console.error('[DataRetention] Failed to initialize policies:', error);
    }
}

/**
 * Run cleanup based on active policies
 */
export async function runCleanup() {
    try {
        console.log('[DataRetention] Starting cleanup job...');

        const policies = await prisma.dataRetentionPolicy.findMany({
            where: { isEnabled: true }
        });

        for (const policy of policies) {
            if (policy.retentionDays <= 0) continue;

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

            let deletedCount = 0;

            // Delete based on table name dynamic access is tricky with Prisma types, 
            // so we use specific handlers
            switch (policy.tableName) {
                case 'ChatMessage':
                    const chatResult = await prisma.chatMessage.deleteMany({
                        where: { createdAt: { lt: cutoffDate } }
                    });
                    deletedCount = chatResult.count;
                    break;
                case 'MessageChunk':
                    const chunkResult = await prisma.messageChunk.deleteMany({
                        where: { createdAt: { lt: cutoffDate } }
                    });
                    deletedCount = chunkResult.count;
                    break;
                case 'TrendingCast':
                    // TrendingCast uses 'updatedAt' for recency usually, or we can use timestamp
                    // Schema: timestamp DateTime
                    const castResult = await prisma.trendingCast.deleteMany({
                        where: { timestamp: { lt: cutoffDate } }
                    });
                    deletedCount = castResult.count;
                    break;
                case 'WalletTransaction':
                    const txResult = await prisma.walletTransaction.deleteMany({
                        where: { blockTimestamp: { lt: cutoffDate } }
                    });
                    deletedCount = txResult.count;
                    break;
                default:
                    console.warn(`[DataRetention] No cleanup handler for table: ${policy.tableName}`);
                    continue;
            }

            if (deletedCount > 0) {
                console.log(`[DataRetention] Cleaned ${deletedCount} records from ${policy.tableName}`);

                // Update policy stats
                await prisma.dataRetentionPolicy.update({
                    where: { id: policy.id },
                    data: {
                        lastCleanedAt: new Date(),
                        lastCleanedCount: deletedCount
                    }
                });
            }
        }

        console.log('[DataRetention] Cleanup job completed.');

    } catch (error) {
        console.error('[DataRetention] Cleanup job failed:', error);
    }
}

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

const DEFAULT_POLICY_BY_TABLE = new Map(DEFAULT_POLICIES.map((p) => [p.tableName, p]));
const RETENTION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let retentionInterval: NodeJS.Timeout | null = null;

/**
 * Initialize default retention policies if they don't exist
 */
export async function initializePolicies() {
    try {
        console.log('[DataRetention] Checking retention policies...');

        for (const policy of DEFAULT_POLICIES) {
            await prisma.dataRetentionPolicy.upsert({
                where: { tableName: policy.tableName },
                update: {
                    retentionDays: policy.retentionDays,
                    description: policy.description,
                    isEnabled: true
                },
                create: {
                    tableName: policy.tableName,
                    retentionDays: policy.retentionDays,
                    description: policy.description,
                    isEnabled: true
                }
            });
        }

        // Remove obsolete policies that no longer have cleanup handlers.
        const existingPolicies = await prisma.dataRetentionPolicy.findMany();
        const obsolete = existingPolicies.filter((p) => !DEFAULT_POLICY_BY_TABLE.has(p.tableName));
        if (obsolete.length > 0) {
            await prisma.dataRetentionPolicy.deleteMany({
                where: { id: { in: obsolete.map((p) => p.id) } }
            });
            console.log(`[DataRetention] Removed obsolete policies: ${obsolete.map((p) => p.tableName).join(', ')}`);
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
                    console.warn(`[DataRetention] No cleanup handler for table: ${policy.tableName}, disabling policy`);
                    await prisma.dataRetentionPolicy.update({
                        where: { id: policy.id },
                        data: { isEnabled: false }
                    });
                    continue;
            }

            if (deletedCount > 0) {
                console.log(`[DataRetention] Cleaned ${deletedCount} records from ${policy.tableName}`);
            }

            // Always update cleanup stats so we can verify scheduler activity.
            await prisma.dataRetentionPolicy.update({
                where: { id: policy.id },
                data: {
                    lastCleanedAt: new Date(),
                    lastCleanedCount: deletedCount
                }
            });
        }

        console.log('[DataRetention] Cleanup job completed.');

    } catch (error) {
        console.error('[DataRetention] Cleanup job failed:', error);
    }
}

export function startDataRetentionScheduler(): void {
    if (retentionInterval) return;
    retentionInterval = setInterval(() => {
        runCleanup().catch((err) => {
            console.error('[DataRetention] Scheduled cleanup failed:', err);
        });
    }, RETENTION_INTERVAL_MS);
    console.log('[DataRetention] Scheduler started (every 60 minutes)');
}

export function stopDataRetentionScheduler(): void {
    if (!retentionInterval) return;
    clearInterval(retentionInterval);
    retentionInterval = null;
    console.log('[DataRetention] Scheduler stopped');
}

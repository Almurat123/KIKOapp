import prisma from '../db/prisma.js';

interface DefaultPolicy {
    tableName: string;
    retentionDays: number;
    description: string;
}

const DEFAULT_POLICIES: DefaultPolicy[] = [
    { tableName: 'ChatMessage', retentionDays: 30, description: 'AI chat history' },
    { tableName: 'ChatSession', retentionDays: 90, description: 'AI chat session metadata' },
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
                case 'ChatSession':
                    // Delete sessions older than retentionDays that have no remaining messages
                    // (messages are cleaned up by the ChatMessage policy first)
                    const sessionResult = await prisma.chatSession.deleteMany({
                        where: {
                            createdAt: { lt: cutoffDate },
                            messages: { none: {} }
                        }
                    });
                    deletedCount = sessionResult.count;
                    break;
                case 'MessageChunk':
                    const chunkResult = await prisma.messageChunk.deleteMany({
                        where: { createdAt: { lt: cutoffDate } }
                    });
                    deletedCount = chunkResult.count;
                    break;
                case 'TrendingCast':
                    // Use updatedAt to avoid accidental mass-deletion when upstream timestamps are malformed.
                    const castResult = await prisma.trendingCast.deleteMany({
                        where: { updatedAt: { lt: cutoffDate } }
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

        // ── Monthly: sanitize implausible Position.realizedPnlUsd ──────────
        // Guards against corrupted PnL values caused by historical bugs (e.g. raw
        // wei amounts used as human-readable, wrong exit price, etc.).
        // Runs at most once every 30 days per the Redis/DB gate below.
        await sanitizeDirtyPositionPnl().catch((err) =>
            console.error('[DataRetention] Position PnL sanitize failed:', err)
        );

    } catch (error) {
        console.error('[DataRetention] Cleanup job failed:', error);
    }
}

// ── Dirty Position PnL monthly cleanup ──────────────────────────────────────
const DIRTY_PNL_CLEANUP_INTERVAL_DAYS = 30;
let lastDirtyPnlCleanup: Date | null = null;

async function sanitizeDirtyPositionPnl(): Promise<void> {
    // In-memory gate: skip if we ran within the last 30 days in this process.
    if (lastDirtyPnlCleanup) {
        const daysSince = (Date.now() - lastDirtyPnlCleanup.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < DIRTY_PNL_CLEANUP_INTERVAL_DAYS) return;
    }

    // DB gate: check the DataRetentionPolicy row for last run timestamp.
    const policyRow = await prisma.dataRetentionPolicy.findUnique({
        where: { tableName: 'Position_PnlSanitize' }
    }).catch(() => null);

    if (policyRow?.lastCleanedAt) {
        const daysSince = (Date.now() - new Date(policyRow.lastCleanedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < DIRTY_PNL_CLEANUP_INTERVAL_DAYS) {
            lastDirtyPnlCleanup = new Date(policyRow.lastCleanedAt);
            return;
        }
    }

    console.log('[DataRetention] Running monthly Position PnL sanitize...');

    const closedPositions = await prisma.position.findMany({
        where: { status: 'closed' },
        select: {
            id: true,
            entryUsdValue: true,
            exitUsdValue: true,
            entryPrice: true,
            exitPrice: true,
            realizedPnlUsd: true,
        },
    });

    let fixedCount = 0;

    for (const pos of closedPositions) {
        const pnl = pos.realizedPnlUsd ?? 0;
        const entry = pos.entryUsdValue ?? 0;
        const maxPlausible = Math.max(entry * 10, 100_000);

        if (Math.abs(pnl) <= maxPlausible) continue;

        // Attempt recalculation from exit/entry USD values
        let newPnl = 0;
        if (pos.exitUsdValue && pos.exitUsdValue > 0 && entry > 0) {
            const recalc = pos.exitUsdValue - entry;
            if (Math.abs(recalc) <= maxPlausible) newPnl = recalc;
        }

        let newPct = 0;
        if (pos.exitPrice && pos.exitPrice > 0 && pos.entryPrice && pos.entryPrice > 0) {
            newPct = ((pos.exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
            if (!Number.isFinite(newPct) || Math.abs(newPct) > 100_000) newPct = 0;
        }

        await prisma.position.update({
            where: { id: pos.id },
            data: { realizedPnlUsd: newPnl, realizedPnlPct: newPct },
        });
        fixedCount++;
    }

    // Upsert the tracking policy row to record last run time.
    await prisma.dataRetentionPolicy.upsert({
        where: { tableName: 'Position_PnlSanitize' },
        update: { lastCleanedAt: new Date(), lastCleanedCount: fixedCount },
        create: {
            tableName: 'Position_PnlSanitize',
            retentionDays: 0,
            description: 'Monthly sanitization of implausible Position.realizedPnlUsd',
            isEnabled: true,
            lastCleanedAt: new Date(),
            lastCleanedCount: fixedCount,
        },
    });

    lastDirtyPnlCleanup = new Date();

    if (fixedCount > 0) {
        console.log(`[DataRetention] Position PnL sanitize: fixed ${fixedCount} dirty rows`);
    } else {
        console.log('[DataRetention] Position PnL sanitize: no dirty rows found');
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

import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { BuyGuardPolicy } from './types.js';

type BatchFilterSkippedUser = {
    config: {
        id?: string;
        userId?: string;
    };
    reason?: string;
    policy?: BuyGuardPolicy;
    effectiveConfig?: {
        minTargetValueUsd?: number | null;
        minLiquidityUsd?: number | null;
        minMarketCapUsd?: number | null;
        maxSlippageBps?: number | null;
    };
};

function summarizeReasons(skippedUsers: BatchFilterSkippedUser[]): Array<{ reason: string; count: number }> {
    const reasonCounts = new Map<string, number>();
    for (const skipped of skippedUsers) {
        const reason = String(skipped.reason || 'unknown');
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
    return [...reasonCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => ({ reason, count }));
}

export function buildBatchFilterAudit(skippedUsers: BatchFilterSkippedUser[]) {
    return {
        topReasons: summarizeReasons(skippedUsers).slice(0, 5),
        skippedUsers: skippedUsers.slice(0, 10).map((skipped) => ({
            configId: skipped.config?.id || 'unknown',
            userId: skipped.config?.userId || 'unknown',
            reason: skipped.reason || 'unknown',
            guardPolicy: skipped.policy?.name || 'unknown',
            minTargetValueUsd: Number(skipped.effectiveConfig?.minTargetValueUsd || 0),
            minLiquidityUsd: Number(skipped.effectiveConfig?.minLiquidityUsd || 0),
            minMarketCapUsd: Number(skipped.effectiveConfig?.minMarketCapUsd || 0),
            maxSlippageBps: Number(skipped.effectiveConfig?.maxSlippageBps || 0)
        }))
    };
}

export function emitBatchFilterAudit(params: {
    targetWallet: string;
    token: string;
    chainId: number;
    total: number;
    eligible: number;
    skippedUsers: BatchFilterSkippedUser[];
}) {
    const audit = buildBatchFilterAudit(params.skippedUsers);
    logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTradeGuardAudit] batch filter summary', {
        targetWallet: params.targetWallet,
        token: params.token,
        chainId: params.chainId,
        total: params.total,
        eligible: params.eligible,
        skipped: params.skippedUsers.length,
        topReasons: audit.topReasons,
        skippedUsers: audit.skippedUsers
    });
}

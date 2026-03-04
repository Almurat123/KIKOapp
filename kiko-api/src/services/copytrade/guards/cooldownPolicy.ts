export type PositionStatusCompatLike = {
    lockStatuses: string[];
};

export type DuplicateTradeWhere = Record<string, unknown>;
export type CooldownThrottleWhere = Record<string, unknown>;

export function buildDuplicateTradeWhere(params: {
    userId: string;
    tokenAddress: string;
    chainId?: number;
    configId?: string;
    cooldownMinutes: number;
    positionStatusCompat: PositionStatusCompatLike;
}): DuplicateTradeWhere {
    const pendingStatuses = Array.from(new Set(
        [
            ...(params.positionStatusCompat.lockStatuses || []).filter(Boolean),
            'pending_broadcast',
            'broadcasted_unseen',
        ]
    ));

    return {
        userId: params.userId,
        ...(params.configId ? { configId: params.configId } : {}),
        tokenAddress: params.tokenAddress,
        ...(Number.isFinite(Number(params.chainId)) ? { chainId: params.chainId } : {}),
        status: { in: pendingStatuses }
    };
}

export function buildCooldownThrottleWhere(params: {
    userId: string;
    tokenAddress: string;
    chainId: number;
    configId: string;
    cooldownMinutes: number;
}): CooldownThrottleWhere | null {
    const cooldownMinutes = Math.max(0, Number(params.cooldownMinutes || 0));
    if (cooldownMinutes <= 0) {
        return null;
    }

    const createdAfter = new Date(Date.now() - cooldownMinutes * 60 * 1000);
    return {
        userId: params.userId,
        configId: params.configId,
        tokenAddress: params.tokenAddress,
        chainId: params.chainId,
        status: { in: ['open', 'closing', 'close_pending', 'closed'] },
        createdAt: { gte: createdAfter }
    };
}

export function describeCooldownMode(cooldownMinutes: number): 'disabled' | 'recent_strategy_activity' {
    return Math.max(0, Number(cooldownMinutes || 0)) > 0
        ? 'recent_strategy_activity'
        : 'disabled';
}

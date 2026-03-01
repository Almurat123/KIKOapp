export type PositionStatusCompatLike = {
    lockStatuses: string[];
};

export type DuplicateTradeWhere = Record<string, unknown>;

export function buildDuplicateTradeWhere(params: {
    userId: string;
    tokenAddress: string;
    cooldownMinutes: number;
    positionStatusCompat: PositionStatusCompatLike;
}): DuplicateTradeWhere {
    const cooldownMinutes = Math.max(0, Number(params.cooldownMinutes || 0));
    const pendingStatuses = Array.from(new Set(
        (params.positionStatusCompat.lockStatuses || []).filter(Boolean)
    ));

    if (cooldownMinutes <= 0) {
        return {
            userId: params.userId,
            tokenAddress: params.tokenAddress,
            status: { in: pendingStatuses }
        };
    }

    const createdAfter = new Date(Date.now() - cooldownMinutes * 60 * 1000);
    return {
        userId: params.userId,
        tokenAddress: params.tokenAddress,
        OR: [
            { status: { in: pendingStatuses } },
            { status: 'open', createdAt: { gte: createdAfter } }
        ]
    };
}

export function describeCooldownMode(cooldownMinutes: number): 'pending_only' | 'pending_and_recent_open' {
    return Math.max(0, Number(cooldownMinutes || 0)) > 0
        ? 'pending_and_recent_open'
        : 'pending_only';
}

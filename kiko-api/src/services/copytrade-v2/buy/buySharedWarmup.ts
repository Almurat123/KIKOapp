import prisma from '../../../db/prisma.js';
import { cacheHub } from '../../../cache/DataCacheHub.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';

type BuySharedWarmupResult = {
    users: any[];
    userMap: Map<string, any>;
    userSettingsMap: Map<string, any>;
    nativePriceUsd: number;
};

const inflight = new Map<string, Promise<BuySharedWarmupResult>>();

function buildKey(chainId: number, userIds: string[]): string {
    return `${chainId}:${[...new Set(userIds.filter(Boolean))].sort().join(',')}`;
}

export async function getCopytradeBuySharedWarmup(
    chainId: number,
    userIds: string[]
): Promise<BuySharedWarmupResult> {
    const key = buildKey(chainId, userIds);
    const existing = inflight.get(key);
    if (existing) return existing;

    const promise = (async () => {
        const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
        const [users, userSettingsMap, nativePriceUsd] = await Promise.all([
            prisma.user.findMany({
                where: { privyDid: { in: uniqueUserIds } }
            }),
            cacheHub.warmupUserSettings(
                uniqueUserIds,
                async (userId) => prisma.userSettings.findUnique({ where: { userId } })
            ),
            cacheHub.getNativePrice(chainId, async () => getNativeTokenPriceUsd(chainId))
        ]);
        return {
            users,
            userMap: new Map(users.map((u) => [u.privyDid, u])),
            userSettingsMap,
            nativePriceUsd
        };
    })().finally(() => {
        inflight.delete(key);
    });

    inflight.set(key, promise);
    return promise;
}

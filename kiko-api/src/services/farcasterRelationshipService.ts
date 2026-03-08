import cacheClient from '../cache/cacheClient.js';
import { checkIsFollowing } from './neynarService.js';

export type FollowStatus = 'following' | 'not_following' | 'unknown';

export interface KikoFollowState {
    fid: number;
    targetFid: number;
    followsKiko: boolean | null;
    status: FollowStatus;
    checkedAt: string | null;
}

const KIKO_FID = 1576616;
const FOLLOW_CACHE_TTL_SECONDS = Math.max(60, parseInt(process.env.FARCASTER_FOLLOW_CACHE_TTL_SEC || '600', 10) || 600);
const FOLLOW_LOCK_TTL_SECONDS = Math.max(5, parseInt(process.env.FARCASTER_FOLLOW_LOCK_TTL_SEC || '15', 10) || 15);

function cacheKey(fid: number): string {
    return `farcaster:follow:kiko:${fid}`;
}

function lockKey(fid: number): string {
    return `lock:${cacheKey(fid)}`;
}

function normalizeState(fid: number, followsKiko: boolean | null, checkedAt: string | null): KikoFollowState {
    return {
        fid,
        targetFid: KIKO_FID,
        followsKiko,
        status: followsKiko === true ? 'following' : followsKiko === false ? 'not_following' : 'unknown',
        checkedAt,
    };
}

export async function getCachedKikoFollowState(fid: number): Promise<KikoFollowState | null> {
    if (!Number.isFinite(fid) || fid <= 0) return null;
    return cacheClient.getJson<KikoFollowState>(cacheKey(fid));
}

export async function resolveKikoFollowState(
    fid: number,
    options?: { forceRefresh?: boolean }
): Promise<KikoFollowState> {
    if (!Number.isFinite(fid) || fid <= 0) {
        return normalizeState(fid, null, null);
    }

    if (!options?.forceRefresh) {
        const cached = await getCachedKikoFollowState(fid);
        if (cached) return cached;
    }

    const lockValue = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const hasLock = await cacheClient.acquireLock(lockKey(fid), FOLLOW_LOCK_TTL_SECONDS, lockValue).catch(() => false);

    if (!hasLock) {
        const cached = await getCachedKikoFollowState(fid);
        if (cached) return cached;
    }

    try {
        const followsKiko = await checkIsFollowing(fid, KIKO_FID).catch(() => null);
        const state = normalizeState(fid, typeof followsKiko === 'boolean' ? followsKiko : null, new Date().toISOString());
        await cacheClient.setJson(cacheKey(fid), state, FOLLOW_CACHE_TTL_SECONDS).catch(() => undefined);
        return state;
    } finally {
        if (hasLock) {
            await cacheClient.releaseLock(lockKey(fid), lockValue).catch(() => undefined);
        }
    }
}

export async function invalidateKikoFollowState(fid: number): Promise<void> {
    if (!Number.isFinite(fid) || fid <= 0) return;
    await cacheClient.del(cacheKey(fid)).catch(() => undefined);
}

export function buildAnonymousKikoFollowState(fid?: number | null): KikoFollowState {
    return normalizeState(Number(fid || 0), null, null);
}

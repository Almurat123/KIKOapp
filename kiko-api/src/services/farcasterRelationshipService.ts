import cacheClient from '../cache/cacheClient.js';
import { fetchJson } from '../config/unifiedApiService.js';

export type FollowStatus = 'following' | 'not_following' | 'unknown';

export interface KikoFollowState {
    fid: number;
    targetFid: number | null;
    followsKiko: boolean | null;
    status: FollowStatus;
    checkedAt: string | null;
}

interface OfficialKikoProfile {
    fid: number;
    username: string;
    profileUrl: string | null;
}

const KIKO_USERNAME = (process.env.KIKO_FARCASTER_USERNAME || 'kikoapp').replace(/^@/, '').trim().toLowerCase();
const KIKO_FID = Number.parseInt(process.env.KIKO_FARCASTER_FID || '1576616', 10);
const FOLLOW_CACHE_TTL_SECONDS = Math.max(60, parseInt(process.env.FARCASTER_FOLLOW_CACHE_TTL_SEC || '600', 10) || 600);
const FOLLOW_LOCK_TTL_SECONDS = Math.max(5, parseInt(process.env.FARCASTER_FOLLOW_LOCK_TTL_SEC || '15', 10) || 15);
const PROFILE_CACHE_TTL_SECONDS = Math.max(300, parseInt(process.env.FARCASTER_PROFILE_CACHE_TTL_SEC || '86400', 10) || 86400);
const HUB_REQUEST_TIMEOUT_MS = Math.max(3000, parseInt(process.env.FARCASTER_HUB_TIMEOUT_MS || '5000', 10) || 5000);
const HUB_BASES = [
    (process.env.SNAPCHAIN_HUB_URL || 'https://hub.pinata.cloud').replace(/\/+$/, ''),
    'https://hub.merv.fun',
];

function cacheKey(fid: number): string {
    return `farcaster:follow:kiko:${fid}`;
}

function lockKey(fid: number): string {
    return `lock:${cacheKey(fid)}`;
}

function officialProfileCacheKey(): string {
    return `farcaster:profile:${KIKO_USERNAME}`;
}

function officialProfileLockKey(): string {
    return `lock:${officialProfileCacheKey()}`;
}

function normalizeState(fid: number, targetFid: number | null, followsKiko: boolean | null, checkedAt: string | null): KikoFollowState {
    return {
        fid,
        targetFid,
        followsKiko,
        status: followsKiko === true ? 'following' : followsKiko === false ? 'not_following' : 'unknown',
        checkedAt,
    };
}

function normalizeOfficialProfile(profile: any | null): OfficialKikoProfile | null {
    const fid = Number(profile?.fid);
    if (!Number.isFinite(fid) || fid <= 0) return null;
    const username = String(profile?.username || KIKO_USERNAME).replace(/^@/, '').trim().toLowerCase();
    return {
        fid,
        username,
        profileUrl: username ? `https://farcaster.xyz/${username}` : null,
    };
}

async function checkIsFollowingViaHub(fid: number, targetFid: number): Promise<boolean | null> {
    if (!Number.isFinite(fid) || fid <= 0 || !Number.isFinite(targetFid) || targetFid <= 0) {
        return null;
    }

    const seen = new Set<string>();
    const hubs = HUB_BASES.filter((base) => {
        const normalized = String(base || '').trim().replace(/\/+$/, '');
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    });

    for (const hubBase of hubs) {
        try {
            const url = new URL(`${hubBase}/v1/linkById`);
            url.searchParams.set('fid', String(fid));
            url.searchParams.set('target_fid', String(targetFid));
            url.searchParams.set('link_type', 'follow');

            const payload = await fetchJson<any>({
                url: url.toString(),
                requestTimeout: HUB_REQUEST_TIMEOUT_MS,
                endpointName: 'snapchain-hub',
                suppressError: true,
            });

            const message = payload?.data;
            if (!message?.linkBody) {
                continue;
            }

            const messageFid = Number(message?.fid);
            const linkTargetFid = Number(message?.linkBody?.targetFid);
            const linkType = String(message?.linkBody?.type || '').toLowerCase();

            if (messageFid === fid && linkTargetFid === targetFid && linkType === 'follow') {
                return true;
            }

            continue;
        } catch {
            continue;
        }
    }

    return null;
}

export async function getCachedOfficialKikoProfile(): Promise<OfficialKikoProfile | null> {
    const cached = await cacheClient.getJson<OfficialKikoProfile>(officialProfileCacheKey());
    return normalizeOfficialProfile(cached);
}

export async function resolveOfficialKikoProfile(options?: { forceRefresh?: boolean }): Promise<OfficialKikoProfile | null> {
    if (!options?.forceRefresh) {
        const cached = await getCachedOfficialKikoProfile();
        if (cached) return cached;
    }

    const lockValue = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const hasLock = await cacheClient.acquireLock(officialProfileLockKey(), FOLLOW_LOCK_TTL_SECONDS, lockValue).catch(() => false);

    if (!hasLock) {
        if (!options?.forceRefresh) {
            const cached = await getCachedOfficialKikoProfile();
            if (cached) return cached;
        }
    }

    try {
        const officialProfile = normalizeOfficialProfile({ fid: KIKO_FID, username: KIKO_USERNAME });
        if (officialProfile) {
            await cacheClient.setJson(officialProfileCacheKey(), officialProfile, PROFILE_CACHE_TTL_SECONDS).catch(() => undefined);
            return officialProfile;
        }
        return null;
    } finally {
        if (hasLock) {
            await cacheClient.releaseLock(officialProfileLockKey(), lockValue).catch(() => undefined);
        }
    }
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
        return normalizeState(fid, null, null, null);
    }

    if (!options?.forceRefresh) {
        const cached = await getCachedKikoFollowState(fid);
        if (cached) return cached;
    }

    const lockValue = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const hasLock = await cacheClient.acquireLock(lockKey(fid), FOLLOW_LOCK_TTL_SECONDS, lockValue).catch(() => false);

    if (!hasLock) {
        if (!options?.forceRefresh) {
            const cached = await getCachedKikoFollowState(fid);
            if (cached) return cached;
        }
    }

    try {
        const targetProfile = await resolveOfficialKikoProfile({ forceRefresh: options?.forceRefresh }).catch(() => null);
        if (!targetProfile?.fid) {
            const state = normalizeState(fid, null, null, new Date().toISOString());
            await cacheClient.setJson(cacheKey(fid), state, FOLLOW_CACHE_TTL_SECONDS).catch(() => undefined);
            return state;
        }

        const followsKiko = await checkIsFollowingViaHub(fid, targetProfile.fid).catch(() => null);
        const state = normalizeState(fid, targetProfile.fid, typeof followsKiko === 'boolean' ? followsKiko : null, new Date().toISOString());
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
    return normalizeState(Number(fid || 0), null, null, null);
}

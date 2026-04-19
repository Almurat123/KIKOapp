// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Linh Tran
// Reason: Neynar now owns Farcaster mention/reply ingress, but all legacy
//         public-read helpers must stay disabled so paid quota is not consumed
//         by search or profile fallback traffic. Cast publishing now also
//         prefers a dedicated Neynar signer UUID when available. The public
//         NeynarAPIClient wrapper accepts camelCase params and converts them to
//         OpenAPI wire keys internally; runtime diagnosis must therefore check
//         signer approval before blaming request shape. Social-agent mention
//         replies now also need cast embed images preserved as normalized media
//         inputs for the chat runtime. Generated-image replies now pass outbound
//         URL embeds through Neynar signer publishing when available.
// Goal: keep ingress reads centralized while preventing unrelated routes from
//       touching Neynar at runtime, while also exposing normalized cast image
//       context for Farcaster social-agent turns and cast-reply image embeds.
// Owns: Neynar API key discovery, notifications fetch, cast lookup, normalized
//       cast media extraction, optional cast publishing via signer UUID, and
//       hard disable switches for legacy read helpers.
// Does Not Own: Hub RPC publication fallback, worker cadence, conversation
//               policy, or social search fallback selection.
// Design Language:
// - Keep ingress reads enabled only for notifications and cast lookup.
// - Return immediately from legacy read helpers instead of probing the API.
// - Keep provider-specific response shapes normalized before they leave this layer.
// - Never log the API key or raw credential-bearing headers.
// - NeynarAPIClient wrapper calls must use the wrapper's camelCase params; the
//   wrapper owns converting them to OpenAPI wire keys.
// - Normalize image-bearing embeds before they leave this owner so the chat
//   runtime does not need to understand raw Neynar embed variants.
// - Normalize outbound cast embed URLs before handing them to the Neynar SDK.
// Document Provenance:
// - Source: Neynar notifications API `fetchAllNotifications`
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: mentions/replies notification polling for the Farcaster agent
// - Verification: verified in code
// - Source: Neynar cast lookup API `lookupCastByHashOrUrl`
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: cast hydration for Farcaster thread context
// - Verification: verified in code
// - Source: NeynarAPIClient `publishCast` wrapper implementation and signer
//   lookup runtime response
// - Kind: local SDK source
// - Retrieved: 2026-04-15
// - Applied To: camelCase `publishCast` wrapper params and signer approval
//   diagnosis
// - Verification: verified in code and runtime
// - Source: Neynar cast lookup and notifications docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: preserving cast embed image URLs for social-agent model input
// - Verification: verified in docs
// - Source: NeynarAPIClient `publishCast` local SDK typing
// - Kind: local SDK source
// - Retrieved: 2026-04-19
// - Applied To: using `embeds: [{ url }]` for generated-image cast replies
// - Verification: verified in local SDK typings and targeted test
// - Source: operator requirement on 2026-04-19 for Farcaster generated-image replies
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: passing generated-image media URLs through signer publication
// - Verification: verified in targeted test
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-neynar-notifications-standdown.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-reply-publish-fallback.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
/**
 * Neynar Service
 * Provides access to Neynar's Farcaster API for full-network search
 * Used as a supplement to local database search
 */

import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';

const NEYNAR_API_BASE = 'https://api.neynar.com/v2';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as unifiedApiService from '../config/unifiedApiService.js';
import { env } from '../config/env.js';
import type { FarcasterCastContext, FarcasterMentionEvent, FarcasterSendResult } from './farcaster-agent/types.js';
import { normalizeSocialImageUrl } from './socialAgentInput.js';

const MAX_NEYNAR_NOTIFICATION_LIMIT = 25;
const LEGACY_NEYNAR_READS_ENABLED = false;

let cachedNeynarClient: NeynarAPIClient | null = null;
let cachedNeynarApiKey: string | null = null;

function getNeynarApiKey(): string {
    return String(env.apiKeys.neynar || process.env.NEYNAR_API_KEY || '').trim();
}

function getNeynarSignerUuid(): string {
    return String(env.farcasterAgent.neynarSignerUuid || process.env.NEYNAR_SIGNER_UUID || '').trim();
}

function getNeynarClient(): NeynarAPIClient | null {
    const apiKey = getNeynarApiKey();
    if (!apiKey) {
        return null;
    }

    if (!cachedNeynarClient || cachedNeynarApiKey !== apiKey) {
        cachedNeynarClient = new NeynarAPIClient(new Configuration({ apiKey }));
        cachedNeynarApiKey = apiKey;
    }

    return cachedNeynarClient;
}

function clampNotificationLimit(value: number): number {
    if (!Number.isFinite(value)) return 15;
    return Math.min(Math.max(Math.trunc(value), 1), MAX_NEYNAR_NOTIFICATION_LIMIT);
}

export function normalizeNeynarCastHash(value?: string | null): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    const withPrefix = (/^0x/i.test(normalized) ? normalized : `0x${normalized}`).toLowerCase();
    return /^0x[0-9a-fA-F]{40}$/.test(withPrefix) ? withPrefix.toLowerCase() : null;
}

function toIsoTimestamp(value?: string | number | null): string | null {
    if (value === null || value === undefined || value === '') return null;
    const raw = typeof value === 'number' ? value : Date.parse(String(value));
    const ms = Number.isFinite(raw) ? raw : NaN;
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString();
}

function isLikelyImageUrl(url: string): boolean {
    return /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url);
}

function normalizeCastEmbedUrls(value: unknown): string[] {
    const rawUrls = Array.isArray(value) ? value : [];
    const deduped = new Set<string>();
    for (const raw of rawUrls) {
        const url = String(raw || '').trim();
        if (!url) continue;
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
            deduped.add(parsed.toString());
        } catch {
            continue;
        }
    }
    return Array.from(deduped).slice(0, 2);
}

function extractEmbedImages(embeds: unknown, sourceLabel: string): NonNullable<FarcasterCastContext['images']> {
    const results: NonNullable<FarcasterCastContext['images']> = [];
    const items = Array.isArray(embeds) ? embeds : [];

    for (const item of items) {
        const embed = item as any;
        const directUrl = normalizeSocialImageUrl(embed?.url);
        const metadataType = String(embed?.metadata?.content_type || '').trim().toLowerCase();
        const nestedImages = extractEmbedImages(embed?.cast?.embeds, `quoted ${sourceLabel}`);

        if (directUrl && (metadataType.startsWith('image/') || isLikelyImageUrl(directUrl) || embed?.metadata?.image)) {
            results.push({
                url: directUrl,
                altText: null,
                mimeType: metadataType || null,
                sourceLabel,
            });
        }

        if (nestedImages.length > 0) {
            results.push(...nestedImages);
        }
    }

    return results;
}

interface NeynarCast {
    hash: string;
    parent_hash?: string | null;
    thread_hash?: string | null;
    parent_author?: {
        fid: number | null;
    } | null;
    author: {
        fid: number;
        username: string;
        display_name?: string;
        pfp_url?: string;
    };
    text: string;
    timestamp: string;
    reactions?: {
        likes_count?: number;
        recasts_count?: number;
    };
    replies?: {
        count?: number;
    };
}

interface NeynarNotification {
    type: 'follows' | 'recasts' | 'likes' | 'mention' | 'mentions' | 'reply' | 'replies' | 'quote' | 'quotes' | string;
    most_recent_timestamp: string;
    seen: boolean;
    cast?: NeynarCast;
}

export function buildNeynarCastReplyParams(params: {
    signerUuid: string;
    text: string;
    parentHash: string;
    parentAuthorFid: number;
    idem?: string;
    embeds?: string[] | null;
}) {
    const embeds = normalizeCastEmbedUrls(params.embeds);
    return {
        signerUuid: params.signerUuid,
        text: String(params.text || '').trim(),
        parent: params.parentHash,
        parentAuthorFid: Math.trunc(params.parentAuthorFid),
        idem: String(params.idem || '').trim() || undefined,
        ...(embeds.length > 0 ? { embeds: embeds.map((url) => ({ url })) } : {}),
    };
}

function castToContext(cast: NeynarCast): FarcasterCastContext | null {
    const hash = normalizeNeynarCastHash(cast.hash);
    const text = String(cast.text || '').trim();
    const authorFid = Number(cast.author?.fid || 0);
    if (!hash || !text || !Number.isFinite(authorFid) || authorFid <= 0) {
        return null;
    }

    return {
        hash,
        text,
        authorFid,
        authorUsername: String(cast.author?.username || '').trim() || null,
        parentHash: normalizeNeynarCastHash(cast.parent_hash),
        parentAuthorFid: Number(cast.parent_author?.fid || 0) || null,
        timestamp: toIsoTimestamp(cast.timestamp),
        images: extractEmbedImages((cast as any).embeds, `Farcaster cast ${hash}`),
    };
}

function notificationToMentionEvent(notification: NeynarNotification): FarcasterMentionEvent | null {
    const cast = notification.cast;
    if (!cast) return null;

    const context = castToContext(cast);
    if (!context) return null;

    const notificationType = notification.type === 'reply' || notification.type === 'replies' ? 'replies' : 'mentions';
    return {
        eventId: `farcaster:mention:${context.hash}`,
        notificationType,
        castHash: context.hash,
        text: context.text,
        authorFid: Number(context.authorFid || 0),
        authorUsername: context.authorUsername || null,
        parentHash: context.parentHash || null,
        parentAuthorFid: context.parentAuthorFid || null,
        rootCastHash: normalizeNeynarCastHash(cast.thread_hash) || context.hash,
        occurredAt: toIsoTimestamp(notification.most_recent_timestamp) || context.timestamp || null,
    };
}

function normalizeNeynarCastContext(cast: NeynarCast): FarcasterCastContext | null {
    return castToContext(cast);
}

interface NeynarSearchResponse {
    result: {
        casts: NeynarCast[];
        next?: {
            cursor: string;
        };
    };
}

interface NeynarUserResponse {
    users: {
        fid: number;
        username: string;
        display_name: string;
        pfp_url: string;
        profile: {
            bio: {
                text: string;
            }
        };
        verifications: string[];
    }[];
}

/**
 * Search Farcaster casts using Neynar API
 * Supports literal, semantic, and hybrid search modes
 * [Logic]: Wraps Neynar /v2/farcaster/cast/search API
 * [Ref]: Neynar API docs - sort_type: 'algorithmic' | 'desc_chron' | 'chron'
 * [Risk]: API returns 402 if API key is on free tier
 */
export async function searchCastsNeynar(
    query: string,
    limit: number = 15,
    mode: 'literal' | 'semantic' | 'hybrid' = 'literal',
    sortBy: 'algorithmic' | 'recent' = 'algorithmic'
): Promise<any[]> {
    if (!LEGACY_NEYNAR_READS_ENABLED) {
        logger.info(LogCode.SYS_INFO, 'Neynar legacy search disabled by policy, skipping search', { query, limit, sortBy });
        return [];
    }

    const apiKey = getNeynarApiKey();

    try {
        logger.debug(LogCode.SYS_INFO, 'Neynar: Searching casts', { query, mode, limit, sortBy });

        const url = new URL(`${NEYNAR_API_BASE}/farcaster/cast/search`);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', String(Math.min(limit, 100)));
        url.searchParams.set('mode', mode);
        // [Logic]: Map 'recent' to Neynar's 'desc_chron' (descending chronological)
        url.searchParams.set('sort_type', sortBy === 'recent' ? 'desc_chron' : 'algorithmic');

        const data = await unifiedApiService.fetchJson<NeynarSearchResponse>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        const casts = data.result?.casts || [];

        logger.debug(LogCode.SYS_INFO, 'Neynar search results', { query, count: casts.length });

        // Transform to our standard format
        return casts.map(cast => ({
            hash: cast.hash,
            fid: cast.author.fid,
            author: {
                fid: cast.author.fid,
                username: cast.author.username,
                displayName: cast.author.display_name,
                avatar: cast.author.pfp_url,
                verified: false
            },
            text: cast.text,
            timestamp: new Date(cast.timestamp).getTime(),
            stats: {
                likes: cast.reactions?.likes_count || 0,
                recasts: cast.reactions?.recasts_count || 0,
                replies: cast.replies?.count || 0
            },
            source: 'neynar' // Mark source for debugging
        }));

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: Search error', { error: error.message });
        return [];
    }
}

/**
 * Fetch trending casts from Neynar Feed
 * [Logic]: Neynar /feed/trending endpoint
 * [Ref]: Neynar API docs - limit must be between 1 and 10
 * [Risk]: Returns empty if API key not configured
 */
export async function getTrendingFeed(limit: number = 10): Promise<any[]> {
    if (!LEGACY_NEYNAR_READS_ENABLED) {
        logger.info(LogCode.SYS_INFO, 'Neynar legacy trending feed disabled by policy, skipping feed', { limit });
        return [];
    }

    const apiKey = getNeynarApiKey();

    try {
        logger.debug(LogCode.SYS_INFO, 'Neynar: Fetching trending feed', { limit });

        const url = new URL(`${NEYNAR_API_BASE}/farcaster/feed/trending`);
        // [Logic]: Neynar trending feed limit must be 1-10
        url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 10)));
        url.searchParams.set('time_window', '24h');
        url.searchParams.set('provider', 'neynar'); // or 'farcaster_network'

        const data = await unifiedApiService.fetchJson<{ casts: NeynarCast[] }>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        const casts = data.casts || [];

        logger.debug(LogCode.SYS_INFO, 'Neynar trending casts count', { count: casts.length });

        // Transform to our standard format
        return casts.map(cast => ({
            hash: cast.hash,
            fid: cast.author.fid,
            author: {
                fid: cast.author.fid,
                username: cast.author.username,
                displayName: cast.author.display_name,
                avatar: cast.author.pfp_url,
                verified: false, // Neynar doesn't give this directly in simple feed? check docs
                bio: (cast.author as any).profile?.bio?.text // Neynar structure might vary
            },
            text: cast.text,
            timestamp: new Date(cast.timestamp).getTime(),
            stats: {
                likes: cast.reactions?.likes_count || 0,
                recasts: cast.reactions?.recasts_count || 0,
                replies: cast.replies?.count || 0
            },
            embeds: (cast as any).embeds, // Pass through embeds
            mentions: (cast as any).mentioned_profiles?.map((p: any) => p.fid) || [],
            source: 'neynar',
            // Improved heatScore with time decay (consistent with snapchainService)
            heatScore: (() => {
                const weightedEng = (cast.reactions?.likes_count || 0) + ((cast.reactions?.recasts_count || 0) * 2) + ((cast.replies?.count || 0) * 1.5);
                const castTime = new Date(cast.timestamp).getTime();
                const hoursOld = (Date.now() - castTime) / (1000 * 60 * 60);
                const decay = Math.pow(0.97, Math.min(hoursOld, 168));
                return Math.log10(Math.max(1, weightedEng) + 1) * 100 * decay;
            })()
        }));

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: Feed error', { error: error.message });
        return [];
    }
}

/**
 * Check if Neynar API is configured and working
 */
export async function isNeynarConfigured(): Promise<boolean> {
    return Boolean(LEGACY_NEYNAR_READS_ENABLED && getNeynarApiKey());
}

export function hasNeynarNotificationsConfigured(): boolean {
    return Boolean(getNeynarApiKey());
}

export function hasNeynarCastPublishingConfigured(): boolean {
    return Boolean(getNeynarApiKey() && getNeynarSignerUuid());
}

/**
 * Fetch mention/reply notifications for a specific Farcaster FID using Neynar.
 */
export async function fetchNeynarMentionPage(params: {
    fid: number;
    cursor?: string | null;
    limit?: number;
}): Promise<{
    events: FarcasterMentionEvent[];
    nextCursor: string | null;
} | null> {
    const client = getNeynarClient();
    if (!client || !Number.isFinite(params.fid) || params.fid <= 0) {
        return null;
    }

    try {
        const response = await client.fetchAllNotifications({
            fid: params.fid,
            type: [
                'mentions',
                'replies',
            ],
            limit: clampNotificationLimit(params.limit ?? 15),
            cursor: params.cursor || undefined,
        });

        const events = (response.notifications || [])
            .map(notificationToMentionEvent)
            .filter((event): event is FarcasterMentionEvent => Boolean(event));

        return {
            events,
            nextCursor: response.next?.cursor || null,
        };
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: notifications fetch error', {
            error: error.message,
            fid: params.fid,
        });
        return null;
    }
}

/**
 * Fetch cast context by hash using Neynar.
 */
export async function fetchNeynarCastContextByHash(params: {
    hash: string;
    viewerFid?: number;
}): Promise<FarcasterCastContext | null> {
    const client = getNeynarClient();
    const hash = normalizeNeynarCastHash(params.hash);
    if (!client || !hash) {
        return null;
    }

    try {
        const response = await client.lookupCastByHashOrUrl({
            identifier: hash,
            type: 'hash',
            viewerFid: Number.isFinite(params.viewerFid || NaN) && (params.viewerFid || 0) > 0 ? params.viewerFid : undefined,
        });

        const context = normalizeNeynarCastContext(response.cast);
        return context;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: cast lookup error', {
            error: error.message,
            hash,
        });
        return null;
    }
}

export async function publishNeynarCastReply(params: {
    text: string;
    parentHash: string;
    parentAuthorFid: number;
    idem?: string;
    embeds?: string[] | null;
}): Promise<FarcasterSendResult | null> {
    const client = getNeynarClient();
    const signerUuid = getNeynarSignerUuid();
    const parentHash = normalizeNeynarCastHash(params.parentHash);
    if (!client || !signerUuid || !parentHash || !Number.isFinite(params.parentAuthorFid) || params.parentAuthorFid <= 0) {
        return null;
    }

    try {
        const response = await client.publishCast(buildNeynarCastReplyParams({
            signerUuid,
            text: String(params.text || '').trim(),
            parentHash,
            parentAuthorFid: Math.trunc(params.parentAuthorFid),
            idem: String(params.idem || '').trim() || undefined,
            embeds: params.embeds,
        }));
        const hash = normalizeNeynarCastHash(response.cast?.hash);
        if (!hash) {
            throw new Error('Neynar publishCast response missing cast hash');
        }

        return {
            hash,
            raw: response,
        };
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Neynar: cast publish error', {
            error: error.message,
            parentHash,
            signerConfigured: Boolean(signerUuid),
        });
        return null;
    }
}

/**
 * Fetch users by FIDs using Neynar API
 */
export async function getUsersNeynar(fids: number[]): Promise<any[]> {
    if (!LEGACY_NEYNAR_READS_ENABLED || fids.length === 0) {
        return [];
    }

    const apiKey = getNeynarApiKey();
    if (!apiKey) {
        return [];
    }

    try {
        const url = new URL(`${NEYNAR_API_BASE}/farcaster/user/bulk`);
        url.searchParams.set('fids', fids.join(','));

        const data = await unifiedApiService.fetchJson<NeynarUserResponse>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        return data.users.map(u => ({
            fid: u.fid,
            username: u.username,
            displayName: u.display_name,
            pfp: u.pfp_url,
            bio: u.profile?.bio?.text,
            verifications: u.verifications
        }));
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: Users fetch error', { error: error.message });
        return [];
    }
}

/**
 * Fetch user details by username using Neynar API
 */
export async function getUserByUsername(username: string): Promise<any | null> {
    if (!LEGACY_NEYNAR_READS_ENABLED) {
        return null;
    }

    const apiKey = getNeynarApiKey();
    if (!apiKey) {
        return null;
    }

    try {
        const url = new URL(`${NEYNAR_API_BASE}/farcaster/user/by_username`);
        url.searchParams.set('username', username);

        const data = await unifiedApiService.fetchJson<{ user: any }>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        const u = data.user;

        if (!u) {
            return null;
        }

        return {
            fid: u.fid,
            username: u.username,
            displayName: u.display_name,
            pfp: u.pfp_url,
            bio: u.profile?.bio?.text,
            followers: u.follower_count,
            following: u.following_count,
            verifications: u.verifications
        };
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: User by username error', { error: error.message, username });
        return null;
    }
}

/**
 * Check if a user follows another user on Farcaster
 */
export async function checkIsFollowing(fid: number, targetFid: number): Promise<boolean> {
    if (!LEGACY_NEYNAR_READS_ENABLED) {
        return false;
    }

    const apiKey = getNeynarApiKey();
    if (!apiKey) {
        return false;
    }

    try {
        const url = new URL(`${NEYNAR_API_BASE}/farcaster/user/bulk`);
        url.searchParams.set('fids', String(targetFid));
        url.searchParams.set('viewer_fid', String(fid));

        const data = await unifiedApiService.fetchJson<{ users: any[] }>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        const u = data.users?.[0];

        // viewer_context.following is true if viewer_fid follows the user in bulk request
        return !!u?.viewer_context?.following;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: Check following error', { error: error.message, fid, targetFid });
        return false;
    }
}

export default {
    searchCastsNeynar,
    getTrendingFeed,
    isNeynarConfigured,
    hasNeynarNotificationsConfigured,
    hasNeynarCastPublishingConfigured,
    fetchNeynarMentionPage,
    fetchNeynarCastContextByHash,
    publishNeynarCastReply,
    getUsersNeynar,
    getUserByUsername,
    checkIsFollowing
};

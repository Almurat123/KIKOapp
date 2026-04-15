// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Linh Tran
// Reason: The legacy Neynar gRPC helper must stay inert so it cannot spend
//         quota accidentally after the Farcaster ingress switch.
// Goal: keep this helper returning empty results unless explicitly reworked.
// Owns: no-op safety behavior for the legacy gRPC helper.
// Does Not Own: Farcaster mention ingress, social search, or runtime policy.
// Design Language:
// - Default to returning null/empty data instead of calling the remote gRPC.
// - Never require a Neynar API key for legacy helper safety.
// Document Provenance:
// - Source: repository audit of snapchainGrpcService call sites
// - Kind: repo doc
// - Retrieved: 2026-04-15
// - Applied To: disabling remote gRPC calls in the legacy helper
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-legacy-reads-disabled.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
/**
 * Snapchain gRPC Hub Service for Farcaster data
 * Uses @farcaster/hub-nodejs SDK with Neynar's gRPC endpoint
 * 
 * [Logic]: gRPC may have different/better rate limits than HTTP API
 * [Ref]: https://docs.neynar.com - Snapchain gRPC API
 * [Risk]: Requires API key authentication via metadata interceptor
 */

import {
    HubRpcClient,
    FidRequest,
    ReactionsByTargetRequest,
    UserDataRequest,
    UserDataType,
    ReactionType,
} from '@farcaster/hub-nodejs';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

/**
 * Get or create the gRPC Hub client
 * [Logic]: Singleton pattern with lazy initialization
 */
export function getHubClient(): HubRpcClient | null {
    logger.info(LogCode.SYS_INFO, 'Legacy Neynar gRPC helper disabled by policy');
    return null;
}

/**
 * Convert Farcaster timestamp to Unix timestamp
 */
export function farcasterToUnixTimestamp(farcasterTimestamp: number): number {
    // Farcaster epoch is 2021-01-01 00:00:00 UTC
    const FARCASTER_EPOCH = 1609459200000; // in milliseconds
    return FARCASTER_EPOCH + farcasterTimestamp * 1000;
}

/**
 * Fetch casts by FID using gRPC
 * [Logic]: Returns newest casts first
 */
export async function getCastsByFidGrpc(fid: number, pageSize: number = 10): Promise<any[]> {
    const client = getHubClient();
    if (!client) return [];

    try {
        const result = await client.getCastsByFid(
            FidRequest.create({
                fid,
                pageSize,
                reverse: true, // Newest first
            })
        );

        if (result.isErr()) {
            logger.warn(LogCode.API_FETCH_FAILED, 'gRPC getCastsByFid failed', { fid, error: result.error.message });
            return [];
        }

        return result.value.messages.map((msg) => ({
            hash: Buffer.from(msg.hash).toString('hex'),
            fid: msg.data?.fid,
            timestamp: msg.data?.timestamp,
            text: msg.data?.castAddBody?.text || '',
            embeds: msg.data?.castAddBody?.embeds || [],
            mentions: msg.data?.castAddBody?.mentions || [],
            parentCastId: msg.data?.castAddBody?.parentCastId,
            parentUrl: msg.data?.castAddBody?.parentUrl,
        }));
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'gRPC getCastsByFid error', { fid, error: error.message });
        return [];
    }
}

/**
 * Fetch user data by FID using gRPC
 */
export async function getUserDataByFidGrpc(fid: number): Promise<any | null> {
    const client = getHubClient();
    if (!client) return null;

    try {
        const userData: Record<string, string> = {};

        // Fetch each user data type
        const types = [
            { type: UserDataType.PFP, key: 'pfp' },
            { type: UserDataType.DISPLAY, key: 'displayName' },
            { type: UserDataType.BIO, key: 'bio' },
            { type: UserDataType.USERNAME, key: 'username' },
            { type: UserDataType.URL, key: 'url' },
        ];

        for (const { type, key } of types) {
            const result = await client.getUserData(
                UserDataRequest.create({ fid, userDataType: type })
            );
            if (result.isOk() && result.value.data?.userDataBody?.value) {
                userData[key] = result.value.data.userDataBody.value;
            }
        }

        if (Object.keys(userData).length === 0) {
            return null;
        }

        return {
            fid,
            ...userData,
        };
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'gRPC getUserData error', { fid, error: error.message });
        return null;
    }
}

/**
 * Fetch reactions for a cast using gRPC
 */
export async function getReactionsByCastGrpc(fid: number, hash: string): Promise<{ likes: number; recasts: number }> {
    const client = getHubClient();
    if (!client) return { likes: 0, recasts: 0 };

    try {
        const hashBytes = Buffer.from(hash, 'hex');

        // Get likes
        const likesResult = await client.getReactionsByTarget(
            ReactionsByTargetRequest.create({
                targetCastId: { fid, hash: hashBytes },
                reactionType: 1, // LIKE
            })
        );

        // Get recasts
        const recastsResult = await client.getReactionsByTarget(
            ReactionsByTargetRequest.create({
                targetCastId: { fid, hash: hashBytes },
                reactionType: 2, // RECAST
            })
        );

        return {
            likes: likesResult.isOk() ? likesResult.value.messages.length : 0,
            recasts: recastsResult.isOk() ? recastsResult.value.messages.length : 0,
        };
    } catch (error: any) {
        return { likes: 0, recasts: 0 };
    }
}

/**
 * Close the gRPC client connection
 */
export function closeHubClient(): void {
    logger.info(LogCode.SYS_INFO, 'Legacy Neynar gRPC helper already disabled');
}

export default {
    getHubClient,
    getCastsByFidGrpc,
    getUserDataByFidGrpc,
    getReactionsByCastGrpc,
    farcasterToUnixTimestamp,
    closeHubClient,
};

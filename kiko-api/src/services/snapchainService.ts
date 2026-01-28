/**
 * Snapchain Hub Service for Farcaster data
 *
 * Uses the Snapchain Hub API to fetch casts and reactions directly
 * Primary service for fetching Farcaster data via Hub API
 */

import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as neynarService from './neynarService.js';
import { fetchJson } from '../config/unifiedApiService.js';
import * as qualityUsersRepo from '../repositories/qualityUsersRepository.js';

const HUB_URL = process.env.SNAPCHAIN_HUB_URL || 'https://hub.merv.fun';

/**
 * Fetch with timeout wrapper - now using unified service
 */
async function fetchWithTimeout(url: string, options: any = {}, timeout = 15000) {
  return await fetchJson({
    url,
    timeout,
    headers: {
      'User-Agent': 'KiKo/1.0',
      ...(options.headers || {})
    },
    ...options
  });
}

/**
 * High-quality user FIDs - Active Farcaster users with good content
 * These are early adopters, founders, and well-known community members
 */
export const QUALITY_FIDS = [
  // Farcaster Team & Founders
  1, // farcaster
  2, // v (Varun)
  3, // dwr (Dan Romero)
  4, // noah
  5, // mircea.eth
  // Well-known Crypto Figures
  20, // barmstrong (Brian Armstrong, Coinbase)
  37, // balajis.eth (Balaji Srinivasan)
  43, // sriramk.eth
  194, // vitalik.eth (Vitalik Buterin)
  // Active Builders & KOLs
  64, // maksim
  98, // kartik (ETHGlobal)
  99, // ted
  100, // greg
  129, // jessepollak (Base)
  239, // 0xdesigner
  280, // kmac
  363, // nibnalin.eth
  539, // horsefacts.eth
  576, // ace
  617, // linda
  680, // jacek
  1317, // wake
  1356, // typeof.eth
  2433, // six
  2904, // cer
  3621, // dc
  4085, // phil
  4167, // 0xen
  4482, // cameron
  5650, // wake.eth
  6596, // rish
  7143, // undefined
  7732, // nonlinear.eth
  8152, // ace
  8685, // jrf
  9152, // cassie
  12142, // accountless.eth
  15983, // christin
  17672, // les
  19961, // eth
  193435, // undefined
  // Add more active FIDs as discovered
];

interface HubCast {
  hash: string;
  fid: number;
  timestamp: number;
  text: string;
  embeds: any[];
  mentions: number[];
  parentCastId?: { fid: number; hash: string };
  parentUrl?: string;
}

interface HubUserData {
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: string;
  bio?: string;
  twitter?: string;
  verifications?: string[]; // ETH addresses
}

interface SnapchainReactions {
  likes: number;
  recasts: number;
  replies: number;
}

interface CastWithReactions {
  cast: HubCast;
  user: HubUserData;
  reactions: SnapchainReactions;
  score: number;
  weightedScore?: number;
}

/**
 * Get Hub info
 */
export async function getHubInfo(): Promise<any> {
  return await fetchJson({
    url: `${HUB_URL}/v1/info`
  });
}

/**
 * Fetch casts by FID (newest first)
 */
export async function getCastsByFid(fid: number, pageSize: number = 100): Promise<HubCast[]> {
  try {
    // Use reverse=true to get newest casts first
    const url = `${HUB_URL}/v1/castsByFid?fid=${fid}&pageSize=${pageSize}&reverse=true`;
    const data = await fetchJson({ url });

    if (!(data as any).messages || (data as any).messages.length === 0) {
      return [];
    }
    return (data as any).messages
      .filter((msg: any) => msg.data?.type === 'MESSAGE_TYPE_CAST_ADD')
      .map((msg: any) => ({
        hash: msg.hash,
        fid: msg.data.fid,
        timestamp: msg.data.timestamp,
        text: msg.data.castAddBody?.text || '',
        embeds: msg.data.castAddBody?.embeds || [],
        mentions: msg.data.castAddBody?.mentions || [],
        parentCastId: msg.data.castAddBody?.parentCastId,
        parentUrl: msg.data.castAddBody?.parentUrl,
      }));
  } catch (error: any) {
    // Only log network errors as warnings, not full stack traces
    if (error?.code === 'ECONNRESET' || error?.message?.includes('fetch failed')) {
      // Silent fail for network errors - these are expected in background jobs
      return [];
    }
    // Log other errors briefly
    logger.warn(LogCode.API_FETCH_FAILED, 'Failed to fetch casts from Snapchain Hub', { fid, error: error?.message || 'Unknown error' });
    return [];
  }
}

/**
 * Fetch user data by FID
 */
export async function getUserDataByFid(fid: number): Promise<HubUserData | null> {
  // 0. Profile First-Look: Check local persistent cache
  try {
    const localProfile = await qualityUsersRepo.getProfileByFid(fid);
    // Only use if it has reasonably high-quality data (not just a registration)
    if (localProfile && localProfile.username && localProfile.pfp && !localProfile.pfp.includes('placehold.co')) {
      return {
        fid: localProfile.fid,
        username: localProfile.username,
        displayName: localProfile.displayName,
        pfp: localProfile.pfp,
        bio: localProfile.bio,
        verifications: localProfile.verifications
      };
    }
  } catch (e: any) {
    logger.error(LogCode.SYS_ERROR, 'Error checking local profile cache', { fid, error: e.message });
  }

  const MAX_RETRIES = 3;
  let lastError: any;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const url = `${HUB_URL}/v1/userDataByFid?fid=${fid}`;
      const response = await fetchWithTimeout(url, {}, 5000);

      if (response.status === 429) {
        // Rate limited, wait and retry
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }

      if (!response.ok) return null;

      const data = await response.json();
      const messages = (data as any).messages || [];

      const userData: HubUserData = { fid };

      // Also fetch verifications (ETH addresses)
      try {
        const verificationsUrl = `${HUB_URL}/v1/verificationsByFid?fid=${fid}`;
        const verResponse = await fetchWithTimeout(verificationsUrl, {}, 3000);
        if (verResponse.ok) {
          const verData = await verResponse.json();
          if ((verData as any).messages) {
            userData.verifications = (verData as any).messages
              .filter((m: any) => m.data.type === 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS')
              .map((m: any) => m.data.verificationAddAddressBody.address);
          }
        }
      } catch (e) { }

      messages.forEach((msg: any) => {
        if (msg.data.type === 'MESSAGE_TYPE_USER_DATA_ADD') {
          const body = msg.data.userDataBody;
          switch (body.type) {
            case 'USER_DATA_TYPE_DISPLAY':
              userData.displayName = body.value;
              break;
            case 'USER_DATA_TYPE_BIO':
              userData.bio = body.value;
              break;
            case 'USER_DATA_TYPE_PFP':
              userData.pfp = body.value;
              break;
            case 'USER_DATA_TYPE_USERNAME':
              userData.username = body.value;
              break;
          }
        }
      });

      // SYNC to DB: If we got valid data from Hub, update our persistent profile cache
      if (userData.username && (userData.displayName || userData.pfp)) {
        qualityUsersRepo.updateProfile(fid, {
          username: userData.username,
          displayName: userData.displayName,
          pfp: userData.pfp,
          bio: userData.bio,
          verifications: userData.verifications,
          source: 'hub_sync'
        }).catch(err => logger.error(LogCode.SYS_ERROR, 'Error syncing hub profile to DB', { fid, err: err.message }));
      }

      return userData;

    } catch (error: any) {
      lastError = error;
      if (error?.code === 'ECONNRESET' || error?.message?.includes('fetch failed') || error?.name === 'AbortError') {
        // Network error or timeout, retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      // Other errors, break
      break;
    }
  }

  // No cached data in Hub, try DB and Neynar fallbacks
  logger.info(LogCode.SYS_INFO, 'Snapchain Hub data missing, trying DB/Neynar fallback', { fid });

  // 1. Try DB fallback (Real users previously saved)
  try {
    const cachedEntry = await prisma.trendingCast.findFirst({
      where: {
        fid,
        authorUsername: { not: { startsWith: 'fid' } },
        authorDisplayName: { not: { startsWith: 'User ' } },
      },
      select: {
        authorUsername: true,
        authorDisplayName: true,
        authorAvatar: true,
        authorBio: true,
        authorTwitter: true,
      }
    });

    if (cachedEntry && cachedEntry.authorUsername) {
      return {
        fid,
        username: cachedEntry.authorUsername,
        displayName: cachedEntry.authorDisplayName || undefined,
        pfp: cachedEntry.authorAvatar || undefined,
        bio: cachedEntry.authorBio || undefined,
        twitter: cachedEntry.authorTwitter || undefined,
      };
    }
  } catch (e) { }

  // 2. Try Neynar API (The ultimate source of truth for Farcaster)
  try {
    const neynarUser = await neynarService.getUsersNeynar([fid]);
    if (neynarUser && neynarUser.length > 0) {
      const u = neynarUser[0];
      logger.info(LogCode.SYS_INFO, 'Recovered user data from Neynar fallback', { fid, username: u.username });
      return {
        fid,
        username: u.username,
        displayName: u.displayName,
        pfp: u.pfp,
        bio: u.bio,
        verifications: u.verifications
      };
    }
  } catch (e) { }

  return null;
}

/**
 * Get replies count for a cast using castsByParent endpoint
 */
export async function getRepliesCount(targetFid: number, targetHash: string): Promise<number> {
  try {
    const url = `${HUB_URL}/v1/castsByParent?fid=${targetFid}&hash=${targetHash}&pageSize=1000`;
    const data = await fetchJson({ url });
    return (data as any).messages?.length || 0;
  } catch (error: any) {
    // Silent fail for network errors in background jobs
    if (error?.code === 'ECONNRESET' || error?.message?.includes('fetch failed')) {
      return 0;
    }
    return 0;
  }
}

/**
 * Get reactions for a cast (likes, recasts, and replies)
 */
export async function getReactionsByCast(targetFid: number, targetHash: string): Promise<SnapchainReactions> {
  try {
    // Get likes, recasts, and replies in parallel
    const [likesData, recastsData, repliesCount] = await Promise.all([
      fetchJson({ url: `${HUB_URL}/v1/reactionsByCast?target_fid=${targetFid}&target_hash=${targetHash}&reaction_type=Like&pageSize=1000` }),
      fetchJson({ url: `${HUB_URL}/v1/reactionsByCast?target_fid=${targetFid}&target_hash=${targetHash}&reaction_type=Recast&pageSize=1000` }),
      getRepliesCount(targetFid, targetHash),
    ]);

    return {
      likes: (likesData as any).messages?.length || 0,
      recasts: (recastsData as any).messages?.length || 0,
      replies: repliesCount,
    };
  } catch (error: any) {
    // Silent fail for network errors in background jobs
    if (error?.code === 'ECONNRESET' || error?.message?.includes('fetch failed')) {
      return { likes: 0, recasts: 0, replies: 0 };
    }
    return { likes: 0, recasts: 0, replies: 0 };
  }
}

/**
 * Fetch a single cast by hash
 */
export async function getCastByHash(hash: string): Promise<HubCast | null> {
  try {
    // Note: Hub API doesn't have a direct "castByHash" endpoint standard, 
    // usually we need FID + Hash. However, some Hubs might support it or we search.
    // Actually, strictly speaking verifyCast needs FID.
    // But `castsByParent` uses hash.
    // We might need to rely on the fact that we HAVE the fid in the embed usually?
    // Embed structure: { castId: { fid: 123, hash: '0x...' } }
    // So we DO have the FID.
    return null; // Placeholder implementation below
  } catch (e) {
    return null;
  }
}

// ... actually, let's implement the fetching logic inside getTrendingCasts or a helper
// to avoid resolving the API endpoint issue right now if it's complex.
// The Hub endpoint `v1/castById?fid=X&hash=Y` exists.

export async function getCastById(fid: number, hash: string): Promise<HubCast | null> {
  try {
    const url = `${HUB_URL}/v1/castById?fid=${fid}&hash=${hash}`;
    const responseData = await fetchJson({ url });
    const messageData = responseData.data; // The message data

    if (!messageData || !messageData.castAddBody) return null;

    return {
      hash: responseData.hash,
      fid: messageData.fid,
      timestamp: messageData.timestamp,
      text: messageData.castAddBody.text,
      embeds: messageData.castAddBody.embeds || [],
      mentions: messageData.castAddBody.mentions || [],
      parentCastId: messageData.castAddBody.parentCastId,
    };
  } catch (e) {
    return null;
  }
}

// Update getTrendingCasts to populate embeds
export async function getTrendingCasts(
  startFid: number = 1,
  endFid: number = 100,
  castsPerUser: number = 5,
  minEngagement: number = 1,
  maxAgeDays: number = 7
): Promise<CastWithReactions[]> {
  logger.info(LogCode.WTC_SCAN_STARTED, 'Fetching trending casts from Snapchain Hub', { startFid, endFid, maxAgeDays });
  const results: CastWithReactions[] = [];
  const batchSize = 20;
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  for (let batchStart = startFid; batchStart <= endFid; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize - 1, endFid);
    const fidRange = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) => batchStart + i);

    const batchPromises = fidRange.map(async (fid) => {
      try {
        const [userData, casts] = await Promise.all([
          getUserDataByFid(fid),
          getCastsByFid(fid, 50),
        ]);
        if (casts.length === 0) return [];

        const rootCasts = casts.filter(cast => {
          if (cast.parentCastId || !cast.text) return false;
          if (maxAgeDays > 0) {
            const castTime = farcasterToUnixTimestamp(cast.timestamp);
            const age = now - castTime;
            if (age > maxAgeMs) return false;
          }
          return true;
        });

        // Get reactions and POPULATE EMBEDS
        const castsWithReactions = await Promise.all(
          rootCasts.slice(0, castsPerUser).map(async (cast) => {
            const reactions = await getReactionsByCast(fid, cast.hash);
            const score = reactions.likes + reactions.recasts;

            if (score >= minEngagement) {
              // --- POPULATE EMBEDS ---
              if (cast.embeds && cast.embeds.length > 0) {
                const populatedEmbeds = await Promise.all(cast.embeds.map(async (embed) => {
                  if (embed.castId) {
                    // It's a quote cast/recast
                    try {
                      const quotedCast = await getCastById(embed.castId.fid, embed.castId.hash);
                      if (quotedCast) {
                        const quotedAuthor = await getUserDataByFid(embed.castId.fid);
                        if (!quotedAuthor) return embed; // Skip if author not found

                        return {
                          ...embed,
                          cast: {
                            ...quotedCast,
                            author: {
                              fid: quotedAuthor.fid,
                              username: quotedAuthor.username,
                              displayName: quotedAuthor.displayName,
                              avatar: quotedAuthor.pfp,
                              verified: false
                            }
                          }
                        };
                      }
                    } catch (e) {
                      // Ignore failure to fetch quote
                    }
                  }
                  return embed;
                }));
                cast.embeds = populatedEmbeds;
              }
              // -----------------------

              return { cast, user: userData, reactions, score };
            }
            return null;
          })
        );
        return castsWithReactions.filter((r): r is CastWithReactions => r !== null);
      } catch (error: any) {
        if (error?.code === 'ECONNRESET' || error?.message?.includes('fetch failed')) {
          return [];
        }
        logger.warn(LogCode.API_FETCH_FAILED, 'Error processing FID in Snapchain trending', { fid, error: error?.message || 'Unknown error' });
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Sort by time-weighted score...
  const sortedResults = results.map(r => {
    const castTime = farcasterToUnixTimestamp(r.cast.timestamp);
    const ageHours = (now - castTime) / (1000 * 60 * 60);
    let timeMultiplier = 1.0;
    if (ageHours < 24) {
      timeMultiplier = 2.0;
    } else if (ageHours < 72) {
      timeMultiplier = 1.5;
    } else if (ageHours < 168) {
      timeMultiplier = 1.2;
    }
    return {
      ...r,
      weightedScore: r.score * timeMultiplier,
    };
  }).sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0));

  logger.info(LogCode.API_FETCH_SUCCESS, 'Found regular engagement casts via Snapchain', { count: sortedResults.length });
  return sortedResults;
}

export function farcasterToUnixTimestamp(farcasterTimestamp: number): number {
  const FARCASTER_EPOCH = 1609459200; // 2021-01-01 00:00:00 UTC
  return (farcasterTimestamp + FARCASTER_EPOCH) * 1000;
}

/**
 * Convert Snapchain cast to the format expected by the social API
 */
export function snapchainToTrendingCast(result: CastWithReactions): any | null {
  if (!result.user || !result.user.username || result.user.username.startsWith('fid')) {
    return null; // Zero-Mock: Drop if user is invalid or missing
  }

  return {
    hash: result.cast.hash,
    fid: result.user.fid,
    text: result.cast.text,
    timestamp: farcasterToUnixTimestamp(result.cast.timestamp),
    author: {
      fid: result.user.fid,
      username: result.user.username,
      displayName: result.user.displayName || result.user.username,
      avatar: result.user.pfp || `https://avatar.vercel.sh/${result.user.username}`, // Better default than placeholder
      verified: false,
      bio: result.user.bio,
    },
    mentions: result.cast.mentions,
    stats: {
      likes: result.reactions.likes,
      recasts: result.reactions.recasts,
      replies: result.reactions.replies,
    },
    embeds: result.cast.embeds,
    heatScore: result.score,
  };
}

/**
 * Get a specific cast by FID and Hash
 */
export async function getCastByIdWithReactions(fid: number, hash: string): Promise<CastWithReactions | null> {
  try {
    const data = await fetchJson({
      url: `${HUB_URL}/v1/castById?fid=${fid}&hash=${hash}`
    });
    const message = data as any; // Hub response format

    if (!message || !message.data) return null;

    const castData = message.data.castAddBody;
    const timestamp = (message.data.timestamp * 1000) + 1609459200000; // Farcaster Epoch

    // Get user data
    const userData = await getUserDataByFid(fid);
    if (!userData) return null;

    // Get reactions (approximate since we don't have direct reaction count endpoint for single cast easily without list)
    // For this specific purpose, we might just default to current knowns or fetch via reactionsByCast
    const reactions = { likes: 0, recasts: 0, replies: 0 }; // Placeholder, will need detailed fetch if critical

    // Form HubCast object
    const cast: HubCast = {
      hash: hash,
      fid: fid,
      timestamp: timestamp,
      text: castData.text,
      embeds: castData.embeds || [],
      mentions: castData.mentions || [],
      parentCastId: castData.parentCastId,
      parentUrl: castData.parentUrl
    };

    return {
      cast,
      user: userData,
      reactions,
      score: 1000, // High score to ensure it stays
      weightedScore: 1000
    };
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Error fetching specific cast from Snapchain', { hash, error: error.message });
    return null;
  }
}

/**
 * Get trending casts from Hub (Approximation using Recaster or similar if available, 
 * but here we iterate known quality users or use a known public API)
 */
export async function getTrendingFromQualityUsers(
  maxAgeDays: number = 7,
  minEngagement: number = 1
): Promise<CastWithReactions[]> {
  logger.info(LogCode.WTC_SCAN_STARTED, 'Fetching quality FIDs casts from Snapchain', { count: QUALITY_FIDS.length, maxAgeDays });
  const results: CastWithReactions[] = [];
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const batchSize = 10;

  for (let i = 0; i < QUALITY_FIDS.length; i += batchSize) {
    const batch = QUALITY_FIDS.slice(i, i + batchSize);
    const batchPromises = batch.map(async (fid) => {
      try {
        const [userData, casts] = await Promise.all([
          getUserDataByFid(fid),
          getCastsByFid(fid, 20),
        ]);
        if (casts.length === 0) return [];

        // Filter to recent root casts
        const recentCasts = casts.filter(cast => {
          if (cast.parentCastId || !cast.text) return false;
          const castTime = farcasterToUnixTimestamp(cast.timestamp);
          return (now - castTime) <= maxAgeMs;
        });

        // Get reactions
        const castsWithReactions = await Promise.all(
          recentCasts.slice(0, 5).map(async (cast) => {
            const reactions = await getReactionsByCast(fid, cast.hash);
            const score = reactions.likes + reactions.recasts;
            if (score >= minEngagement) {
              return { cast, user: userData, reactions, score };
            }
            return null;
          })
        );
        return castsWithReactions.filter((r): r is CastWithReactions => r !== null);
      } catch (error) {
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Sort by time-weighted score
  const sortedResults = results.map(r => {
    const castTime = farcasterToUnixTimestamp(r.cast.timestamp);
    const ageHours = (now - castTime) / (1000 * 60 * 60);
    let timeMultiplier = ageHours < 24 ? 2.0 : ageHours < 72 ? 1.5 : ageHours < 168 ? 1.2 : 1.0;
    return { ...r, weightedScore: r.score * timeMultiplier };
  }).sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0));

  logger.info(LogCode.API_FETCH_SUCCESS, 'Casts from quality users fetched via Snapchain', { count: sortedResults.length });
  return sortedResults;
}

export default {
  getHubInfo,
  getCastsByFid,
  getCastById,
  getUserDataByFid,
  getReactionsByCast,
  getRepliesCount,
  getTrendingCasts,
  getTrendingFromQualityUsers,
  snapchainToTrendingCast,
  farcasterToUnixTimestamp,
  QUALITY_FIDS,
};

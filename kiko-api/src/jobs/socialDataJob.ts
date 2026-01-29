/**
 * Social Data Refresh Job
 * Runs every 10 minutes to fetch and store trending Farcaster casts
 * 
 * Data Sources (in priority order):
 * 1. Real Hot Users (from analysis) - Primary source from real_hot_users.json
 * 2. Dune Analytics - Discover quality users (maintenance only, not every refresh)
 * 3. Pinata Hub (Primary) - Free Farcaster Hub, no API credits consumed
 * 
 * [Logic]: Uses Pinata Hub (hub.pinata.cloud) - completely FREE
 * [Ref]: https://pinata.cloud/blog/pinatas-free-farcaster-hub
 * [Risk]: May have slightly higher latency than paid services
 */

import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TrendingCast } from '../types/social.js';
import { saveTrendingCasts, getLastUpdateTime, getPostsForRefresh, updateCastStats, recalculateHeatScores } from '../repositories/socialRepository.js';
import { env } from '../config/env.js';
import snapchainService, { QUALITY_FIDS } from '../services/snapchainService.js';
import * as neynarService from '../services/neynarService.js';
import { baseAppService } from '../services/baseAppService.js';
import { zoraService } from '../services/zoraService.js';
import qualityUsersRepo from '../repositories/qualityUsersRepository.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to reliably find the real_hot_users.json file across different environments (ts-node, build, etc.)
function resolveRealHotUsersPath(): string {
  const candidates = [
    // 1. New internal data directory in kiko-api
    path.resolve(__dirname, '../../data/real_hot_users.json'),
    // 2. Standard relative path from src/jobs (kiko-api/src/jobs -> KiKo/test)
    path.resolve(__dirname, '../../../test/Farcaste/real_hot_users.json'),
    // 3. Relative to process.cwd() (usually kiko-api root) -> ../test
    path.resolve(process.cwd(), '../test/Farcaste/real_hot_users.json'),
    // 4. Local data directory in kiko-api root
    path.resolve(process.cwd(), 'data/real_hot_users.json'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[SocialJob] Found user list at: ${p}`);
      return p;
    }
  }

  console.warn('[SocialJob] Could not find real_hot_users.json in any candidate path');
  return '';
}

const REAL_HOT_USERS_PATH = resolveRealHotUsersPath();

/**
 * Get real hot users FIDs from analysis JSON file
 * Priority: real_hot_users.json > Database > Hardcoded
 */
async function getRealHotUserFids(): Promise<number[]> {
  try {
    // Try to read from real_hot_users.json first
    if (fs.existsSync(REAL_HOT_USERS_PATH)) {
      const fileContent = fs.readFileSync(REAL_HOT_USERS_PATH, 'utf-8');
      // TEMPORARY: Limit to 5 users for quick restore
      // const realHotUsers = JSON.parse(fileContent).slice(0, 5); 
      const realHotUsers = JSON.parse(fileContent);

      if (Array.isArray(realHotUsers) && realHotUsers.length > 0) {
        // Extract FIDs from the array
        const fids = realHotUsers
          .map((user: any) => user.fid)
          .filter((fid: any) => typeof fid === 'number' && fid > 0);

        if (fids.length > 0) {
          console.log(`[Job] ✅ Loaded ${fids.length} real hot users from ${REAL_HOT_USERS_PATH}`);
          return fids;
        }
      }
    } else {
      console.warn(`[Job] Real hot users file not found: ${REAL_HOT_USERS_PATH}`);
    }
  } catch (error) {
    console.warn('[Job] Error reading real hot users file:', error instanceof Error ? error.message : error);
  }

  // Fallback: return empty array, will use other sources
  return [];
}

/**
 * Get quality user FIDs (Real Hot Users -> Database -> Hardcoded)
 * Does NOT call Dune API - only reads from local storage
 */
async function getQualityUserFids(): Promise<number[]> {
  let qualityFids: number[] = [];

  // 1. Try real hot users from analysis first (NEW PRIORITY)
  try {
    const realHotFids = await getRealHotUserFids();
    if (realHotFids.length > 0) {
      qualityFids = realHotFids;
      console.log(`[Job] ✅ Using ${qualityFids.length} real hot users from analysis`);
      return qualityFids;
    }
  } catch (error) {
    console.warn('[Job] Error loading real hot users:', error);
  }

  // 2. Fallback to database
  try {
    const dbFids = await qualityUsersRepo.getQualityFids();
    if (dbFids.length > 0) {
      qualityFids = dbFids;
      console.log(`[Job] ✅ Got ${qualityFids.length} quality users from database`);
    }
  } catch (dbError) {
    console.warn('[Job] Database error:', dbError);
  }

  // 3. Fallback to hardcoded FIDs (and seed database)
  if (qualityFids.length === 0) {
    console.log('[Job] Database empty, using hardcoded QUALITY_FIDS, seeding database...');
    qualityFids = QUALITY_FIDS;

    // Seed database with hardcoded FIDs for future use
    try {
      await qualityUsersRepo.seedInitialQualityUsers(QUALITY_FIDS);
      console.log(`[Job] ✅ Seeded ${QUALITY_FIDS.length} hardcoded users to database`);
    } catch (seedError) {
      console.warn('[Job] Failed to seed quality users:', seedError);
    }
  }

  return qualityFids;
}

/**
 * Refresh trending casts - uses Snapchain Hub
 * Does NOT call Dune API - only reads quality users from local storage
 * Preserves existing data if refresh fails
 */
export async function runDiscoveryJob(force = false): Promise<void> {
  const REFRESH_10M_MS = 9.5 * 60 * 1000; // 9.5 minutes

  if (!force) {
    const lastUpdate = await getLastUpdateTime();
    if (lastUpdate && (Date.now() - lastUpdate.getTime()) < REFRESH_10M_MS) {
      console.log('[SocialJob] Trending casts are fresh, skipping Snapchain API call');
      return;
    }
  }

  let newCasts: TrendingCast[] = [];

  // Clear Zora in-memory cache at start of each refresh cycle
  zoraService.clearCache();

  try {
    // ===== STEP 1: Get quality users from local storage (no Dune API call) =====
    const qualityFids = await getQualityUserFids();

    if (qualityFids.length === 0) {
      // Check if we have existing data - if so, keep it
      const { getTrendingCasts: getExistingCasts } = await import('../repositories/socialRepository.js');
      const existingCasts = await getExistingCasts(50);
      if (existingCasts.length > 0) {
        return;
      }
      return;
    }

    // ===== STEP 2: Fetch casts from Snapchain Hub =====
    // Target: 500 casts total for better coverage
    const TARGET_CASTS = 500;
    const CASTS_PER_USER = 6;

    try {
      // Use the quality users list (from Dune or hardcoded fallback)
      const snapchainResults = await fetchCastsFromUsers(qualityFids, 30, 1, TARGET_CASTS, CASTS_PER_USER);

      if (snapchainResults.length > 0) {
        // Convert Snapchain format to TrendingCast format (take up to TARGET_CASTS)
        newCasts = snapchainResults.slice(0, TARGET_CASTS)
          .map(result => snapchainService.snapchainToTrendingCast(result))
          .filter((converted): converted is any => converted !== null)
          .map(converted => ({
            hash: converted.hash,
            fid: converted.fid,
            author: {
              fid: converted.author.fid,
              username: converted.author.username,
              displayName: converted.author.displayName,
              avatar: converted.author.avatar,
              verified: converted.author.verified,
              bio: converted.author.bio,
            },
            text: converted.text,
            timestamp: converted.timestamp,
            embeds: converted.embeds,
            parentCastId: undefined,
            stats: converted.stats,
            heatScore: converted.heatScore,
            mentions: converted.mentions,
          } as TrendingCast));
      }
    } catch (snapchainError) {
      console.error('[SocialJob] Snapchain fetch error:', snapchainError);
      // Continue to Neynar fallback
    }

    // ===== STEP 2.5: Neynar API Fallback (when Hub fails) =====
    if (newCasts.length === 0) {
      console.log('[SocialJob] Hub returned 0 casts, trying Neynar fallback...');
      try {
        const neynarService = (await import('../services/neynarService.js')).default;
        const neynarCasts = await neynarService.getTrendingFeed(100);

        if (neynarCasts.length > 0) {
          console.log(`[SocialJob] ✅ Neynar fallback success: ${neynarCasts.length} casts`);
          newCasts = neynarCasts.map((cast: any) => ({
            hash: cast.hash,
            fid: cast.fid,
            author: cast.author,
            text: cast.text,
            timestamp: cast.timestamp,
            embeds: cast.embeds || [],
            parentCastId: undefined,
            stats: cast.stats,
            heatScore: cast.heatScore || 0,
            mentions: cast.mentions || [],
          } as TrendingCast));
        }
      } catch (neynarError) {
        console.error('[SocialJob] Neynar fallback also failed:', neynarError);
      }
    }

    // ===== ERROR HANDLING: Only save if we got new data =====
    if (newCasts.length === 0) {
      // No new casts fetched - keep existing database data as-is
      console.log('[SocialJob] No new casts from Hub or Neynar, preserving existing database data');
      return;
    }

    // === OPTIMIZE: Load quality users ONCE ===
    const allQualityUsers = await qualityUsersRepo.getQualityUsers(2000);
    const userCoinMap = new Map<number, { hasCoin: boolean; coinAddress?: string; lastCheck: number }>();
    allQualityUsers.forEach((u: any) => {
      userCoinMap.set(u.fid, {
        hasCoin: u.hasCreatorCoin ?? false,
        coinAddress: u.creatorCoinAddress,
        lastCheck: u.lastCoinCheck ? new Date(u.lastCoinCheck).getTime() : 0
      });
    });

    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    console.log(`[SocialJob] Checking Zora coin status for ${newCasts.length} casts...`);
    // Process in parallel with rate limiting (batch of 10)
    const batchSize = 10;
    for (let i = 0; i < newCasts.length; i += batchSize) {
      const batch = newCasts.slice(i, i + batchSize);
      await Promise.all(batch.map(async (cast) => {
        try {
          try {


            // === OPTIMIZED Creator Coin Check ===
            if (cast.author?.fid) {
              const cached = userCoinMap.get(cast.author.fid);
              const isStale = !cached || (now - cached.lastCheck) > oneDayMs;

              if (cached && !isStale) {
                // Fast path: Use cached data, skip API entirely for "no coin" users
                if (cached.hasCoin && cached.coinAddress) {
                  try {
                    const creatorCoin = await zoraService.getCoinByAddress(cached.coinAddress);
                    if (creatorCoin) {
                      cast.author.creatorCoin = creatorCoin;
                    }
                  } catch (e) { }
                }
                // If hasCoin is false, we just skip - no API call!
              } else {
                // Stale or new user: Check API and update cache
                try {
                  const userData = await snapchainService.getUserDataByFid(cast.author.fid);
                  let creatorCoin = null;
                  if (userData?.verifications && userData.verifications.length > 0) {
                    for (const address of userData.verifications) {
                      if (!address.startsWith('0x')) continue;
                      creatorCoin = await zoraService.getUserCreatorCoin(address);
                      if (creatorCoin) break;
                    }
                  }

                  // Update DB cache
                  await qualityUsersRepo.updateUserCoinStatus(
                    cast.author.fid,
                    !!creatorCoin,
                    creatorCoin?.address
                  );

                  // Update local map for future casts in this batch
                  userCoinMap.set(cast.author.fid, {
                    hasCoin: !!creatorCoin,
                    coinAddress: creatorCoin?.address,
                    lastCheck: now
                  });

                  if (creatorCoin) {
                    cast.author.creatorCoin = creatorCoin;
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
            }

          } catch (innerError) {
            console.warn(`[SocialJob] Error checking coin for cast ${cast.hash}:`, innerError);
          }
        } catch (e) {
          // Ignore individual failures
        }
      }));
    }

    await saveTrendingCasts(newCasts);
    console.log(`[SocialJob] Casts refreshed: ${newCasts.length} saved`);
  } catch (error) {
    console.error('[SocialJob] Error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Fetch casts from a list of user FIDs via Snapchain Hub
 * OPTIMIZED: Respects Neynar rate limits (300 RPM for Starter)
 * [Logic]: batchSize=2 + 500ms delay = ~240 RPM max
 * [Ref]: Neynar Starter plan = 300 RPM
 * [Risk]: Too aggressive fetching will trigger 429
 * 
 * @param fids - List of user FIDs to fetch from
 * @param maxAgeDays - Maximum age of casts in days (default: 30 for 1 month coverage)
 * @param minEngagement - Minimum engagement score to include
 * @param targetCasts - Stop fetching when this many casts collected (default: 300)
 * @param castsPerUser - Maximum casts per user (default: 4)
 */
async function fetchCastsFromUsers(
  fids: number[],
  maxAgeDays: number = 30,
  minEngagement: number = 1,
  targetCasts: number = 300,
  castsPerUser: number = 4
): Promise<any[]> {
  console.log(`[SocialJob] fetchCastsFromUsers starting with ${fids.length} FIDs, target: ${targetCasts}`);
  const results: any[] = [];
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  // [Logic]: Optimized for Neynar Growth plan (600 RPM)
  // Each user triggers ~5 API calls: getCastsByFid + getUserDataByFid + getReactionsByCast x N
  // batchSize=3 * 5 calls = 15 calls/batch, 500ms delay = 30 batches/min = 450 RPM (safe for 600 RPM)
  const batchSize = 3;
  let usersProcessed = 0;

  // OPTIMIZATION 2: Shuffle FIDs for better distribution (avoid all low-activity users first)
  const shuffledFids = [...fids].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffledFids.length; i += batchSize) {
    if (results.length >= targetCasts) break;

    const batch = shuffledFids.slice(i, i + batchSize);

    // OPTIMIZATION 3: Fetch user data and casts in parallel via Pinata Hub (FREE)
    // [Logic]: Pinata Hub does not consume ANY API credits
    const batchPromises = batch.map(async (fid) => {
      try {
        const casts = await snapchainService.getCastsByFid(fid, 10);
        if (casts.length === 0) return [];

        const recentCasts = casts.filter((cast: any) => {
          if (cast.parentCastId || !cast.text || cast.text.length < 10) return false;
          const castTime = snapchainService.farcasterToUnixTimestamp(cast.timestamp);
          return (now - castTime) <= maxAgeMs;
        });

        if (recentCasts.length === 0) return [];

        const userData = await snapchainService.getUserDataByFid(fid);
        if (!userData) return [];

        const castsToProcess = recentCasts.slice(0, Math.min(castsPerUser, 2));

        const castsWithReactions = await Promise.all(
          castsToProcess.map(async (cast: any) => {
            const reactions = await snapchainService.getReactionsByCast(fid, cast.hash);
            const score = reactions.likes + reactions.recasts;
            if (score >= minEngagement) {
              if (cast.embeds && cast.embeds.length > 0) {
                // Populate embeds best-effort
                try {
                  const populatedEmbeds = await Promise.all(cast.embeds.map(async (embed: any) => {
                    if (embed.castId) {
                      try {
                        const qCast = await snapchainService.getCastById(embed.castId.fid, embed.castId.hash);
                        if (qCast) {
                          const qUser = await snapchainService.getUserDataByFid(embed.castId.fid);
                          if (!qUser) return embed; // Skip if author missing

                          return {
                            ...embed,
                            cast: {
                              ...qCast,
                              author: {
                                ...qUser,
                                avatar: qUser.pfp,
                                name: qUser.displayName || qUser.username,
                                handle: qUser.username ? `@${qUser.username}` : undefined
                              }
                            }
                          };
                        }
                      } catch (e) { }
                    }
                    return embed;
                  }));
                  cast.embeds = populatedEmbeds;
                } catch (e) { }
              }
              return { cast, user: { ...userData, twitter: userData.twitter }, reactions, score };
            }
            return null;
          })
        );
        return castsWithReactions.filter((r: any): r is any => r !== null);
      } catch (error) {
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());
    usersProcessed += batch.length;

    // [Logic]: 500ms delay for Growth 600 RPM (30 batches/min * 15 calls = 450 RPM)
    if (results.length < targetCasts * 0.8) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const sortedResults = results.map(r => {
    const castTime = snapchainService.farcasterToUnixTimestamp(r.cast.timestamp);
    const ageHours = (now - castTime) / (1000 * 60 * 60);
    let timeMultiplier = ageHours < 24 ? 2.0 : ageHours < 72 ? 1.5 : ageHours < 168 ? 1.2 : 1.0;
    return { ...r, weightedScore: r.score * timeMultiplier };
  }).sort((a, b) => b.weightedScore - a.weightedScore);

  return sortedResults.slice(0, targetCasts);
}

/**
 * Refresh engagement stats for existing high-value posts
 * Updates posts from last 7 days that haven't been updated recently
 */
export async function runEngagementRefreshJob(): Promise<void> {
  // console.log('[SocialJob] Starting Engagement Refresh Job...');
  try {
    // 1. Get posts that need refresh
    const posts = await getPostsForRefresh(200, 7); // Top 200 posts from last 7 days

    if (posts.length === 0) {
      // console.log('[SocialJob] No posts need refresh');
      return;
    }

    console.log(`[SocialJob] Refreshing stats for ${posts.length} posts...`);

    // 2. Fetch updated stats in parallel (batch of 10)
    const batchSize = 10;
    let updatedCount = 0;

    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      await Promise.all(batch.map(async (post) => {
        try {
          const reactions = await snapchainService.getReactionsByCast(post.fid, post.hash);
          // Only update if we got valid positive numbers (avoid wiping data with 0s on partial API failures)
          if (reactions && typeof reactions.likes === 'number') {
            await updateCastStats(post.hash, reactions);
            updatedCount++;
          }
        } catch (e) {
          // Ignore fetch errors
        }
      }));

      // Rate limit protection
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[SocialJob] ✅ Refreshed stats for ${updatedCount}/${posts.length} posts`);

  } catch (error) {
    console.error('[SocialJob] Engagement Refresh Error:', error);
  }
}

/**
 * Recalculate heat scores for all relevant posts
 * Uses time-decay formula to ensure trending is about "velocity" not just total likes
 */
export async function runScoreRecalculationJob(): Promise<void> {
  // console.log('[SocialJob] Starting Score Recalculation...');
  try {
    await recalculateHeatScores();
  } catch (error) {
    console.error('[SocialJob] Score Recalculation Error:', error);
  }
}

/**
 * Initialize and start cron jobs
 */
export function startSocialDataJobs(): void {
  // 1. Discovery Job: Every 30 minutes (Find NEW content)
  cron.schedule('*/30 * * * *', () => runDiscoveryJob(), {
    timezone: 'UTC',
  });

  // 2. Engagement Refresh: Every 4 hours (Update OLD content)
  // Runs at 0, 4, 8, 12, 16, 20 hours UTC
  cron.schedule('0 */4 * * *', () => runEngagementRefreshJob(), {
    timezone: 'UTC',
  });

  // 3. Score Recalc: Every 5 minutes (Keep ranking fresh)
  cron.schedule('*/5 * * * *', () => runScoreRecalculationJob(), {
    timezone: 'UTC',
  });

  console.log('[SocialJob] Scheduled: Discovery (30m), Refresh (4h), Scoring (5m)');

  // Run initial setup on startup
  setTimeout(async () => {
    // Ensure database has quality users (use hardcoded FIDs if empty, do NOT auto-call Dune)
    try {
      const existingFids = await qualityUsersRepo.getQualityFids();
      if (existingFids.length === 0) {
        // Use hardcoded FIDs and seed to database (no Dune API call)
        await qualityUsersRepo.seedInitialQualityUsers(QUALITY_FIDS);
      }
    } catch (error) {
      // Silently continue
    }

    // Run initial discovery
    runDiscoveryJob();
  }, 5000); // Wait 5 seconds for services to be ready
}


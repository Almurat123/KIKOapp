import prisma, { withRetry } from '../db/prisma.js';
import { get, set } from '../cache/redis.js';
import { Decimal } from 'decimal.js';

export interface QualityFarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  followers?: number;
  following?: number;
  totalCasts?: number;
  engagementRate?: number;
  source?: string;
  isActive?: boolean;
  hasCreatorCoin?: boolean;
  creatorCoinAddress?: string;
  lastCoinCheck?: Date;
}

const CACHE_KEY = 'farcaster:quality_users';
const CACHE_TTL = 3600; // 1 hour

export async function getQualityFids(): Promise<number[]> {
  try {
    const cached = await get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as number[];
    }

    const result = await prisma.qualityFarcasterUser.findMany({
      where: { isActive: true },
      orderBy: { followers: 'desc' },
      take: 2000,
      select: { fid: true }
    });

    const fids = result.map(row => row.fid);

    if (fids.length > 0) {
      await set(CACHE_KEY, JSON.stringify(fids), CACHE_TTL);
    }

    return fids;
  } catch (error) {
    console.error('[QualityUsersRepo] Error getting quality FIDs:', error);
    return [];
  }
}

export async function getQualityUsers(limit: number = 100): Promise<QualityFarcasterUser[]> {
  try {
    const result = await prisma.qualityFarcasterUser.findMany({
      where: { isActive: true },
      orderBy: { followers: 'desc' },
      take: limit
    });

    return result.map((row) => ({
      fid: row.fid,
      username: row.username || undefined,
      displayName: row.displayName || undefined,
      followers: row.followers,
      following: row.following,
      totalCasts: row.totalCasts,
      engagementRate: Number(row.engagementRate),
      source: row.source || undefined,
      isActive: row.isActive,
      hasCreatorCoin: row.hasCreatorCoin,
      creatorCoinAddress: row.creatorCoinAddress || undefined,
      lastCoinCheck: row.lastCoinCheck || undefined,
    }));
  } catch (error) {
    console.error('[QualityUsersRepo] Error getting quality users:', error);
    return [];
  }
}

export async function saveQualityUsers(users: QualityFarcasterUser[]): Promise<number> {
  if (users.length === 0) return 0;
  let savedCount = 0;

  try {
    await withRetry(async () => {
      await prisma.$transaction(async (tx) => {
        for (const user of users) {
          await tx.qualityFarcasterUser.upsert({
            where: { fid: user.fid },
            update: {
              username: user.username || undefined,
              displayName: user.displayName || undefined,
              followers: user.followers || undefined,
              following: user.following || undefined,
              totalCasts: user.totalCasts || undefined,
              engagementRate: user.engagementRate !== undefined ? new Decimal(user.engagementRate) : undefined,
              source: user.source || 'dune',
              isActive: true,
              lastVerifiedAt: new Date(),
              updatedAt: new Date(),
            },
            create: {
              fid: user.fid,
              username: user.username || null,
              displayName: user.displayName || null,
              followers: user.followers || 0,
              following: user.following || 0,
              totalCasts: user.totalCasts || 0,
              engagementRate: new Decimal(user.engagementRate || 0),
              source: user.source || 'dune',
              isActive: true,
              lastVerifiedAt: new Date(),
            }
          });
          savedCount++;
        }
      });
    });

    await clearCache();
    return savedCount;
  } catch (error) {
    console.error('[QualityUsersRepo] Error saving quality users:', error);
    throw error;
  }
}

export async function updateUserCoinStatus(
  fid: number,
  hasCoin: boolean,
  coinAddress?: string
): Promise<void> {
  try {
    await withRetry(() => prisma.qualityFarcasterUser.update({
      where: { fid },
      data: {
        hasCreatorCoin: hasCoin,
        creatorCoinAddress: coinAddress || null,
        lastCoinCheck: new Date(),
        updatedAt: new Date(),
      }
    }));
  } catch (error) {
    console.error(`[QualityUsersRepo] Error updating coin status for FID ${fid}:`, error);
  }
}

/**
 * Seed initial quality users from hardcoded list
 */
export async function seedInitialQualityUsers(fids: number[]): Promise<number> {
  const users: QualityFarcasterUser[] = fids.map(fid => ({
    fid,
    source: 'manual',
    isActive: true,
  }));

  return saveQualityUsers(users);
}

export async function hasQualityUsers(): Promise<boolean> {
  try {
    const count = await prisma.qualityFarcasterUser.count({
      where: { isActive: true }
    });
    return count > 0;
  } catch (error) {
    console.error('[QualityUsersRepo] Error checking quality users:', error);
    return false;
  }
}

/**
 * Get statistics about quality users (follower distribution)
 */
export async function getQualityUsersStats() {
  try {
    const total = await prisma.qualityFarcasterUser.count({
      where: { isActive: true }
    });

    const over5k = await prisma.qualityFarcasterUser.count({
      where: {
        isActive: true,
        followers: { gte: 5000 }
      }
    });

    const over8k = await prisma.qualityFarcasterUser.count({
      where: {
        isActive: true,
        followers: { gte: 8000 }
      }
    });

    // We can use groupBy for the distribution, but since the ranges are custom, 
    // a small set of queries might be simpler or we use $queryRaw for efficiency if there are many.
    // Given the specific ranges in social.ts, let's use a single queryRaw for performance.
    const distributionResult: any[] = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN followers >= 10000 THEN '10K+'
          WHEN followers >= 8000 THEN '8K-10K'
          WHEN followers >= 5000 THEN '5K-8K'
          WHEN followers >= 1000 THEN '1K-5K'
          WHEN followers >= 100 THEN '100-1K'
          WHEN followers >= 10 THEN '10-100'
          ELSE '<10'
        END as range,
        CAST(COUNT(*) AS INTEGER) as count
      FROM quality_farcaster_users
      WHERE is_active = TRUE
      GROUP BY range
    `;

    const rangeOrder: { [key: string]: number } = {
      '10K+': 1,
      '8K-10K': 2,
      '5K-8K': 3,
      '1K-5K': 4,
      '100-1K': 5,
      '10-100': 6,
      '<10': 7,
    };

    const distribution = distributionResult
      .map(row => ({
        range: row.range,
        count: row.count,
        percentage: total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => (rangeOrder[a.range] || 99) - (rangeOrder[b.range] || 99));

    return {
      total,
      over5k,
      over8k,
      percentages: {
        over5k: total > 0 ? ((over5k / total) * 100).toFixed(1) : '0.0',
        over8k: total > 0 ? ((over8k / total) * 100).toFixed(1) : '0.0',
      },
      distribution,
    };
  } catch (error) {
    console.error('[QualityUsersRepo] Error getting quality users stats:', error);
    throw error;
  }
}

/**
 * Clear the FIDs cache
 */
export async function clearCache(): Promise<void> {
  try {
    // Set with TTL of 1 second to expire immediately
    await set(CACHE_KEY, '[]', 1);
    console.log('[QualityUsersRepo] Cache cleared');
  } catch (error) {
    console.error('[QualityUsersRepo] Error clearing cache:', error);
  }
}

// Default export for compatibility
export default {
  getQualityFids,
  getQualityUsers,
  saveQualityUsers,
  updateUserCoinStatus,
  seedInitialQualityUsers,
  hasQualityUsers,
  getQualityUsersStats,
  clearCache,
};

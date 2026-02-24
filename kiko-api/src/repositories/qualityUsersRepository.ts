import prisma, { withRetry } from '../db/prisma.js';
import { get, set } from '../cache/cacheClient.js';
import { Decimal } from 'decimal.js';

export interface QualityFarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: string;
  bio?: string;
  verifications?: Array<{ address: string; protocol: string }>;
  url?: string;            // USER_DATA_TYPE_URL — personal website
  banner?: string;         // USER_DATA_TYPE_BANNER — profile banner image
  primaryAddress?: string; // USER_DATA_PRIMARY_ADDRESS_ETHEREUM
  location?: string;       // USER_DATA_TYPE_LOCATION — geo:lat,lng
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
      pfp: row.pfp || undefined,
      bio: row.bio || undefined,
      verifications: Array.isArray(row.verifications) ? row.verifications as Array<{ address: string; protocol: string }> : [],
      url: (row as any).url || undefined,
      banner: (row as any).banner || undefined,
      primaryAddress: (row as any).primaryAddress || undefined,
      location: (row as any).location || undefined,
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
              pfp: user.pfp || undefined,
              bio: user.bio || undefined,
              verifications: user.verifications || undefined,
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
              pfp: user.pfp || null,
              bio: user.bio || null,
              verifications: user.verifications || [],
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
    await withRetry(() => prisma.qualityFarcasterUser.upsert({
      where: { fid },
      update: {
        hasCreatorCoin: hasCoin,
        creatorCoinAddress: coinAddress || null,
        lastCoinCheck: new Date(),
        updatedAt: new Date(),
      },
      create: {
        fid,
        hasCreatorCoin: hasCoin,
        creatorCoinAddress: coinAddress || null,
        lastCoinCheck: new Date(),
        isActive: true,
        source: 'coin_check',
      }
    }));
  } catch (error) {
    console.error(`[QualityUsersRepo] Error updating coin status for FID ${fid}:`, error);
  }
}

/**
 * Get profile for a specific FID
 */
export async function getProfileByFid(fid: number): Promise<QualityFarcasterUser | null> {
  try {
    const row = await prisma.qualityFarcasterUser.findUnique({
      where: { fid }
    });

    if (!row) return null;

    return {
      fid: row.fid,
      username: row.username || undefined,
      displayName: row.displayName || undefined,
      pfp: row.pfp || undefined,
      bio: row.bio || undefined,
      verifications: Array.isArray(row.verifications) ? row.verifications as any[] : [],
      url: (row as any).url || undefined,
      banner: (row as any).banner || undefined,
      primaryAddress: (row as any).primaryAddress || undefined,
      location: (row as any).location || undefined,
      followers: row.followers,
      following: row.following,
      totalCasts: row.totalCasts,
      engagementRate: Number(row.engagementRate),
      source: row.source || undefined,
      isActive: row.isActive,
      hasCreatorCoin: row.hasCreatorCoin,
      creatorCoinAddress: row.creatorCoinAddress || undefined,
      lastCoinCheck: row.lastCoinCheck || undefined,
    };
  } catch (error) {
    console.error(`[QualityUsersRepo] Error getting profile for FID ${fid}:`, error);
    return null;
  }
}

/**
 * Update user profile details
 */
export async function updateProfile(fid: number, data: Partial<QualityFarcasterUser>): Promise<void> {
  try {
    await withRetry(() => prisma.qualityFarcasterUser.upsert({
      where: { fid },
      update: {
        username: data.username,
        displayName: data.displayName,
        pfp: data.pfp,
        bio: data.bio,
        verifications: data.verifications,
        url: (data as any).url ?? undefined,
        banner: (data as any).banner ?? undefined,
        primaryAddress: (data as any).primaryAddress ?? undefined,
        location: (data as any).location ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        fid,
        username: data.username || null,
        displayName: data.displayName || null,
        pfp: data.pfp || null,
        bio: data.bio || null,
        verifications: data.verifications || [],
        url: (data as any).url || null,
        banner: (data as any).banner || null,
        primaryAddress: (data as any).primaryAddress || null,
        location: (data as any).location || null,
        source: data.source || 'manual_sync',
        isActive: true,
      }
    }));
  } catch (error) {
    console.error(`[QualityUsersRepo] Error updating profile for FID ${fid}:`, error);
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
  getProfileByFid,
  updateProfile,
};

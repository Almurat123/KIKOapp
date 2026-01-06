/**
 * Quality Farcaster Users Repository
 * Handles storage and retrieval of high-quality Farcaster users
 */

import { pool } from '../db/connection.js';
import { get, set } from '../cache/redis.js';

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

/**
 * Get all quality user FIDs from cache or database
 */
export async function getQualityFids(): Promise<number[]> {
  try {
    // Try cache first
    const cached = await get(CACHE_KEY);
    if (cached) {
      const fids = JSON.parse(cached) as number[];
      console.log(`[QualityUsersRepo] Returning ${fids.length} cached FIDs`);
      return fids;
    }

    // Fallback to database
    const result = await pool.query(
      `SELECT fid FROM quality_farcaster_users 
       WHERE is_active = TRUE 
       ORDER BY followers DESC NULLS LAST
       LIMIT 2000`
    );

    const fids = result.rows.map((row: any) => row.fid);

    // Cache the result
    if (fids.length > 0) {
      await set(CACHE_KEY, JSON.stringify(fids), CACHE_TTL);
    }

    console.log(`[QualityUsersRepo] Retrieved ${fids.length} FIDs from database`);
    return fids;
  } catch (error) {
    console.error('[QualityUsersRepo] Error getting quality FIDs:', error);
    return [];
  }
}

/**
 * Get all quality users with full details
 */
export async function getQualityUsers(limit: number = 100): Promise<QualityFarcasterUser[]> {
  try {
    const result = await pool.query(
      `SELECT fid, username, display_name, followers, following, 
              total_casts, engagement_rate, source, is_active,
              has_creator_coin, creator_coin_address, last_coin_check
       FROM quality_farcaster_users 
       WHERE is_active = TRUE 
       ORDER BY followers DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => ({
      fid: row.fid,
      username: row.username,
      displayName: row.display_name,
      followers: row.followers,
      following: row.following,
      totalCasts: row.total_casts,
      engagementRate: parseFloat(row.engagement_rate) || 0,
      source: row.source,
      isActive: row.is_active,
      hasCreatorCoin: row.has_creator_coin,
      creatorCoinAddress: row.creator_coin_address,
      lastCoinCheck: row.last_coin_check,
    }));
  } catch (error) {
    console.error('[QualityUsersRepo] Error getting quality users:', error);
    return [];
  }
}

/**
 * Save quality users from Dune (upsert)
 */
export async function saveQualityUsers(users: QualityFarcasterUser[]): Promise<number> {
  if (users.length === 0) return 0;

  const client = await pool.connect();
  let savedCount = 0;

  try {
    await client.query('BEGIN');

    for (const user of users) {
      await client.query(
        `INSERT INTO quality_farcaster_users 
         (fid, username, display_name, followers, following, total_casts, engagement_rate, source, is_active, last_verified_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
         ON CONFLICT (fid) DO UPDATE SET
           username = COALESCE(EXCLUDED.username, quality_farcaster_users.username),
           display_name = COALESCE(EXCLUDED.display_name, quality_farcaster_users.display_name),
           followers = COALESCE(EXCLUDED.followers, quality_farcaster_users.followers),
           following = COALESCE(EXCLUDED.following, quality_farcaster_users.following),
           total_casts = COALESCE(EXCLUDED.total_casts, quality_farcaster_users.total_casts),
           engagement_rate = COALESCE(EXCLUDED.engagement_rate, quality_farcaster_users.engagement_rate),
           source = EXCLUDED.source,
           is_active = TRUE,
           last_verified_at = NOW(),
           updated_at = NOW()`,
        [
          user.fid,
          user.username || null,
          user.displayName || null,
          user.followers || 0,
          user.following || 0,
          user.totalCasts || 0,
          user.engagementRate || 0,
          user.source || 'dune',
        ]
      );
      savedCount++;
    }

    await client.query('COMMIT');

    // Clear cache after update
    await clearCache();

    console.log(`[QualityUsersRepo] Saved ${savedCount} quality users`);
    return savedCount;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[QualityUsersRepo] Error saving quality users:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update user coin status
 */
export async function updateUserCoinStatus(
  fid: number,
  hasCoin: boolean,
  coinAddress?: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE quality_farcaster_users 
       SET has_creator_coin = $1, 
           creator_coin_address = $2,
           last_coin_check = NOW(),
           updated_at = NOW()
       WHERE fid = $3`,
      [hasCoin, coinAddress || null, fid]
    );
    // console.log(`[QualityUsersRepo] Updated coin status for FID ${fid}: ${hasCoin}`);
  } catch (error) {
    console.error(`[QualityUsersRepo] Error updating coin status for FID ${fid}:`, error);
  } finally {
    client.release();
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

/**
 * Check if we have quality users in database
 */
export async function hasQualityUsers(): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM quality_farcaster_users WHERE is_active = TRUE`
    );
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('[QualityUsersRepo] Error checking quality users:', error);
    return false;
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
  clearCache,
};

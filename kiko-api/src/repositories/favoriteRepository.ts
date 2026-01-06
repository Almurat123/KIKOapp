import prisma from '../lib/prisma.js';

export interface FavoriteToken {
    id?: string;
    userId: string;
    chain: string;
    address: string;
    createdAt?: Date;
}

export interface TokenRule {
    id?: number;
    userId: string;
    chain: string;
    address: string;
    ruleType: string;
    conditionValue: number;
    action: string;
    isActive: boolean;
    createdAt?: Date;
}

/**
 * Add a token to favorites
 */
export async function addFavorite(userId: string, chain: string, address: string): Promise<boolean> {
    try {
        // Ensure user exists first (to satisfy foreign key)
        // This handles 'demo-user' or other cases where user record might be missing
        await prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: {
                id: userId,
                privyDid: `did:privy:${userId}`, // Dummy DID
                // Use a pseudo-random or deterministic dummy address to avoid collision if multiple unknown users
                walletAddress: userId === 'demo-user'
                    ? '0x000000000000000000000000000000000000dEaD'
                    : `0x${userId.substring(0, 40).padEnd(40, '0')}`
            }
        });

        await prisma.favoriteToken.upsert({
            where: {
                userId_chain_address: {
                    userId,
                    chain,
                    address
                }
            },
            update: {},
            create: {
                userId,
                chain,
                address
            }
        });
        return true;
    } catch (error) {
        console.error('Error adding favorite:', error);
        return false;
    }
}

/**
 * Remove a token from favorites (case-insensitive)
 */
export async function removeFavorite(userId: string, chain: string, address: string): Promise<boolean> {
    try {
        // Prisma relies on exact matches usually, but we can try deleteMany with mode
        // Or fetch first to get ID. For now, let's assume case-sensitive or standardized input.
        // If we need case-insensitive, we might need raw SQL or search first.

        // Better approach: standardized input before calling this function in controller.
        // Assuming inputs are already normalized (lowercase usually).

        await prisma.favoriteToken.deleteMany({
            where: {
                userId,
                chain: { equals: chain, mode: 'insensitive' },
                address: { equals: address, mode: 'insensitive' }
            }
        });
        return true;
    } catch (error) {
        console.error('Error removing favorite:', error);
        return false;
    }
}

/**
 * Get all favorites for a user
 */
export async function getUserFavorites(userId: string): Promise<FavoriteToken[]> {
    try {
        const result = await prisma.favoriteToken.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                userId: true,
                chain: true,
                address: true,
                createdAt: true
            }
        });

        return result;
    } catch (error) {
        console.error('Error getting favorites:', error);
        return [];
    }
}

/**
 * Check if a token is favorited (case-insensitive chain match)
 */
export async function isFavorite(userId: string, chain: string, address: string): Promise<boolean> {
    try {
        const count = await prisma.favoriteToken.count({
            where: {
                userId,
                chain: { equals: chain, mode: 'insensitive' },
                address: { equals: address, mode: 'insensitive' }
            }
        });
        return count > 0;
    } catch (error) {
        console.error('Error checking favorite:', error);
        return false;
    }
}

/**
 * Add a rule for a token
 * NOTE: TokenRules table might not be in Prisma yet.
 * If token_rules table exists only in SQL, we should keep raw SQL for it or add it to Prisma.
 * For now, retaining raw SQL for TokenRules as likely only Favorites was added to Prisma.
 * But wait, previous code used `pool`. If we remove `pool`, we break this.
 * Let's keep `pool` import for legacy/unmigrated tables if necessary.
 */
import { pool } from '../db/connection.js';

export async function addTokenRule(rule: TokenRule): Promise<TokenRule | null> {
    try {
        const result = await pool.query(
            `INSERT INTO token_rules (user_id, chain, address, rule_type, condition_value, action, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [rule.userId, rule.chain, rule.address, rule.ruleType, rule.conditionValue, rule.action, rule.isActive]
        );

        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.user_id,
            chain: row.chain,
            address: row.address,
            ruleType: row.rule_type,
            conditionValue: parseFloat(row.condition_value),
            action: row.action,
            isActive: row.is_active,
            createdAt: row.created_at
        };
    } catch (error) {
        console.error('Error adding rule:', error);
        return null;
    }
}

/**
 * Get rules for a user
 */
export async function getUserRules(userId: string): Promise<TokenRule[]> {
    try {
        const result = await pool.query(
            `SELECT * FROM token_rules WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );

        return result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            chain: row.chain,
            address: row.address,
            ruleType: row.rule_type,
            conditionValue: parseFloat(row.condition_value),
            action: row.action,
            isActive: row.is_active,
            createdAt: row.created_at
        }));
    } catch (error) {
        console.error('Error getting rules:', error);
        return [];
    }
}

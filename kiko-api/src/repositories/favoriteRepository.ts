import prisma, { withRetry } from '../db/prisma.js';

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
        await withRetry(async () => {
            await prisma.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    privyDid: `did:privy:${userId}`,
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

        await withRetry(() => prisma.favoriteToken.deleteMany({
            where: {
                userId,
                chain: { equals: chain, mode: 'insensitive' },
                address: { equals: address, mode: 'insensitive' }
            }
        }));
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

export async function addTokenRule(rule: TokenRule): Promise<TokenRule | null> {
    return withRetry(async () => {
        const row = await prisma.tokenRule.create({
            data: {
                userId: rule.userId,
                chain: rule.chain,
                address: rule.address,
                ruleType: rule.ruleType,
                conditionValue: rule.conditionValue,
                action: rule.action,
                isActive: rule.isActive
            }
        });

        return {
            id: row.id,
            userId: row.userId,
            chain: row.chain,
            address: row.address,
            ruleType: row.ruleType,
            conditionValue: Number(row.conditionValue),
            action: row.action,
            isActive: row.isActive,
            createdAt: row.createdAt
        };
    });
}

/**
 * Get rules for a user
 */
export async function getUserRules(userId: string): Promise<TokenRule[]> {
    const result = await prisma.tokenRule.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
    });

    return result.map(row => ({
        id: row.id,
        userId: row.userId,
        chain: row.chain,
        address: row.address,
        ruleType: row.ruleType,
        conditionValue: Number(row.conditionValue),
        action: row.action,
        isActive: row.isActive,
        createdAt: row.createdAt
    }));
}

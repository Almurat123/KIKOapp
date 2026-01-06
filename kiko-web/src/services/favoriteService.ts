import { fetchApi } from './api';
import { apiCache } from '../utils/apiCache';

export interface FavoriteToken {
    id: number;
    userId: string;
    chain: string;
    address: string;
    createdAt: string;
}

export interface TokenRule {
    id: number;
    userId: string;
    chain: string;
    address: string;
    ruleType: string;
    conditionValue: number;
    action: string;
    isActive: boolean;
    createdAt: string;
}

// NOTE: fetchApi already unwraps { success, data } and returns just the data portion
// So we receive the data directly, not wrapped in ApiResponse

export const favoriteApi = {
    // Get all favorites - fetchApi returns FavoriteToken[] directly
    getFavorites: async (userId?: string): Promise<FavoriteToken[]> => {
        try {
            const result = await fetchApi<FavoriteToken[]>('/api/favorites', {
                headers: {
                    ...(userId ? { 'x-user-id': userId } : {}),
                }
            });
            console.log('[favoriteApi] getFavorites result:', result);
            return result || [];
        } catch (e) {
            console.error('Failed to get favorites:', e);
            return [];
        }
    },

    // Add a favorite - backend returns { success: boolean } but fetchApi unwraps to just the data
    // Actually for POST, the backend returns { success: true } which has no .data
    // So we need to check the response differently
    addFavorite: async (chain: string, address: string, userId?: string): Promise<boolean> => {
        try {
            console.log('[favoriteApi] addFavorite called:', { chain, address });
            // For POST/DELETE, fetchApi will throw if !response.ok or !data.success
            // If it doesn't throw, the request succeeded
            await fetchApi<void>('/api/favorites', {
                method: 'POST',
                body: JSON.stringify({ chain, address }),
                headers: {
                    'Content-Type': 'application/json',
                    ...(userId ? { 'x-user-id': userId } : {}),
                }
            });
            console.log('[favoriteApi] addFavorite success');
            // Clear cache to force fresh fetch
            apiCache.clear();
            return true;
        } catch (e) {
            console.error('[favoriteApi] addFavorite failed:', e);
            return false;
        }
    },

    // Remove a favorite
    removeFavorite: async (chain: string, address: string, userId?: string): Promise<boolean> => {
        try {
            console.log('[favoriteApi] removeFavorite called:', { chain, address });
            await fetchApi<void>(`/api/favorites/${address}?chain=${chain}`, {
                method: 'DELETE',
                headers: {
                    ...(userId ? { 'x-user-id': userId } : {}),
                }
            });
            console.log('[favoriteApi] removeFavorite success');
            // Clear cache to force fresh fetch
            apiCache.clear();
            return true;
        } catch (e) {
            console.error('[favoriteApi] removeFavorite failed:', e);
            return false;
        }
    },

    // Check if favorite - backend returns { success: true, data: { isFavorite: boolean } }
    checkFavorite: async (chain: string, address: string, userId?: string): Promise<boolean> => {
        try {
            const result = await fetchApi<{ isFavorite: boolean }>(
                `/api/favorites/check?chain=${chain}&address=${address}`,
                { headers: { ...(userId ? { 'x-user-id': userId } : {}) } }
            );
            console.log('[favoriteApi] checkFavorite result:', result);
            return result?.isFavorite ?? false;
        } catch (e) {
            console.error('Failed to check favorite:', e);
            return false;
        }
    },

    // Get user rules
    getRules: async (userId?: string): Promise<TokenRule[]> => {
        try {
            const result = await fetchApi<TokenRule[]>('/api/favorites/rules', {
                headers: { ...(userId ? { 'x-user-id': userId } : {}) }
            });
            return result || [];
        } catch (e) {
            console.error('Failed to get rules:', e);
            return [];
        }
    },

    // Add a rule
    addRule: async (rule: Partial<TokenRule>, userId?: string): Promise<TokenRule | null> => {
        try {
            const result = await fetchApi<TokenRule>('/api/favorites/rules', {
                method: 'POST',
                body: JSON.stringify(rule),
                headers: {
                    'Content-Type': 'application/json',
                    ...(userId ? { 'x-user-id': userId } : {}),
                }
            });
            return result || null;
        } catch (e) {
            console.error('Failed to add rule:', e);
            return null;
        }
    }
};

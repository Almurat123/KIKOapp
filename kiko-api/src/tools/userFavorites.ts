import { Tool } from './registry.js';
import { getUserFavorites } from '../repositories/favoriteRepository.js';
import * as geckoTerminal from '../services/geckoTerminal.js';
import * as dexscreener from '../services/dexscreener.js';

// Helper to fetch token name
async function getTokenName(chain: string, address: string): Promise<{ name: string; symbol: string } | null> {
    try {
        // Try GeckoTerminal first
        const data = await geckoTerminal.getTokenDetails(chain.toLowerCase(), address);
        if (data && (data.name || data.symbol)) {
            return { name: data.name || 'Unknown', symbol: data.symbol || 'UNKNOWN' };
        }
    } catch (e) {
        // Ignore, try DexScreener
    }

    try {
        // Fallback to DexScreener
        const dexData = await dexscreener.getTokenDetails(chain.toLowerCase(), address);
        if (dexData && (dexData.name || dexData.symbol)) {
            return { name: dexData.name || 'Unknown', symbol: dexData.symbol || 'UNKNOWN' };
        }
    } catch (e) {
        // Ignore
    }

    return null;
}

export const GetUserFavoritesTool: Tool = {
    definition: {
        name: 'get_user_favorites',
        description: 'Get the list of tokens that the user has added to their favorites/watchlist. Returns token names, symbols, addresses, and chains that the user is tracking.',
        parameters: {
            type: 'object',
            properties: {
                // No required parameters - uses userId from context
            },
            required: []
        }
    },
    permissions: 'user',  // Requires user context
    handler: async (_args, context) => {
        try {
            // Get userId from context (passed from frontend)
            const userId = context?.userId || 'demo-user';

            const favorites = await getUserFavorites(userId);

            if (!favorites || favorites.length === 0) {
                return {
                    message: 'User has no favorite tokens yet.',
                    favorites: [],
                    count: 0
                };
            }

            // Fetch token names for each favorite
            const enrichedFavorites = await Promise.all(
                favorites.map(async (f) => {
                    const tokenInfo = await getTokenName(f.chain, f.address);
                    return {
                        name: tokenInfo?.name || 'Unknown',
                        symbol: tokenInfo?.symbol || 'UNKNOWN',
                        chain: f.chain.toUpperCase(),
                        address: f.address,
                        addedAt: f.createdAt
                    };
                })
            );

            return {
                message: `User has ${favorites.length} favorite token(s).`,
                favorites: enrichedFavorites,
                count: favorites.length
            };
        } catch (error: any) {
            return { error: error.message || 'Failed to fetch user favorites' };
        }
    }
};

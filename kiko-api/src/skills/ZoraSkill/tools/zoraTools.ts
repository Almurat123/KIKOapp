import { Tool } from '../../../tools/registry.js';
import { zoraService } from '../../../services/zoraService.js';

/**
 * Tool to get trending coins on Zora
 */
export const GetZoraTrendingTool: Tool = {
    definition: {
        name: 'get_zora_trending',
        description: 'Get trending coins on Zora. Use this when users ask for new coins, top gainers, or active coins on Zora.',
        parameters: {
            type: 'object',
            properties: {
                category: {
                    type: 'string',
                    enum: ['gainers', 'volume', 'new'],
                    description: 'The category of trending coins to fetch. Default is "gainers".'
                },
                limit: {
                    type: 'integer',
                    description: 'Number of coins to return (1-50). Default is 20.'
                }
            },
            required: []
        }
    },
    handler: async ({ category = 'gainers', limit = 20 }) => {
        try {
            let coins = [];
            switch (category) {
                case 'volume':
                    coins = await zoraService.getTopVolume24h(limit);
                    break;
                case 'new':
                    coins = await zoraService.getNewCoins(limit);
                    break;
                case 'gainers':
                default:
                    coins = await zoraService.getTopGainers(limit);
                    break;
            }

            return {
                success: true,
                category,
                count: coins.length,
                coins: coins.map((c: any) => ({
                    name: c.name,
                    symbol: c.symbol,
                    address: c.address,
                    priceUsdc: c.tokenPrice?.priceInUsdc,
                    marketCapUsdc: c.marketCap,
                    dailyVolumeUsdc: c.dailyVolumeUsdc,
                    dailyChange: c.dailyChange,
                    creatorFid: c.creatorFid
                }))
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
};

/**
 * Tool to get Zora user profile
 */
export const GetZoraProfileTool: Tool = {
    definition: {
        name: 'get_zora_profile',
        description: 'Get detailed Zora profile information by wallet address or handle. Provides social links and creator coin data.',
        parameters: {
            type: 'object',
            properties: {
                identifier: {
                    type: 'string',
                    description: 'The wallet address or Zora handle of the user.'
                }
            },
            required: ['identifier']
        }
    },
    handler: async ({ identifier }) => {
        try {
            const profile = await zoraService.getUserProfile(identifier);
            if (!profile) return { success: false, error: 'Profile not found' };

            return {
                success: true,
                profile: {
                    displayName: profile.displayName,
                    bio: profile.bio,
                    avatar: profile.avatar,
                    socialAccounts: profile.socialAccounts,
                    creatorCoin: profile.creatorCoin ? {
                        address: profile.creatorCoin.address,
                        marketCap: profile.creatorCoin.marketCap
                    } : null
                }
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
};

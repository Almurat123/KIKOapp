import { Tool } from './registry.js';
import * as geckoTerminal from '../services/geckoTerminal.js';
import * as dexscreener from '../services/dexscreener.js';

export const GetTokenInfoTool: Tool = {
    definition: {
        name: 'get_token_info',
        description: 'Get current price, volume, and detailed metadata for a specific token on a blockchain.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The smart contract address of the token (e.g. 0x...)',
                },
                chain: {
                    type: 'string',
                    description: 'The blockchain network ID (e.g. eth, solana, base, bsc)',
                    enum: ['eth', 'solana', 'base', 'bsc', 'arbitrum', 'polygon', 'optimism', 'avalanche']
                }
            },
            required: ['address', 'chain']
        }
    },
    handler: async (args) => {
        try {
            // Map common chain names if necessary, but GeckoTerminal uses standard slugs mostly
            // 1. Try GeckoTerminal first
            // 3. Check if it is a launchpad token
            const { detectLaunchpadToken } = await import('../services/ai/launchpadDetector.js');
            if (!args.chain) {
                return { error: 'Chain is required' };
            }

            const chainIdMap: Record<string, number> = {
                'eth': 1, 'ethereum': 1,
                'base': 8453,
                'bsc': 56,
                'arbitrum': 42161,
                'polygon': 137,
                'optimism': 10,
                'avalanche': 43114,
                'solana': 900
            };
            const chainId = chainIdMap[args.chain.toLowerCase()] || 8453;
            const launchpad = await detectLaunchpadToken(args.address, chainId);

            // 1. Try GeckoTerminal first
            let tokenData: any = null;
            try {
                tokenData = await geckoTerminal.getTokenDetails(args.chain, args.address);
            } catch (gtError) {
                console.warn('[GetTokenInfo] GeckoTerminal failed, trying fallback...', gtError);
            }

            // 2. Fallback to DexScreener
            console.log('[GetTokenInfo] Attempting DexScreener fallback...');
            const dexData = await dexscreener.getTokenDetails(args.chain, args.address);

            if (dexData) {
                return {
                    source: 'DexScreener',
                    ...dexData,
                    chainId: chainId, // Ensure numeric chainId
                    launchpad
                };
            }

            if (tokenData) {
                return {
                    ...tokenData,
                    chainId: chainId, // Ensure numeric chainId
                    launchpad
                };
            }

            if (launchpad) {
                return {
                    address: args.address,
                    chainId,
                    launchpad,
                    source: 'LaunchpadDetector'
                };
            }

            return { error: 'Token not found on GeckoTerminal or DexScreener' };
        } catch (error: any) {
            return { error: error.message || 'Failed to fetch token info' };
        }
    }
};

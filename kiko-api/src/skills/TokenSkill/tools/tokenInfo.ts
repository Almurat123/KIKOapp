import { Tool } from '../../../tooling/registry.js';
import * as geckoTerminal from '../../../services/geckoTerminal.js';
import * as dexscreener from '../../../services/dexscreener.js';
import { resolveChainInput } from '../../../utils/chainParam.js';

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
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56, 900',
                }
            },
            required: ['address']
        }
    },
    handler: async (args, context) => {
        try {
            // Map common chain names if necessary, but GeckoTerminal uses standard slugs mostly
            // 1. Try GeckoTerminal first
            // 3. Check if it is a launchpad token
            const { detectLaunchpadToken } = await import('../../../services/ai/launchpadDetector.js');
            const { chain, chainId, invalidChainId } = resolveChainInput(args, {
                contextChainId: context?.chainId,
                defaultChain: 'eth',
            });
            if (invalidChainId) {
                return { error: `Unsupported chain_id: ${String(args.chain_id)}` };
            }
            const resolvedChainId = chainId ?? 1;
            const launchpad = await detectLaunchpadToken(args.address, resolvedChainId);

            // 1. Try GeckoTerminal first
            let tokenData: any = null;
            try {
                tokenData = await geckoTerminal.getTokenDetails(chain, args.address);
            } catch (gtError) {
                console.warn('[GetTokenInfo] GeckoTerminal failed, trying fallback...', gtError);
            }

            // 2. Fallback to DexScreener
            console.log('[GetTokenInfo] Attempting DexScreener fallback...');
            const dexData = await dexscreener.getTokenDetails(chain, args.address);

            if (dexData) {
                const launchpadProvider = (launchpad as any)?.provider;
                return {
                    source: 'DexScreener',
                    ...dexData,
                    chainId: resolvedChainId, // Ensure numeric chainId
                    launchpad,
                    isLaunchpad: !!launchpad,
                    launchpadProvider,
                    // Normalized aliases (stable fields for prompts/skills)
                    tokenAddress: dexData.address,
                    tokenSymbol: dexData.symbol,
                    tokenName: dexData.name,
                    priceUsd: dexData.price,
                    liquidityUsd: dexData.liquidity,
                    fdvUsd: dexData.fdv,
                    volume24hUsd: dexData.volume24h,
                    priceChange24hPct: dexData.priceChange24h,
                    poolAddress: dexData.poolAddress
                };
            }

            if (tokenData) {
                const launchpadProvider = (launchpad as any)?.provider;
                return {
                    ...tokenData,
                    chainId: resolvedChainId, // Ensure numeric chainId
                    launchpad,
                    isLaunchpad: !!launchpad,
                    launchpadProvider,
                    // Normalized aliases where available (best-effort)
                    tokenAddress: (tokenData as any).address || args.address,
                    tokenSymbol: (tokenData as any).symbol,
                    tokenName: (tokenData as any).name,
                    priceUsd: (tokenData as any).price,
                    liquidityUsd: (tokenData as any).liquidity,
                    fdvUsd: (tokenData as any).fdv,
                    volume24hUsd: (tokenData as any).volume24h,
                    priceChange24hPct: (tokenData as any).priceChange24h,
                    poolAddress: (tokenData as any).poolAddress
                };
            }

            if (launchpad) {
                return {
                    address: args.address,
                    chainId: resolvedChainId,
                    launchpad,
                    isLaunchpad: true,
                    launchpadProvider: (launchpad as any)?.provider,
                    source: 'LaunchpadDetector'
                };
            }

            return { error: 'Token not found on GeckoTerminal or DexScreener' };
        } catch (error: any) {
            return { error: error.message || 'Failed to fetch token info' };
        }
    }
};

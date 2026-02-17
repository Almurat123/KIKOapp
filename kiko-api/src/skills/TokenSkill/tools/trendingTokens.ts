import { Tool, ToolContext } from '../../../tooling/registry.js';
import { getTrendingTokens as getCachedTrendingTokens } from '../../../repositories/tokenRepository.js';
import { resolveChainInput } from '../../../utils/chainParam.js';

export const GetTrendingTokensTool: Tool = {
    definition: {
        name: 'get_trending_tokens',
        description: 'Get currently trending/hot cryptocurrency tokens from KiKo cached token database (24h aggregates). ONLY use this tool when the user explicitly asks about: trending tokens, hot coins, what tokens are pumping, market movers, top gainers, or specific chain activity. Do NOT use this for general news, world events, or non-crypto topics. For news about the crypto industry (regulations, hacks, company updates), use external_web_search instead.',
        parameters: {
            type: 'object',
            properties: {
                chain: {
                    type: 'string',
                    description: 'The blockchain network (e.g. eth, base, solana, bsc, arbitrum)',
                    default: 'eth'
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56, 900'
                },
                limit: {
                    type: 'number',
                    description: 'Number of results to return (default 10, max 20)',
                    default: 10
                }
            }
        }
    },
    handler: async (args, context) => {
        try {
            const resolved = resolveChainInput(args, {
                contextChainId: (context as ToolContext | undefined)?.chainId,
                defaultChain: 'eth',
            });
            if (resolved.invalidChainId) {
                return { error: `Unsupported chain_id: ${String((args as any).chain_id)}` };
            }
            const chain = resolved.chain;
            const limit = Math.min(args.limit || 10, 20); // Cap at 20 for this heavy operation
            console.log(`[GetTrendingTokens] Fetching trending tokens for ${chain} from cached database...`);

            // Use cached token page data (DB + memory cache)
            const tokens = await getCachedTrendingTokens(chain, limit);

            if (!tokens || tokens.length === 0) {
                return { message: `No trending tokens found for ${chain} at the moment.` };
            }

            // Return simplified response with formatted numbers
            return tokens.map((t: any, index: number) => {
                let price = parseFloat(t.price) || 0;
                let formattedPrice = String(t.price);

                // Handle very small prices
                if (price > 0 && price < 0.000001) {
                    formattedPrice = price.toExponential(4);
                } else if (price < 1) {
                    formattedPrice = price.toFixed(6);
                } else if (price < 1000) {
                    formattedPrice = price.toFixed(4);
                } else {
                    formattedPrice = price.toLocaleString('en-US', { maximumFractionDigits: 2 });
                }

                // Format volume - use K, M, or B suffix
                const volume = parseFloat(t.volume24h || '0');
                let formattedVolume = '$0';
                if (volume >= 1_000_000_000) {
                    formattedVolume = `$${(volume / 1_000_000_000).toFixed(2)}B`;
                } else if (volume >= 1_000_000) {
                    formattedVolume = `$${(volume / 1_000_000).toFixed(2)}M`;
                } else if (volume >= 1000) {
                    formattedVolume = `$${(volume / 1000).toFixed(0)}K`;
                } else if (volume > 0) {
                    formattedVolume = `$${volume.toFixed(0)}`;
                }

                // Format liquidity
                const liquidity = parseFloat(t.liquidity || '0');
                let formattedLiquidity = '$0';
                if (liquidity >= 1_000_000) {
                    formattedLiquidity = `$${(liquidity / 1_000_000).toFixed(2)}M`;
                } else if (liquidity >= 1000) {
                    formattedLiquidity = `$${(liquidity / 1000).toFixed(0)}K`;
                } else if (liquidity > 0) {
                    formattedLiquidity = `$${liquidity.toFixed(0)}`;
                }

                // Show score if available (internal debug mostly, but useful for user to know why)
                const score = (t as any).score ? `(Score: ${(t as any).score.toFixed(0)})` : '';

                return {
                    rank: index + 1,
                    name: t.name,
                    symbol: t.symbol,
                    address: t.address,
                    price: formattedPrice,
                    volume24h: formattedVolume,
                    change24h: `${parseFloat(t.priceChange24h || '0').toFixed(2)}%`,
                    liquidity: formattedLiquidity,
                    // score: score // Optional to return score
                };
            });
        } catch (error: any) {
            console.error('[GetTrendingTokens] Error:', error.message);
            return { error: error.message || 'Failed to fetch trending tokens' };
        }
    }
};

import { Tool, ToolContext } from './registry.js';
import * as dexScreener from '../services/dexscreener.js';

export const GetTrendingTokensTool: Tool = {
    definition: {
        name: 'get_trending_tokens',
        description: 'Get currently trending/hot cryptocurrency tokens by trading activity. ONLY use this tool when the user explicitly asks about: trending tokens, hot coins, what tokens are pumping, market movers, top gainers, or specific chain activity. Do NOT use this for general news, world events, or non-crypto topics. For news about the crypto industry (regulations, hacks, company updates), use web_search instead.',
        parameters: {
            type: 'object',
            properties: {
                chain: {
                    type: 'string',
                    description: 'The blockchain network (e.g. eth, base, solana, bsc, arbitrum)',
                    default: 'eth'
                },
                limit: {
                    type: 'number',
                    description: 'Number of results to return (default 10, max 20)',
                    default: 10
                },
                duration: {
                    type: 'string',
                    description: 'Timeframe for trending calculation. Default is "5m" (captures latest "right now" trends). Use "1h", "6h", or "24h" only if explicitly requested.',
                    enum: ['5m', '1h', '6h', '24h'],
                    default: '5m'
                }
            },
            required: ['chain']
        }
    },
    handler: async (args, context) => {
        try {
            const chain = args.chain || 'eth';
            const limit = Math.min(args.limit || 10, 20); // Cap at 20 for this heavy operation
            const duration = (args.duration || '5m') as '5m' | '1h' | '6h' | '24h';

            console.log(`[GetTrendingTokens] Fetching trending tokens for ${chain} (${duration}) from DexScreener (Enhanced Algorithm)...`);

            // Use Enhanced DexScreener Search + Scoring
            const tokens = await dexScreener.getTrendingTokensByChain(chain, limit, duration);

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
                const volume = parseFloat(t.volume24h || '0'); // Note: this field now contains volume for the requested duration
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
                    [`volume${duration}`]: formattedVolume, // Dynamic key for volume (e.g., volume5m, volume24h)
                    [`change${duration}`]: `${parseFloat(t.priceChange24h || '0').toFixed(2)}%`, // Dynamic key for price change
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

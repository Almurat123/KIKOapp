import { Tool } from './registry.js';
import { getTradesByAssetId } from '../services/polymarketTradeService.js';
import { getEventDetails } from '../services/polymarket.js';

/**
 * Get Market Activity Tool
 * Fetches recent trades for a specific market (question) to analyze buy/sell pressure.
 */
export const GetMarketActivityTool: Tool = {
    definition: {
        name: 'get_market_activity',
        description: 'Get recent trading activity (buys/sells, volume, whale moves) for a specific prediction market outcome. Use this when user asks "who is buying?", "is there a sell-off?", or "check market flow". Requires a market/outcome token ID (usually from get_polymarket_event or get_polymarket_trending_markets).',
        parameters: {
            type: 'object',
            properties: {
                token_id: {
                    type: 'string',
                    description: 'The Asset/Token ID of the specific outcome (e.g., the ID for "Yes" or "No" token).'
                },
                limit: {
                    type: 'number',
                    description: 'Number of recent trades to fetch (default 20, max 100).'
                }
            },
            required: ['token_id']
        }
    },
    handler: async (args: { token_id: string; limit?: number }) => {
        if (!args.token_id) {
            throw new Error('token_id is required. Please find it from market details first.');
        }

        const limit = Math.min(args.limit || 20, 100);
        const trades = await getTradesByAssetId(args.token_id, limit);

        if (trades.length === 0) {
            return {
                message: 'No recent trades found for this token ID within the limit.'
            };
        }

        // Calculate basic stats
        const vol24h = trades.reduce((sum, t) => sum + t.volumeUSDC, 0);
        const buyVolume = trades.filter(t => t.type === 'BUY').reduce((sum, t) => sum + t.volumeUSDC, 0);
        const sellVolume = trades.filter(t => t.type === 'SELL').reduce((sum, t) => sum + t.volumeUSDC, 0);
        const buyPressure = vol24h > 0 ? (buyVolume / vol24h) * 100 : 0;

        // Identify "Whale" trades (arbitrary threshold, e.g., > $1000)
        const whaleTrades = trades.filter(t => t.volumeUSDC > 1000).map(t => ({
            type: t.type,
            amount_usdc: `$${Math.floor(t.volumeUSDC)}`,
            price: t.price.toFixed(3),
            time: t.date
        }));

        return {
            source: 'Polymarket Goldsky Node',
            token_id: args.token_id,
            count: trades.length,
            stats: {
                total_volume_in_result: `$${Math.floor(vol24h)}`,
                buy_pressure: `${buyPressure.toFixed(1)}%`,
                latest_price: trades[0].price.toFixed(3)
            },
            recent_trades: trades.slice(0, 5).map(t => ({
                type: t.type,
                shares: Math.floor(t.amount),
                usdc: `$${Math.floor(t.volumeUSDC)}`,
                price: t.price.toFixed(3),
                time: t.date
            })),
            whale_activity: whaleTrades.length > 0 ? whaleTrades : 'No recent large trades (> $1000)',
            note: 'Price is derived from the trade ratio (USDC/Shares).'
        };
    },
    permissions: 'public'
};

/**
 * Get Whale Watch Tool
 * Scans for globally large trades (abnormal activity).
 */
export const GetWhaleWatchTool: Tool = {
    definition: {
        name: 'get_whale_watch',
        description: 'Scan for recent large/abnormal trades globally across all Polymarket events. Detects "Whale" activity where single trades exceed $1000 (or specified amount). Use this when user asks for "abnormal activity", "whale watching", or "large bets".',
        parameters: {
            type: 'object',
            properties: {
                min_amount: {
                    type: 'number',
                    description: 'Minimum amount in USDC to consider a whale trade. Default is 1000.'
                },
                limit: {
                    type: 'number',
                    description: 'Number of trades to return (1-20). Default is 10.'
                }
            },
            required: []
        }
    },
    handler: async (args: { min_amount?: number; limit?: number }) => {
        const minAmount = args.min_amount || 1000;
        const limit = Math.min(args.limit || 10, 20);

        const trades = await import('../services/polymarketTradeService.js').then(m => m.getWhaleTrades(minAmount, limit));

        return {
            source: 'Polymarket/Goldsky',
            type: 'Abnormal/Whale Activity',
            min_threshold: `$${minAmount}`,
            count: trades.length,
            trades: trades.map(t => ({
                type: t.type,
                usdc_volume: `$${Math.floor(t.volumeUSDC).toLocaleString()}`,
                price: t.price.toFixed(3),
                time: t.date,
                market_maker: t.maker.slice(0, 6) + '...',
                tx: t.transactionHash
            })),
            note: 'These are individual trades exceeding the threshold.'
        };
    },
    permissions: 'public'
};

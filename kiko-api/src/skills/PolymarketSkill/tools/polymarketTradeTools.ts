import { Tool } from '../../../tooling/registry.js';
import { getTradesByAssetId } from '../../../services/polymarketTradeService.js';
import { getExecutablePrice } from '../../../services/polymarketDataService.js';
import { checkTradingReadiness } from '../../../services/polymarketApprovalService.js';
import { getEventDetails } from '../../../services/polymarket.js';

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

        const trades = await import('../../../services/polymarketTradeService.js').then(m => m.getWhaleTrades(minAmount, limit));

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

export const GetPolymarketQuoteTool: Tool = {
    definition: {
        name: 'get_polymarket_quote',
        description: 'Get the live executable BUY and SELL prices for a specific Polymarket outcome token. Use this to prepare a bet before placing a Polymarket order, especially for short-window markets.',
        parameters: {
            type: 'object',
            properties: {
                token_id: {
                    type: 'string',
                    description: 'Exact outcome token ID returned by get_polymarket_event, get_polymarket_trending_markets, or get_new_markets.'
                },
                amount_usd: {
                    type: 'number',
                    description: 'Optional USD amount to estimate shares for a BUY.'
                },
                shares: {
                    type: 'number',
                    description: 'Optional share amount to estimate exit value for a SELL.'
                }
            },
            required: ['token_id']
        }
    },
    handler: async (args: { token_id: string; amount_usd?: number; shares?: number }) => {
        const tokenId = String(args.token_id || '').trim();
        if (!tokenId) {
            throw new Error('token_id is required. Resolve the exact outcome first.');
        }

        const [buyPrice, sellPrice] = await Promise.all([
            getExecutablePrice(tokenId, 'BUY'),
            getExecutablePrice(tokenId, 'SELL'),
        ]);

        const spread = buyPrice != null && sellPrice != null
            ? Number((sellPrice - buyPrice).toFixed(4))
            : null;

        return {
            source: 'Polymarket CLOB',
            token_id: tokenId,
            buy_price: buyPrice,
            sell_price: sellPrice,
            spread,
            estimated_buy_shares: args.amount_usd && buyPrice
                ? Number((args.amount_usd / buyPrice).toFixed(4))
                : null,
            estimated_sell_value: args.shares && sellPrice != null
                ? Number((args.shares * sellPrice).toFixed(4))
                : null,
            note: 'Use buy_price for BUY orders and sell_price for SELL/close orders. These come from the live CLOB price endpoint, not from the raw order book top row.',
        };
    },
    permissions: 'public'
};

export const PreparePolymarketBetTool: Tool = {
    definition: {
        name: 'prepare_polymarket_bet',
        description: 'Prepare an execution-ready Polymarket bet bundle for a selected outcome. Use this when the user has already picked a market or says "I want this", "buy this", or "take this one". It returns live executable prices, estimated shares, and, when user auth context is available, trading readiness and concrete next steps. Prefer this over repeating discovery tools once a specific token_id is known.',
        parameters: {
            type: 'object',
            properties: {
                token_id: {
                    type: 'string',
                    description: 'Exact selected outcome token ID.'
                },
                question: {
                    type: 'string',
                    description: 'Selected market question.'
                },
                outcome: {
                    type: 'string',
                    description: 'Selected outcome name, such as Yes, No, Up, or Down.'
                },
                amount_usd: {
                    type: 'number',
                    description: 'Optional intended buy amount in USD for share estimation.'
                },
                event_id: {
                    type: 'string',
                    description: 'Optional Polymarket event ID to enrich the response with sibling markets and metadata.'
                }
            },
            required: ['token_id', 'question', 'outcome']
        }
    },
    handler: async (args: {
        token_id: string;
        question: string;
        outcome: string;
        amount_usd?: number;
        event_id?: string;
    }, context) => {
        const tokenId = String(args.token_id || '').trim();
        if (!tokenId) {
            throw new Error('token_id is required');
        }

        const [buyPrice, sellPrice, event] = await Promise.all([
            getExecutablePrice(tokenId, 'BUY'),
            getExecutablePrice(tokenId, 'SELL'),
            args.event_id ? getEventDetails(String(args.event_id)) : Promise.resolve(null)
        ]);

        let readiness: Awaited<ReturnType<typeof checkTradingReadiness>> | null = null;
        const userId = String(context?.userId || '').trim();
        if (userId) {
            try {
                readiness = await checkTradingReadiness(userId);
            } catch {
                readiness = null;
            }
        }

        const estimatedBuyShares = args.amount_usd && buyPrice
            ? Number((args.amount_usd / buyPrice).toFixed(4))
            : null;

        const siblingMarkets = event?.markets
            ?.filter((market) => market.question !== args.question)
            .slice(0, 3)
            .map((market) => ({
                id: market.id,
                question: market.question,
                accepting_orders: market.acceptingOrders,
                best_bid: market.bestBid,
                best_ask: market.bestAsk,
            })) || [];

        const nextStep = readiness == null
            ? 'If you want to place this bet next, check readiness or place the order directly if the account is already prepared.'
            : readiness.isReady
                ? 'Account looks ready. You can place the order with the selected token_id and your amount.'
                : readiness.conversionRequired
                    ? 'Convert Polygon native USDC to Polymarket USDC.e, then check readiness again.'
                    : readiness.missingSteps[0] || 'Complete readiness setup before placing the order.';

        return {
            source: 'Polymarket Bet Prep',
            selection: {
                question: args.question,
                outcome: args.outcome,
                token_id: tokenId,
                amount_usd: args.amount_usd ?? null,
            },
            live_quote: {
                buy_price: buyPrice,
                sell_price: sellPrice,
                estimated_buy_shares: estimatedBuyShares,
            },
            readiness: readiness
                ? {
                    ready: readiness.isReady,
                    wallet_address: readiness.walletAddress,
                    usdc_balance: readiness.usdcBalance,
                    native_usdc_balance: readiness.nativeUsdcBalance,
                    conversion_required: readiness.conversionRequired,
                    missing_steps: readiness.missingSteps,
                }
                : null,
            sibling_markets: siblingMarkets,
            next_step: nextStep,
            note: 'Use this tool after market selection to move from discovery into a concrete bet-preparation bundle. Do not stop at only listing markets if the user has already chosen one.',
        };
    },
    permissions: 'public'
};

/**
 * Polymarket Prediction Market Tools
 * 
 * Provides AI access to Polymarket prediction market data.
 */
import { Tool } from '../../../tooling/registry.js';
import {
    getTrendingEvents,
    getTrendingMarkets,
    getEventDetails,
    searchEvents
} from '../../../services/polymarket.js';

function formatDateLabel(value?: string | null): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 10) : null;
}

/**
 * Get Polymarket Trending Events Tool (Ranked by 24h volume)
 */
export const GetPolymarketTrendingTool: Tool = {
    definition: {
        name: 'get_polymarket_trending',
        description: 'Get trending prediction market events (groups of related questions) from Polymarket, sorted by 24h volume. Use this for general betting trends.',
        parameters: {
            type: 'object',
            properties: {
                limit: {
                    type: 'number',
                    description: 'Number of events to return (1-20). Default is 10.'
                }
            },
            required: []
        }
    },
    handler: async (args: { limit?: number }) => {
        const limit = Math.min(args.limit || 10, 20);
        const result = await getTrendingEvents(limit);

        return {
            source: 'Polymarket',
            type: 'Trending Events',
            count: result.events.length,
            events: result.events.map(e => ({
                id: e.id,
                title: e.title,
                vol24h: `$${e.volume.toLocaleString()}`,
                liquidity: `$${e.liquidity.toLocaleString()}`,
                endDate: formatDateLabel(e.endDate)
            })),
            note: 'Use get_polymarket_event with an event ID to see specific market odds.'
        };
    },
    permissions: 'public'
};

/**
 * Get Polymarket Trending Markets Tool (Individual Questions)
 */
export const GetPolymarketTrendingMarketsTool: Tool = {
    definition: {
        name: 'get_polymarket_trending_markets',
        description: 'Get specific trending prediction questions sorted by 24h volume. Use this for overall hot markets by volume/liquidity. Do not use it alone when the user is asking for newest markets, today-only short-window markets, or "next few minutes" markets; pair with get_new_markets and current time when recency matters. Returns outcome names and outcome token IDs needed for trading.',
        parameters: {
            type: 'object',
            properties: {
                limit: {
                    type: 'number',
                    description: 'Number of markets to return (1-20). Default is 10.'
                }
            },
            required: []
        }
    },
    handler: async (args: { limit?: number }) => {
        const limit = Math.min(args.limit || 10, 20);
        const result = await getTrendingMarkets(limit);

        return {
            source: 'Polymarket',
            type: 'Trending Questions',
            count: result.markets.length,
            questions: result.markets.map(m => ({
                id: m.id,
                slug: m.slug,
                condition_id: m.conditionId,
                question: m.question,
                yes: m.yesProbability,
                no: m.noProbability,
                vol24h: `$${Math.floor(m.volume24hr).toLocaleString()}`,
                liquidity: `$${m.liquidity.toLocaleString()}`,
                endDate: formatDateLabel(m.endDate),
                accepting_orders: m.acceptingOrders,
                best_bid: m.bestBid,
                best_ask: m.bestAsk,
                tick_size: m.tickSize,
                neg_risk: m.negRisk,
                enable_order_book: m.enableOrderBook,
                outcomes: m.outcomes.map(o => ({
                    name: o.name,
                    probability: o.probability,
                    token_id: o.tokenId
                }))
            }))
        };
    },
    permissions: 'public'
};

/**
 * Get Polymarket Event Details Tool
 */
export const GetPolymarketEventTool: Tool = {
    definition: {
        name: 'get_polymarket_event',
        description: 'Get all specific prediction questions and their current probabilities for a Polymarket event. Returns outcome names and token IDs required for downstream trade execution.',
        parameters: {
            type: 'object',
            properties: {
                event_id: {
                    type: 'string',
                    description: 'The Polymarket event ID.'
                }
            },
            required: ['event_id']
        }
    },
    handler: async (args: { event_id: string }) => {
        const event = await getEventDetails(args.event_id);

        return {
            source: 'Polymarket',
            title: event.title,
            description: event.description.slice(0, 500),
            totalVolume: `$${event.volume.toLocaleString()}`,
            liquidity: `$${event.liquidity.toLocaleString()}`,
            endDate: formatDateLabel(event.endDate),
            markets: event.markets.map(m => ({
                id: m.id,
                slug: m.slug,
                condition_id: m.conditionId,
                question: m.question,
                yes: m.yesProbability,
                no: m.noProbability,
                vol24h: `$${Math.floor(m.volume24hr).toLocaleString()}`,
                accepting_orders: m.acceptingOrders,
                best_bid: m.bestBid,
                best_ask: m.bestAsk,
                tick_size: m.tickSize,
                neg_risk: m.negRisk,
                enable_order_book: m.enableOrderBook,
                outcomes: m.outcomes.map(o => ({
                    name: o.name,
                    probability: o.probability,
                    token_id: o.tokenId
                }))
            }))
        };
    },
    permissions: 'public'
};

/**
 * Search Polymarket Events Tool
 */
export const SearchPolymarketTool: Tool = {
    definition: {
        name: 'search_polymarket',
        description: 'Search Polymarket for prediction events by keyword (e.g., "Trump", "Bitcoin", "Fed"). Returns events related to the topic.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search keyword.'
                },
                limit: {
                    type: 'number',
                    description: 'Number of results (1-20).'
                }
            },
            required: ['query']
        }
    },
    handler: async (args: { query: string; limit?: number }) => {
        const limit = Math.min(args.limit || 10, 20);
        const result = await searchEvents(args.query, limit);
        const query = String(args.query || '').trim();
        const queryTerms = query
            .toLowerCase()
            .split(/[^a-z0-9$]+/i)
            .map(t => t.trim())
            .filter(t => t.length >= 3);

        const mapped = result.events.map(e => ({
            id: e.id,
            title: e.title,
            vol24h: `$${e.volume.toLocaleString()}`,
            endDate: formatDateLabel(e.endDate)
        }));

        const related = queryTerms.length === 0
            ? mapped
            : mapped.filter((e) => {
                const title = String(e.title || '').toLowerCase();
                return queryTerms.some(term => title.includes(term));
            });

        if (mapped.length === 0 || related.length === 0) {
            return {
                source: 'Polymarket',
                query,
                exactMatch: false,
                results: [],
                events: [],
                count: 0,
                suggestion: 'No markets found matching your query. The market may not exist on Polymarket.'
            };
        }

        const exactMatch = related.some(e => String(e.title || '').toLowerCase() === query.toLowerCase());

        return {
            source: 'Polymarket',
            query,
            exactMatch,
            count: related.length,
            results: related,
            events: related,
            note: exactMatch
                ? 'Use get_polymarket_event with an ID to see detailed odds.'
                : 'No exact title match found. You can refine the query or provide a market link.'
        };
    },
    permissions: 'public'
};

export const __testables = {
    formatDateLabel
};

/**
* Get New Polymarket Markets Tool
*/
export const GetNewMarketsTool: Tool = {
    definition: {
        name: 'get_new_markets',
        description: 'Get newly created prediction markets. Use this when the user asks "what is new", "newest", "today", "just opened", "next 5 minutes", or other recency-sensitive questions. This is the right companion to get_polymarket_trending_markets when "hot" could mean newly opened rather than high 24h volume. The service prioritizes the next-starting short-window market over a near-expiry market when both are visible. Returns market IDs plus outcome token IDs when available.',
        parameters: {
            type: 'object',
            properties: {
                limit: {
                    type: 'number',
                    description: 'Number of markets to return (1-20). Default is 10.'
                }
            },
            required: []
        }
    },
    handler: async (args: { limit?: number }) => {
        const limit = Math.min(args.limit || 10, 20);
        const result = await import('../../../services/polymarket.js').then(m => m.getNewMarkets(limit));

        return {
            source: 'Polymarket',
            type: 'Newest Events',
            count: result.events.length,
            sort_mode: 'next_starting_window_first',
            events: result.events.map(e => ({
                id: e.id,
                title: e.title,
                createdAt: new Date(e.creationDate).toLocaleDateString(),
                liquidity: `$${e.liquidity.toLocaleString()}`,
                recommended_window: e.recommendedWindow ? {
                    start_at: e.recommendedWindow.startAt,
                    end_at: e.recommendedWindow.endAt,
                    status: e.recommendedWindow.status,
                    seconds_to_start: e.recommendedWindow.secondsToStart,
                    seconds_to_end: e.recommendedWindow.secondsToEnd,
                    duration_minutes: e.recommendedWindow.durationMinutes,
                } : null,
                markets: e.markets.map(m => ({
                    id: m.id,
                    slug: m.slug,
                    condition_id: m.conditionId,
                    question: m.question,
                    accepting_orders: m.acceptingOrders,
                    best_bid: m.bestBid,
                    best_ask: m.bestAsk,
                    tick_size: m.tickSize,
                    neg_risk: m.negRisk,
                    enable_order_book: m.enableOrderBook,
                    outcomes: m.outcomes.map(o => ({
                        name: o.name,
                        probability: o.probability,
                        token_id: o.tokenId
                    }))
                }))
            }))
        };
    },
    permissions: 'public'
};

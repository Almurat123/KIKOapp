/**
 * Polymarket Prediction Market Tools
 * 
 * Provides AI access to Polymarket prediction market data.
 */
import { Tool } from '../../../tooling/registry.js';
import type { RenderContract } from '../../../jobs/chat/contracts.js';
import {
    getTrendingEvents,
    getTrendingMarkets,
    getEventDetails,
    searchEvents,
    getNewMarkets,
    getCoinUpDownMarkets,
} from '../../../services/polymarket.js';
import { chatWS } from '../../../services/chatWebSocket.js';

function formatDateLabel(value?: string | null): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 10) : null;
}

function formatEtTimestamp(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(date);
}

function formatUsd(value: number): string {
    return `$${Math.floor(value || 0).toLocaleString()}`;
}

function mapTrendingEvent(event: Awaited<ReturnType<typeof getTrendingEvents>>['events'][number]) {
    return {
        id: event.id,
        title: event.title,
        vol24h: formatUsd(event.volume),
        liquidity: formatUsd(event.liquidity),
        endDate: formatDateLabel(event.endDate),
    };
}

function mapTrendingMarket(market: Awaited<ReturnType<typeof getTrendingMarkets>>['markets'][number]) {
    return {
        id: market.id,
        slug: market.slug,
        condition_id: market.conditionId,
        question: market.question,
        yes: market.yesProbability,
        no: market.noProbability,
        vol24h: formatUsd(Math.floor(market.volume24hr || 0)),
        liquidity: formatUsd(market.liquidity),
        endDate: formatDateLabel(market.endDate),
        accepting_orders: market.acceptingOrders,
        best_bid: market.bestBid,
        best_ask: market.bestAsk,
        tick_size: market.tickSize,
        neg_risk: market.negRisk,
        enable_order_book: market.enableOrderBook,
        outcomes: market.outcomes.map((outcome) => ({
            name: outcome.name,
            probability: outcome.probability,
            token_id: outcome.tokenId,
        })),
    };
}

function mapNewMarketEvent(event: Awaited<ReturnType<typeof getNewMarkets>>['events'][number]) {
    return {
        id: event.id,
        title: event.title,
        createdAt: new Date(event.creationDate).toLocaleDateString(),
        vol24h: formatUsd(event.volume),
        liquidity: formatUsd(event.liquidity),
        liquidity_value: event.liquidity,
        tradable: event.tradable,
        recommendable: event.recommendable,
        recommendable_detail: event.recommendable_detail,
        tradable_detail: event.tradable_detail,
        recommended_window: event.recommendedWindow ? {
            start_at: event.recommendedWindow.startAt,
            end_at: event.recommendedWindow.endAt,
            status: event.recommendedWindow.status,
            seconds_to_start: event.recommendedWindow.secondsToStart,
            seconds_to_end: event.recommendedWindow.secondsToEnd,
            duration_minutes: event.recommendedWindow.durationMinutes,
        } : null,
        markets: event.markets.map((market) => ({
            id: market.id,
            slug: market.slug,
            condition_id: market.conditionId,
            question: market.question,
            accepting_orders: market.acceptingOrders,
            best_bid: market.bestBid,
            best_ask: market.bestAsk,
            tick_size: market.tickSize,
            neg_risk: market.negRisk,
            enable_order_book: market.enableOrderBook,
            outcomes: market.outcomes.map((outcome) => ({
                name: outcome.name,
                probability: outcome.probability,
                token_id: outcome.tokenId,
            })),
        })),
    };
}

function buildPolymarketListRenderContract(params: {
    id: string;
    title: string;
    summary?: string;
    columns: Array<{ key: string; label: string; valueType?: 'text' | 'number' | 'datetime' }>;
    rows: Array<Record<string, string | number | null>>;
}): RenderContract {
    return {
        id: params.id,
        renderMode: 'table',
        title: params.title,
        summary: params.summary,
        columns: params.columns,
        rows: params.rows,
        rowCount: params.rows.length,
    };
}

function pickMarketSlugFromNewMarketEvent(event: ReturnType<typeof mapNewMarketEvent>): string | null {
    for (const market of event.markets) {
        if (market.slug) return market.slug;
    }
    return null;
}

function selectOverviewCardCandidate(params: {
    hotMarkets: ReturnType<typeof mapTrendingMarket>[];
    newestMarkets: ReturnType<typeof mapNewMarketEvent>[];
    tradableNow: ReturnType<typeof mapNewMarketEvent>[];
}) {
    const tradableCandidate = params.tradableNow[0];
    const tradableSlug = tradableCandidate ? pickMarketSlugFromNewMarketEvent(tradableCandidate) : null;
    if (tradableSlug) {
        return {
            market_slug: tradableSlug,
            title: tradableCandidate?.title || null,
            source_bucket: 'tradable_now',
            reason: 'best immediate execution candidate',
        };
    }

    const newestCandidate = params.newestMarkets.find((event) => event.recommendable && pickMarketSlugFromNewMarketEvent(event));
    const newestSlug = newestCandidate ? pickMarketSlugFromNewMarketEvent(newestCandidate) : null;
    if (newestSlug) {
        return {
            market_slug: newestSlug,
            title: newestCandidate?.title || null,
            source_bucket: 'newest_short_window',
            reason: 'next near-term short-window market',
        };
    }

    const hotCandidate = params.hotMarkets.find((market) => Boolean(market.slug));
    if (hotCandidate?.slug) {
        return {
            market_slug: hotCandidate.slug,
            title: hotCandidate.question || null,
            source_bucket: 'hot_24h_markets',
            reason: 'broad hot market fallback',
        };
    }

    return null;
}

function selectHotMarketPreviewCandidate(hotMarkets: Array<{ slug?: string | null; question?: string | null }>) {
    const hotCandidate = hotMarkets.find((market) => Boolean(market.slug));
    if (!hotCandidate?.slug) return null;
    return {
        market_slug: hotCandidate.slug,
        title: hotCandidate.question || null,
        source_bucket: 'hot_24h_markets',
        reason: 'early hot-market preview',
    };
}

function selectNewMarketPreviewCandidate(events: Awaited<ReturnType<typeof getNewMarkets>>['events']) {
    const newestMarkets = events.slice(0, 10).map(mapNewMarketEvent);
    const tradableNow = newestMarkets
        .filter((market) => market.tradable)
        .sort((a, b) => (b.liquidity_value || 0) - (a.liquidity_value || 0))
        .slice(0, 5);
    return selectOverviewCardCandidate({
        hotMarkets: [],
        newestMarkets,
        tradableNow,
    });
}

function broadcastPolymarketCardPreview(
    context: Record<string, any> | undefined,
    candidate: { market_slug: string; title?: string | null; source_bucket?: string; reason?: string } | null,
) {
    const userId = String(context?.userId || '').trim();
    const sessionId = String(context?.sessionId || '').trim();
    const assistantMessageId = String(context?.assistantMessageId || '').trim();
    if (!userId || !sessionId || !assistantMessageId || !candidate?.market_slug) return;

    chatWS.broadcastToUser(userId, {
        type: 'client_action',
        sessionId,
        data: {
            message_id: assistantMessageId,
            targetMessageId: assistantMessageId,
            action: {
                type: 'show_polymarket_card',
                data: {
                    market_slug: candidate.market_slug,
                    title: candidate.title || undefined,
                    source_bucket: candidate.source_bucket,
                    preview: true,
                    reason: candidate.reason,
                },
            },
        },
    });
}

export function buildPolymarketMarketOverview(params: {
    now?: Date;
    trendingEvents: Awaited<ReturnType<typeof getTrendingEvents>>;
    trendingMarkets: Awaited<ReturnType<typeof getTrendingMarkets>>;
    newMarkets: Awaited<ReturnType<typeof getNewMarkets>>;
    eventLimit?: number;
    marketLimit?: number;
    newMarketLimit?: number;
    tradableLimit?: number;
}) {
    const now = params.now || new Date();
    const eventLimit = Math.min(params.eventLimit || 5, 10);
    const marketLimit = Math.min(params.marketLimit || 5, 10);
    const newMarketLimit = Math.min(params.newMarketLimit || 10, 20);
    const tradableLimit = Math.min(params.tradableLimit || 5, 10);

    const hotEvents = params.trendingEvents.events.slice(0, eventLimit).map(mapTrendingEvent);
    const hotMarkets = params.trendingMarkets.markets.slice(0, marketLimit).map(mapTrendingMarket);
    const newestMarkets = params.newMarkets.events.slice(0, newMarketLimit).map(mapNewMarketEvent);
    const tradableNow = newestMarkets
        .filter((market) => market.tradable)
        .sort((a, b) => (b.liquidity_value || 0) - (a.liquidity_value || 0))
        .slice(0, tradableLimit);
    const recommendedCard = selectOverviewCardCandidate({
        hotMarkets,
        newestMarkets,
        tradableNow,
    });

    return {
        source: 'Polymarket',
        type: 'Market Overview',
        current_time_et: formatEtTimestamp(now),
        selection_note: params.newMarkets.selectionNote,
        response_contract: {
            grouped_buckets_required: true,
            minimum_buckets_to_show: 2,
            do_not_collapse_to_single_market: true,
        },
        recommended_card: recommendedCard,
        buckets: {
            hot_24h_events: {
                count: hotEvents.length,
                events: hotEvents,
            },
            hot_24h_markets: {
                count: hotMarkets.length,
                markets: hotMarkets,
            },
            newest_short_window: {
                count: newestMarkets.length,
                tradable_window_count: params.newMarkets.tradableWindowCount,
                recommendable_window_count: params.newMarkets.recommendableWindowCount,
                eligible_window_count: params.newMarkets.eligibleWindowCount,
                sort_mode: params.newMarkets.recommendableWindowCount > 0
                    ? 'near_term_windows_first'
                    : params.newMarkets.tradableWindowCount > 0
                        ? 'tradable_windows_first'
                        : 'discovery_only_no_tradable_windows',
                events: newestMarkets,
            },
            tradable_now: {
                count: tradableNow.length,
                markets: tradableNow,
            },
        },
        guidance: 'Use hot_24h_markets for broad volume trends, newest_short_window for the next short-window opportunities, and tradable_now for the best immediate execution candidates. Do not collapse this into a single ranking unless the user explicitly asks for one. If recommended_card is present, show that card to the user.',
    };
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
        description: 'Get specific trending prediction questions sorted by 24h volume. Use this for hot markets by volume/liquidity when the user explicitly wants that slice. For broad discovery ("what bets do you have?", "trending bets", "hot bets"), prefer get_polymarket_market_overview first. Do not use this alone when the user is asking for newest markets, today-only short-window markets, or "next few minutes" markets; pair with get_new_markets and current time when recency matters. Returns outcome names and outcome token IDs needed for trading.',
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
        const limit = Math.min(args.limit || 20, 50);
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

/**
 * Get Polymarket 5-minute Coin Up/Down Markets Tool
 */
export const GetPolymarketCoinUpDownMarketsTool: Tool = {
    definition: {
        name: 'get_polymarket_coin_updown_markets',
        description: 'Find exact 5-minute token Up/Down markets near the current ET time. Use this for requests like "5min coin bet", "token up or down", "5-minute Solana market", or "current 5m crypto market". This tool performs exact ET-window discovery and should be preferred over get_new_markets for coin-specific 5-minute markets.',
        parameters: {
            type: 'object',
            properties: {
                coin: {
                    type: 'string',
                    description: 'Optional coin series such as Bitcoin, Ethereum, Solana, Dogecoin, XRP, BNB, or Hyperliquid.'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of exact-window markets to return (1-20). Default is 10.'
                },
                windows_ahead: {
                    type: 'number',
                    description: 'How many 5-minute windows ahead to probe from the current ET window (1-12). Default is 8 for a specific coin or 3 for broad coin discovery.'
                }
            },
            required: []
        }
    },
    handler: async (args: { coin?: string; limit?: number; windows_ahead?: number }) => {
        const result = await getCoinUpDownMarkets({
            coin: args.coin,
            limit: args.limit,
            windowsAhead: args.windows_ahead,
        });

        const recommended = result.markets[0] || null;
        const renderContract = buildPolymarketListRenderContract({
            id: 'polymarket_coin_updown_markets',
            title: '5-minute coin markets',
            summary: result.note,
            columns: [
                { key: 'title', label: 'Market' },
                { key: 'tradable', label: 'Tradable' },
                { key: 'tradable_detail', label: 'Status' },
                { key: 'slug', label: 'Slug' },
            ],
            rows: result.markets.flatMap((market) => {
                if (!market) return [];
                return [{
                    title: market.title,
                    tradable: market.tradable ? 'yes' : 'no',
                    tradable_detail: market.tradable_detail || '',
                    slug: market.slug || '',
                }];
            }),
        });
        return {
            source: 'Polymarket',
            type: 'Coin Up/Down 5-minute Markets',
            current_time_et: result.currentTimeEt,
            series: result.series,
            count: result.count,
            note: result.note,
            recommended_market: recommended ? {
                id: recommended.id,
                title: recommended.title,
                slug: recommended.slug,
                tradable: recommended.tradable,
                tradable_detail: recommended.tradable_detail,
                window: recommended.window,
            } : null,
            markets: result.markets,
            renderContract,
        };
    },
    permissions: 'public'
};

export const __testables = {
    formatDateLabel,
    formatEtTimestamp,
    formatUsd,
    mapTrendingEvent,
    mapTrendingMarket,
    mapNewMarketEvent,
    buildPolymarketMarketOverview,
};

/**
 * Get Polymarket Market Overview Tool
 */
export const GetPolymarketMarketOverviewTool: Tool = {
    definition: {
        name: 'get_polymarket_market_overview',
        description: 'Get a broad Polymarket overview for questions like "what bets do you have?", "what is trending?", or "hot bets right now". This is the default discovery tool for broad requests because it returns grouped buckets: 24h hot events, 24h hot markets, newest short-window markets, and tradable-now candidates. Use it before narrower tools unless the user explicitly asks for only one slice.',
        parameters: {
            type: 'object',
            properties: {
                event_limit: {
                    type: 'number',
                    description: 'Number of hot 24h events to return (1-10). Default is 5.'
                },
                market_limit: {
                    type: 'number',
                    description: 'Number of hot 24h markets to return (1-10). Default is 5.'
                },
                new_market_limit: {
                    type: 'number',
                    description: 'Number of newest markets to return (1-20). Default is 10.'
                },
                tradable_limit: {
                    type: 'number',
                    description: 'Number of tradable-now short-window markets to return (1-10). Default is 5.'
                }
            },
            required: []
        }
    },
    handler: async (args: {
        event_limit?: number;
        market_limit?: number;
        new_market_limit?: number;
        tradable_limit?: number;
    }, context?: Record<string, any>) => {
        const eventLimit = Math.min(args.event_limit || 5, 10);
        const marketLimit = Math.min(args.market_limit || 5, 10);
        const newMarketLimit = Math.min(args.new_market_limit || 10, 20);
        const tradableLimit = Math.min(args.tradable_limit || 5, 10);

        const trendingEventsPromise = getTrendingEvents(eventLimit);
        const trendingMarketsPromise = getTrendingMarkets(marketLimit);
        const newMarketsPromise = getNewMarkets(newMarketLimit);

        const previewCandidate = await Promise.any([
            trendingMarketsPromise.then((result) => selectHotMarketPreviewCandidate(result.markets.slice(0, marketLimit))),
            newMarketsPromise.then((result) => selectNewMarketPreviewCandidate(result.events)),
        ].map((promise) => promise.then((candidate) => {
            if (!candidate?.market_slug) {
                throw new Error('no_preview_candidate');
            }
            return candidate;
        }))).catch(() => null);

        broadcastPolymarketCardPreview(context, previewCandidate);

        const [trendingEvents, trendingMarkets, newMarkets] = await Promise.all([
            trendingEventsPromise,
            trendingMarketsPromise,
            newMarketsPromise,
        ]);

        const overview = buildPolymarketMarketOverview({
            trendingEvents,
            trendingMarkets,
            newMarkets,
            eventLimit,
            marketLimit,
            newMarketLimit,
            tradableLimit,
        });

        if (overview.recommended_card?.market_slug) {
            return {
                ...overview,
                renderContract: buildPolymarketListRenderContract({
                    id: 'polymarket_market_overview',
                    title: 'Polymarket overview',
                    summary: overview.guidance,
                    columns: [
                        { key: 'bucket', label: 'Bucket' },
                        { key: 'title', label: 'Title' },
                        { key: 'vol24h', label: '24h Volume' },
                        { key: 'liquidity', label: 'Liquidity' },
                    ],
                    rows: [
                        ...overview.buckets.hot_24h_markets.markets.map((market) => ({
                            bucket: 'hot_24h',
                            title: market.question,
                            vol24h: market.vol24h,
                            liquidity: market.liquidity,
                        })),
                        ...overview.buckets.tradable_now.markets.map((market) => ({
                            bucket: 'tradable_now',
                            title: market.title,
                            vol24h: market.vol24h,
                            liquidity: market.liquidity,
                        })),
                    ],
                }),
                __client_action: {
                    type: 'show_polymarket_card',
                    data: {
                        market_slug: overview.recommended_card.market_slug,
                    },
                },
            };
        }

        return {
            ...overview,
            renderContract: buildPolymarketListRenderContract({
                id: 'polymarket_market_overview',
                title: 'Polymarket overview',
                summary: overview.guidance,
                columns: [
                    { key: 'bucket', label: 'Bucket' },
                    { key: 'title', label: 'Title' },
                    { key: 'vol24h', label: '24h Volume' },
                    { key: 'liquidity', label: 'Liquidity' },
                ],
                rows: [
                    ...overview.buckets.hot_24h_markets.markets.map((market) => ({
                        bucket: 'hot_24h',
                        title: market.question,
                        vol24h: market.vol24h,
                        liquidity: market.liquidity,
                    })),
                    ...overview.buckets.tradable_now.markets.map((market) => ({
                        bucket: 'tradable_now',
                        title: market.title,
                        vol24h: market.vol24h,
                        liquidity: market.liquidity,
                    })),
                ],
            }),
        };
    },
    permissions: 'public'
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
        const limit = Math.min(args.limit || 30, 50);
        const result = await getNewMarkets(limit);

        const noTradableWindows = result.tradableWindowCount === 0;
        return {
            source: 'Polymarket',
            type: 'Newest Events',
            count: result.events.length,
            tradable_window_count: result.tradableWindowCount,
            recommendable_window_count: result.recommendableWindowCount,
            eligible_window_count: result.eligibleWindowCount,
            sort_mode: result.recommendableWindowCount > 0
                ? 'near_term_windows_first'
                : noTradableWindows
                    ? 'discovery_only_no_tradable_windows'
                    : 'tradable_windows_first',
            selection_note: result.selectionNote,
            events: result.events.map(e => ({
                id: e.id,
                title: e.title,
                createdAt: new Date(e.creationDate).toLocaleDateString(),
                liquidity: `$${e.liquidity.toLocaleString()}`,
                tradable: e.tradable,
                recommendable: e.recommendable,
                recommendable_detail: e.recommendable_detail,
                tradable_detail: e.tradable_detail,
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

/**
 * Show Polymarket Embed Card Tool
 */
export const ShowPolymarketCardTool: Tool = {
    definition: {
        name: 'show_polymarket_card',
        description: 'Show an interactive Polymarket live market card in the chat. Use this when you want to provide a real-time visual representation of a market as part of your recommendation.',
        parameters: {
            type: 'object',
            properties: {
                slug: {
                    type: 'string',
                    description: 'The Polymarket market slug (e.g., "btc-updown-5m-1774349700").'
                }
            },
            required: ['slug']
        }
    },
    handler: async (args: { slug: string }) => {
        return {
            __client_action: {
                type: 'show_polymarket_card',
                data: {
                    market_slug: args.slug
                }
            }
        };
    },
    permissions: 'public'
};

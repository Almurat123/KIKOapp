/**
 * Polymarket Prediction Market Service
 * Read-only access to prediction market data
 */

import * as unifiedApiService from '../config/unifiedApiService.js';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

interface PolymarketEvent {
    id: string;
    title: string;
    slug: string;
    description?: string;
    volume: number;
    liquidity: number;
    startDate: string;
    endDate: string;
    markets?: PolymarketMarket[];
}

interface PolymarketMarket {
    id: string;
    question: string;
    outcomes?: string; // JSON string: ["Yes", "No"] or ["Up", "Down"]
    clobTokenIds?: string; // JSON string aligned to outcomes
    outcomePrices: string; // JSON string: ["0.65", "0.35"]
    volume: string;
    volume24hr: number | null;
    liquidity: string;
    endDate: string;
    closed: boolean;
    acceptingOrders?: boolean;
    bestBid?: number;
    bestAsk?: number;
}

interface ParsedOutcome {
    name: string;
    price: number;
    probability: string;
    tokenId: string | null;
}

interface ParsedMarket {
    id: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    yesProbability: string; // "65%"
    noProbability: string;  // "35%"
    volume24hr: number;
    liquidity: number;
    endDate: string;
    closed: boolean;
    acceptingOrders: boolean;
    bestBid: number | null;
    bestAsk: number | null;
    outcomes: ParsedOutcome[];
}

function parseStringArray(raw?: string): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
        return [];
    }
}

/**
 * Format probability as percentage string
 */
function formatProbability(price: number): string {
    return `${(price * 100).toFixed(1)}%`;
}

function parseMarket(market: PolymarketMarket): ParsedMarket {
    const prices = parseStringArray(market.outcomePrices).map((value) => parseFloat(value) || 0);
    const outcomes = parseStringArray(market.outcomes);
    const clobTokenIds = parseStringArray(market.clobTokenIds);
    const yes = prices[0] || 0;
    const no = prices[1] || 0;

    const parsedOutcomes: ParsedOutcome[] = prices.map((price, index) => ({
        name: outcomes[index] || `Outcome ${index + 1}`,
        price,
        probability: formatProbability(price),
        tokenId: clobTokenIds[index] || null
    }));

    return {
        id: market.id,
        question: market.question,
        yesPrice: yes,
        noPrice: no,
        yesProbability: formatProbability(yes),
        noProbability: formatProbability(no),
        volume24hr: market.volume24hr || 0,
        liquidity: parseFloat(market.liquidity) || 0,
        endDate: market.endDate,
        closed: market.closed,
        acceptingOrders: Boolean(market.acceptingOrders),
        bestBid: typeof market.bestBid === 'number' ? market.bestBid : null,
        bestAsk: typeof market.bestAsk === 'number' ? market.bestAsk : null,
        outcomes: parsedOutcomes
    };
}

export const __testables = {
    parseMarket
};

/**
 * Get trending prediction events (sorted by 24h volume)
 */
export async function getTrendingEvents(limit: number = 10): Promise<{
    events: Array<{
        id: string;
        title: string;
        volume: number;
        liquidity: number;
        endDate: string;
    }>;
}> {
    const url = `${GAMMA_API_BASE}/events?limit=${limit}&active=true&closed=false&order=volume24hr&ascending=false`;

    // # [Logic]: Fetch trending events via Unified Transport
    // # [Ref]: "The Polymarket Gamma API provides several endpoints" [Polymarket Docs]
    const data = await unifiedApiService.fetchJson<PolymarketEvent[]>({
        url,
        method: 'GET',
        requestTimeout: 10000,
        endpointName: 'polymarket-trending-events',
        retry: {
            retries: 2,
            minTimeout: 500
        }
    });

    return {
        events: data.map(event => ({
            id: event.id,
            title: event.title,
            volume: Math.floor(event.volume || 0),
            liquidity: Math.floor(event.liquidity || 0),
            endDate: event.endDate
        }))
    };
}

/**
 * Get event details with all its markets and probabilities
 */
export async function getEventDetails(eventId: string): Promise<{
    id: string;
    title: string;
    description: string;
    volume: number;
    liquidity: number;
    endDate: string;
    markets: ParsedMarket[];
}> {
    const url = `${GAMMA_API_BASE}/events/${eventId}`;

    // # [Logic]: Fetch event details
    const event = await unifiedApiService.fetchJson<PolymarketEvent>({
        url,
        method: 'GET',
        requestTimeout: 10000,
        endpointName: 'polymarket-event-details'
    });

    // Filter and parse markets
    const markets: ParsedMarket[] = (event.markets || [])
        .filter(m => !m.closed) // Only show active markets in details
        .map(parseMarket);

    return {
        id: event.id,
        title: event.title,
        description: event.description || '',
        volume: Math.floor(event.volume || 0),
        liquidity: Math.floor(event.liquidity || 0),
        endDate: event.endDate,
        markets: markets.slice(0, 10)
    };
}

/**
 * Get trending markets (individual prediction questions)
 */
export async function getTrendingMarkets(limit: number = 10): Promise<{
    markets: ParsedMarket[];
}> {
    const url = `${GAMMA_API_BASE}/markets?limit=${limit}&active=true&closed=false&order=volume24hr&ascending=false`;

    // # [Logic]: Fetch trending markets
    const data = await unifiedApiService.fetchJson<PolymarketMarket[]>({
        url,
        method: 'GET',
        requestTimeout: 10000,
        endpointName: 'polymarket-trending-markets'
    });

    const markets: ParsedMarket[] = data.map(parseMarket);

    return { markets };
}

/**
 * Search events by keyword using the dedicated public-search endpoint
 */
export async function searchEvents(query: string, limit: number = 10): Promise<{
    events: Array<{
        id: string;
        title: string;
        volume: number;
        liquidity: number;
        endDate: string;
    }>;
}> {
    // Use the optimized public-search endpoint
    const url = `${GAMMA_API_BASE}/public-search?q=${encodeURIComponent(query)}&limit=${limit}&events_status=active`;

    // # [Logic]: Search events
    const data = await unifiedApiService.fetchJson<any[]>({
        url,
        method: 'GET',
        requestTimeout: 15000,
        endpointName: 'polymarket-search'
    });

    if (!Array.isArray(data)) {
        return { events: [] };
    }

    // Extract events from search results (data is often slightly different structure)
    return {
        events: data.map(event => ({
            id: event.id.toString(),
            title: event.title,
            volume: Math.floor(event.volume || 0),
            liquidity: Math.floor(event.liquidity || 0),
            endDate: event.endDate
        }))
    };
}

/**
 * Get newly created markets
 */
export async function getNewMarkets(limit: number = 10): Promise<{
    events: Array<{
        id: string;
        title: string;
        volume: number;
        liquidity: number;
        creationDate: string;
        markets: ParsedMarket[];
    }>;
}> {
    const url = `${GAMMA_API_BASE}/events?limit=${limit}&active=true&closed=false&order=createdAt&ascending=false`;

    // # [Logic]: Fetch new markets
    const data = await unifiedApiService.fetchJson<PolymarketEvent[]>({
        url,
        method: 'GET',
        requestTimeout: 10000,
        endpointName: 'polymarket-new-markets'
    });

    return {
        events: data.map(event => ({
            id: event.id,
            title: event.title,
            volume: Math.floor(event.volume || 0),
            liquidity: Math.floor(event.liquidity || 0),
            creationDate: event.startDate, // Gamma may return startDate/creationDate/createdAt. Keep startDate as fallback display timestamp.
            markets: (event.markets || [])
                .filter((market) => !market.closed)
                .map(parseMarket)
        }))
    };
}

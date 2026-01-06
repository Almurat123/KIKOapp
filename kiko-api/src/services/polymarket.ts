/**
 * Polymarket Prediction Market Service
 * Read-only access to prediction market data
 */

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
    outcomePrices: string; // JSON string: ["0.65", "0.35"]
    volume: string;
    volume24hr: number | null;
    liquidity: string;
    endDate: string;
    closed: boolean;
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
}

/**
 * Parse outcome prices from JSON string to probabilities
 */
function parseOutcomePrices(pricesJson: string): { yes: number; no: number } {
    try {
        const prices = JSON.parse(pricesJson);
        return {
            yes: parseFloat(prices[0]) || 0,
            no: parseFloat(prices[1]) || 0
        };
    } catch {
        return { yes: 0, no: 0 };
    }
}

/**
 * Format probability as percentage string
 */
function formatProbability(price: number): string {
    return `${(price * 100).toFixed(1)}%`;
}

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

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json() as PolymarketEvent[];

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

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
    }

    const event = await response.json() as PolymarketEvent;

    // Filter and parse markets
    const markets: ParsedMarket[] = (event.markets || [])
        .filter(m => !m.closed) // Only show active markets in details
        .map(market => {
            const prices = parseOutcomePrices(market.outcomePrices);
            return {
                id: market.id,
                question: market.question,
                yesPrice: prices.yes,
                noPrice: prices.no,
                yesProbability: formatProbability(prices.yes),
                noProbability: formatProbability(prices.no),
                volume24hr: market.volume24hr || 0,
                liquidity: parseFloat(market.liquidity) || 0,
                endDate: market.endDate,
                closed: market.closed
            };
        });

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

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json() as PolymarketMarket[];

    const markets: ParsedMarket[] = data.map(market => {
        const prices = parseOutcomePrices(market.outcomePrices);
        return {
            id: market.id,
            question: market.question,
            yesPrice: prices.yes,
            noPrice: prices.no,
            yesProbability: formatProbability(prices.yes),
            noProbability: formatProbability(prices.no),
            volume24hr: market.volume24hr || 0,
            liquidity: parseFloat(market.liquidity) || 0,
            endDate: market.endDate,
            closed: market.closed
        };
    });

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

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json() as any[];

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
    }>;
}> {
    const url = `${GAMMA_API_BASE}/events?limit=${limit}&active=true&closed=false&order=createdAt&ascending=false`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json() as PolymarketEvent[];

    return {
        events: data.map(event => ({
            id: event.id,
            title: event.title,
            volume: Math.floor(event.volume || 0),
            liquidity: Math.floor(event.liquidity || 0),
            creationDate: event.startDate // "startDate" or "creationDate" - Gamma returns startDate or createdAt. Using startDate as proxy for display or just add it to interface if missing.
        }))
    };
}

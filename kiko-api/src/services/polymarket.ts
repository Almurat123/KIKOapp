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
    startDate?: string;
    endDate?: string;
    markets?: PolymarketMarket[];
}

interface PolymarketMarket {
    id: string;
    question: string;
    conditionId?: string;
    slug?: string;
    outcomes?: string; // JSON string: ["Yes", "No"] or ["Up", "Down"]
    clobTokenIds?: string; // JSON string aligned to outcomes
    outcomePrices: string; // JSON string: ["0.65", "0.35"]
    volume: string;
    volume24hr: number | null;
    liquidity: string;
    endDate?: string;
    closed: boolean;
    acceptingOrders?: boolean;
    bestBid?: number;
    bestAsk?: number;
    negRisk?: boolean;
    enableOrderBook?: boolean;
    orderPriceMinTickSize?: number;
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
    conditionId: string | null;
    slug: string | null;
    yesPrice: number;
    noPrice: number;
    yesProbability: string; // "65%"
    noProbability: string;  // "35%"
    volume24hr: number;
    liquidity: number;
    endDate: string | null;
    closed: boolean;
    acceptingOrders: boolean;
    bestBid: number | null;
    bestAsk: number | null;
    tickSize: number | null;
    negRisk: boolean;
    enableOrderBook: boolean;
    outcomes: ParsedOutcome[];
}

interface ParsedMarketWindow {
    startAt: string | null;
    endAt: string | null;
    startMs: number | null;
    endMs: number | null;
    status: 'upcoming' | 'live' | 'expired' | 'unknown';
    secondsToStart: number | null;
    secondsToEnd: number | null;
    durationMinutes: number | null;
    label: string | null;
}

const NEW_MARKET_SOON_HORIZON_SECONDS = 6 * 60 * 60;
const NEW_MARKET_MIN_LIVE_SECONDS_LEFT = 120;

const MONTH_LOOKUP: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
};

function parseStringArray(raw?: string): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
        return [];
    }
}

function normalizeDate(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function getEtParts(now: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
} {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || '0');
    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: read('hour'),
        minute: read('minute'),
        second: read('second'),
    };
}

function formatDateTimeInEt(date: Date): string {
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

function to24Hour(hour: number, meridiem: string): number {
    const normalized = meridiem.toUpperCase();
    if (normalized === 'AM') {
        return hour === 12 ? 0 : hour;
    }
    return hour === 12 ? 12 : hour + 12;
}

function convertEtLocalToUtc(params: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
}): Date {
    let utcMs = Date.UTC(
        params.year,
        params.month - 1,
        params.day,
        params.hour,
        params.minute,
        params.second || 0,
    );

    for (let i = 0; i < 3; i += 1) {
        const observed = getEtParts(new Date(utcMs));
        const desiredLocalMs = Date.UTC(
            params.year,
            params.month - 1,
            params.day,
            params.hour,
            params.minute,
            params.second || 0,
        );
        const observedLocalMs = Date.UTC(
            observed.year,
            observed.month - 1,
            observed.day,
            observed.hour,
            observed.minute,
            observed.second,
        );
        const deltaMs = desiredLocalMs - observedLocalMs;
        if (deltaMs === 0) break;
        utcMs += deltaMs;
    }

    return new Date(utcMs);
}

function parseMarketWindowLabel(question: string, now: Date = new Date()): ParsedMarketWindow | null {
    const match = String(question || '').match(
        /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{1,2}):(\d{2})(AM|PM)-(\d{1,2}):(\d{2})(AM|PM)\s*ET/i
    );
    if (!match) return null;

    const month = MONTH_LOOKUP[String(match[1] || '').toLowerCase()];
    const day = Number(match[2]);
    const startHour = to24Hour(Number(match[3]), String(match[5] || 'AM'));
    const startMinute = Number(match[4]);
    const endHour = to24Hour(Number(match[6]), String(match[8] || 'AM'));
    const endMinute = Number(match[7]);
    if (!month || !Number.isFinite(day)) return null;

    const etNow = getEtParts(now);
    const year = etNow.year;
    const start = convertEtLocalToUtc({
        year,
        month,
        day,
        hour: startHour,
        minute: startMinute,
    });
    let end = convertEtLocalToUtc({
        year,
        month,
        day,
        hour: endHour,
        minute: endMinute,
    });

    if (end.getTime() <= start.getTime()) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    const startMs = start.getTime();
    const endMs = end.getTime();
    const nowMs = now.getTime();
    const status: ParsedMarketWindow['status'] = startMs > nowMs
        ? 'upcoming'
        : endMs > nowMs
            ? 'live'
            : 'expired';

    return {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        startMs,
        endMs,
        status,
        secondsToStart: Math.max(0, Math.round((startMs - nowMs) / 1000)),
        secondsToEnd: Math.max(0, Math.round((endMs - nowMs) / 1000)),
        durationMinutes: Math.max(1, Math.round((endMs - startMs) / 60000)),
        label: `${formatDateTimeInEt(start)} -> ${formatDateTimeInEt(end)} ET`,
    };
}

function compareNewMarketPriority(a: ParsedMarketWindow | null, b: ParsedMarketWindow | null): number {
    const rank = (window: ParsedMarketWindow | null): number => {
        if (!window) return 3;
        if (window.status === 'upcoming') return 0;
        if (window.status === 'live') return 1;
        if (window.status === 'expired') return 2;
        return 3;
    };
    const aRank = rank(a);
    const bRank = rank(b);
    if (aRank !== bRank) return aRank - bRank;

    if (a?.status === 'upcoming' && b?.status === 'upcoming') {
        return Number(a.secondsToStart || 0) - Number(b.secondsToStart || 0);
    }
    if (a?.status === 'live' && b?.status === 'live') {
        return Number(b.secondsToEnd || 0) - Number(a.secondsToEnd || 0);
    }
    if (a?.status === 'expired' && b?.status === 'expired') {
        return Number(a.endMs || 0) - Number(b.endMs || 0);
    }
    return 0;
}

function isEligibleNewMarketWindow(window: ParsedMarketWindow | null): boolean {
    if (!window) return false;
    if (window.status === 'upcoming') {
        return Number(window.secondsToStart || Number.MAX_SAFE_INTEGER) <= NEW_MARKET_SOON_HORIZON_SECONDS;
    }
    if (window.status === 'live') {
        return Number(window.secondsToEnd || 0) > NEW_MARKET_MIN_LIVE_SECONDS_LEFT;
    }
    return false;
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
        conditionId: normalizeString(market.conditionId),
        slug: normalizeString(market.slug),
        yesPrice: yes,
        noPrice: no,
        yesProbability: formatProbability(yes),
        noProbability: formatProbability(no),
        volume24hr: market.volume24hr || 0,
        liquidity: parseFloat(market.liquidity) || 0,
        endDate: normalizeDate(market.endDate),
        closed: market.closed,
        acceptingOrders: Boolean(market.acceptingOrders),
        bestBid: typeof market.bestBid === 'number' ? market.bestBid : null,
        bestAsk: typeof market.bestAsk === 'number' ? market.bestAsk : null,
        tickSize: typeof market.orderPriceMinTickSize === 'number' ? market.orderPriceMinTickSize : null,
        negRisk: Boolean(market.negRisk),
        enableOrderBook: Boolean(market.enableOrderBook),
        outcomes: parsedOutcomes
    };
}

export const __testables = {
    normalizeDate,
    parseMarket,
    parseMarketWindowLabel,
    compareNewMarketPriority,
    isEligibleNewMarketWindow,
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
        endDate: string | null;
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
            endDate: normalizeDate(event.endDate)
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
    endDate: string | null;
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
        endDate: normalizeDate(event.endDate),
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
        endDate: string | null;
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
            endDate: normalizeDate(event.endDate)
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
        recommendedWindow?: ParsedMarketWindow | null;
        markets: ParsedMarket[];
    }>;
    eligibleWindowCount: number;
    selectionNote: string;
}> {
    const url = `${GAMMA_API_BASE}/events?limit=${limit}&active=true&closed=false&order=createdAt&ascending=false`;

    // # [Logic]: Fetch new markets
    const data = await unifiedApiService.fetchJson<PolymarketEvent[]>({
        url,
        method: 'GET',
        requestTimeout: 10000,
        endpointName: 'polymarket-new-markets'
    });

    const now = new Date();
    let eligibleWindowCount = 0;
    const mappedEvents = data.map((event, index) => {
        const markets = (event.markets || [])
            .filter((market) => !market.closed)
            .map(parseMarket);
        const windowCandidates = markets
            .map((market) => parseMarketWindowLabel(market.question, now))
            .filter((window): window is ParsedMarketWindow => Boolean(window));
        const eligibleWindows = windowCandidates.filter(isEligibleNewMarketWindow);
        const recommendedWindow = eligibleWindows.sort(compareNewMarketPriority)[0] || null;
        if (recommendedWindow) eligibleWindowCount += 1;
        const sortPriority = recommendedWindow ? (recommendedWindow.status === 'upcoming' ? 0 : recommendedWindow.status === 'live' ? 1 : 2) : 3;

        return {
            id: event.id,
            title: event.title,
            volume: Math.floor(event.volume || 0),
            liquidity: Math.floor(event.liquidity || 0),
            creationDate: normalizeDate(event.startDate) || '', // Gamma may omit some timestamps; keep an empty string instead of leaking undefined.
            recommendedWindow,
            markets,
            __sort: {
                priority: sortPriority,
                startMs: recommendedWindow?.startMs ?? Number.MAX_SAFE_INTEGER,
                secondsToStart: recommendedWindow?.secondsToStart ?? Number.MAX_SAFE_INTEGER,
                secondsToEnd: recommendedWindow?.secondsToEnd ?? Number.MAX_SAFE_INTEGER,
                sourceIndex: index,
            }
        };
    });

    mappedEvents.sort((a, b) => {
        if (a.__sort.priority !== b.__sort.priority) {
            return a.__sort.priority - b.__sort.priority;
        }
        if (a.__sort.priority === 0 && b.__sort.priority === 0) {
            if (a.__sort.startMs !== b.__sort.startMs) {
                return a.__sort.startMs - b.__sort.startMs;
            }
        }
        if (a.__sort.priority === 1 && b.__sort.priority === 1) {
            if (a.__sort.secondsToEnd !== b.__sort.secondsToEnd) {
                return b.__sort.secondsToEnd - a.__sort.secondsToEnd;
            }
        }
        return a.__sort.sourceIndex - b.__sort.sourceIndex;
    });

    return {
        events: mappedEvents.map(({ __sort, ...event }) => event),
        eligibleWindowCount,
        selectionNote: eligibleWindowCount > 0
            ? 'Recommended markets are limited to upcoming windows within the next 6 hours and live windows with more than 2 minutes remaining.'
            : 'No upcoming short-window market is listed within the next 6 hours, and near-expiry live windows are excluded from recommendations.'
    };
}

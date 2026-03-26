/**
 * Polymarket Prediction Market Service
 * Read-only access to prediction market data
 */

import * as unifiedApiService from '../config/unifiedApiService.js';
import { formatZonedDateTime, formatZonedDateTimeParts } from '../utils/timeFormatting.js';

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

interface CoinUpDownMarketCandidate {
    id: string;
    title: string;
    slug: string | null;
    liquidity: number;
    volume24hr: number;
    orderable: boolean;
    orderable_detail: 'ok' | 'orders_not_open' | 'no_liquidity_yet' | 'expired';
    tradable: boolean;
    tradable_detail: 'ok' | 'orders_not_open' | 'no_liquidity_yet' | 'expired';
    live: boolean;
    next_window_candidate: boolean;
    watchlist_only: boolean;
    current_time_et_strict: string;
    window: {
        start_at: string;
        end_at: string;
        start_et: string;
        end_et: string;
        status: ParsedMarketWindow['status'];
        seconds_to_start: number;
        seconds_to_end: number;
        duration_minutes: number;
    };
    market: {
        id: string;
        question: string;
        slug: string | null;
        condition_id: string | null;
        accepting_orders: boolean;
        best_bid: number | null;
        best_ask: number | null;
        outcomes: Array<{
            name: string;
            probability: string;
            token_id: string | null;
        }>;
    };
}

interface PolymarketSelectionValidation {
    matched: boolean;
    source: 'event_id' | 'search_exact' | 'none';
    eventId: string | null;
    eventTitle: string | null;
    marketId: string | null;
    marketSlug: string | null;
    conditionId: string | null;
    questionMatched: boolean;
    outcomeMatched: boolean;
    tokenMatched: boolean;
    acceptingOrders: boolean | null;
    reason: 'ok' | 'question_not_found' | 'outcome_not_found' | 'token_mismatch' | 'event_lookup_failed';
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

const NEW_MARKET_SOON_HORIZON_SECONDS = 48 * 60 * 60; // show markets up to 48h ahead so newly created windows are always visible
const NEW_MARKET_MIN_LIVE_SECONDS_LEFT = 120;
const TRADABLE_HORIZON_SECONDS = 6 * 60 * 60; // only flag as 'tradable' if within 6h
const RECOMMENDABLE_HORIZON_SECONDS = 2 * 60 * 60; // only recommend "next" short-window markets if they are within 2h
const MIN_TRADABLE_LIQUIDITY = 10; // minimum liquidity in USD to be considered tradable
const COIN_UP_DOWN_MAX_HORIZON_SECONDS = 2 * 60 * 60;
const FIVE_MINUTE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_COIN_UP_DOWN_SERIES = ['Bitcoin', 'Ethereum', 'Solana', 'Dogecoin', 'XRP', 'BNB', 'Hyperliquid'];

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

const MONTH_NAMES = [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

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

function normalizeComparableText(value: unknown): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ');
}

function getEtParts(now: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
} {
    const parts = formatZonedDateTimeParts(now, 'America/New_York');
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
    };
}

function formatDateTimeInEt(date: Date): string {
    return formatZonedDateTime(date, 'America/New_York');
}

function formatEtStrict(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatDateTimeInEt(date);
}

function formatEtTitleTime(hour24: number, minute: number): string {
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const meridiem = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(minute).padStart(2, '0')}${meridiem}`;
}

function normalizeSearchEvents(response: any): any[] {
    if (response && Array.isArray(response.events)) return response.events;
    if (response && Array.isArray(response.results)) return response.results;
    return [];
}

function normalizeCoinSeriesName(value?: string | null): string | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'btc' || normalized === 'bitcoin') return 'Bitcoin';
    if (normalized === 'eth' || normalized === 'ethereum') return 'Ethereum';
    if (normalized === 'sol' || normalized === 'solana') return 'Solana';
    if (normalized === 'doge' || normalized === 'dogecoin') return 'Dogecoin';
    if (normalized === 'xrp') return 'XRP';
    if (normalized === 'bnb') return 'BNB';
    if (normalized === 'hype' || normalized === 'hyperliquid') return 'Hyperliquid';
    return String(value).trim();
}

function getCurrentEtWindowStart(now: Date): Date {
    const etNow = getEtParts(now);
    const roundedMinute = Math.floor(etNow.minute / 5) * 5;
    return convertEtLocalToUtc({
        year: etNow.year,
        month: etNow.month,
        day: etNow.day,
        hour: etNow.hour,
        minute: roundedMinute,
        second: 0,
    });
}

function buildExactFiveMinuteWindowQuery(params: {
    coin: string;
    start: Date;
}): string {
    const end = new Date(params.start.getTime() + FIVE_MINUTE_WINDOW_MS);
    const startEt = getEtParts(params.start);
    const endEt = getEtParts(end);
    const month = MONTH_NAMES[startEt.month] || 'January';
    return `${params.coin} Up or Down - ${month} ${startEt.day}, ${formatEtTitleTime(startEt.hour, startEt.minute)}-${formatEtTitleTime(endEt.hour, endEt.minute)} ET`;
}

function buildFiveMinuteSearchQueries(now: Date, coin: string, windowCount: number): Array<{
    coin: string;
    query: string;
    start: Date;
}> {
    const base = getCurrentEtWindowStart(now);
    const queries: Array<{ coin: string; query: string; start: Date }> = [];
    for (let index = 0; index < windowCount; index += 1) {
        const start = new Date(base.getTime() + index * FIVE_MINUTE_WINDOW_MS);
        queries.push({
            coin,
            query: buildExactFiveMinuteWindowQuery({ coin, start }),
            start,
        });
    }
    return queries;
}

function isCoinUpDownSeriesEvent(event: any, requestedSeries: string[]): boolean {
    const title = normalizeComparableText(event?.title);
    if (!title.includes('up or down')) return false;
    return requestedSeries.some((series) => title.startsWith(normalizeComparableText(`${series} Up or Down -`)));
}

function isExactFiveMinuteWindow(window: ParsedMarketWindow | null): boolean {
    return Boolean(window && window.durationMinutes === 5 && window.startAt && window.endAt);
}

function mapCoinUpDownEvent(event: any, now: Date): CoinUpDownMarketCandidate | null {
    const activeMarkets: PolymarketMarket[] = Array.isArray(event?.markets)
        ? event.markets.filter((market: any) => !market?.closed)
        : [];
    const parsedMarkets: ParsedMarket[] = activeMarkets.map((market) => parseMarket(market));
    const primaryMarket = parsedMarkets[0] || null;
    const window = parseMarketWindowLabel(String(primaryMarket?.question || event?.title || ''), now);
    if (!primaryMarket || !window || !isExactFiveMinuteWindow(window)) return null;

    const liquidity = Math.floor(Number(event?.liquidity || primaryMarket.liquidity || 0));
    const withinHorizon = window.status === 'live'
        || Number(window.secondsToStart || Number.MAX_SAFE_INTEGER) <= COIN_UP_DOWN_MAX_HORIZON_SECONDS;
    if (!withinHorizon) return null;

    const acceptingOrders = Boolean((activeMarkets[0] && activeMarkets[0].acceptingOrders) ?? primaryMarket.acceptingOrders);
    const orderable = acceptingOrders && liquidity >= MIN_TRADABLE_LIQUIDITY && window.status !== 'expired';
    const orderableDetail = window.status === 'expired'
        ? 'expired'
        : !acceptingOrders
        ? 'orders_not_open'
        : liquidity < MIN_TRADABLE_LIQUIDITY
            ? 'no_liquidity_yet'
            : 'ok';

    return {
        id: String(event.id),
        title: String(event.title || primaryMarket.question),
        slug: normalizeString(event.slug) || primaryMarket.slug,
        liquidity,
        volume24hr: Math.floor(Number(event.volume24hr || primaryMarket.volume24hr || 0)),
        orderable,
        orderable_detail: orderableDetail,
        tradable: orderable,
        tradable_detail: orderableDetail,
        live: window.status === 'live',
        next_window_candidate: false,
        watchlist_only: false,
        current_time_et_strict: formatDateTimeInEt(now),
        window: {
            start_at: window.startAt!,
            end_at: window.endAt!,
            start_et: formatEtStrict(window.startAt)!,
            end_et: formatEtStrict(window.endAt)!,
            status: window.status,
            seconds_to_start: window.secondsToStart ?? 0,
            seconds_to_end: window.secondsToEnd ?? 0,
            duration_minutes: window.durationMinutes ?? 5,
        },
        market: {
            id: primaryMarket.id,
            question: primaryMarket.question,
            slug: primaryMarket.slug,
            condition_id: primaryMarket.conditionId,
            accepting_orders: primaryMarket.acceptingOrders,
            best_bid: primaryMarket.bestBid,
            best_ask: primaryMarket.bestAsk,
            outcomes: primaryMarket.outcomes.map((outcome: ParsedOutcome) => ({
                name: outcome.name,
                probability: outcome.probability,
                token_id: outcome.tokenId,
            })),
        },
    };
}

function compareCoinUpDownCandidate(a: CoinUpDownMarketCandidate | null, b: CoinUpDownMarketCandidate | null): number {
    const rank = (item: CoinUpDownMarketCandidate | null): number => {
        if (!item) return 5;
        if (item.live && item.orderable) return 0;
        if (item.live) return 1;
        if (item.orderable && item.window.status === 'upcoming') return 2;
        if (item.window.status === 'upcoming') return 3;
        if (item.watchlist_only) return 4;
        return 5;
    };

    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    if (!a || !b) return 0;
    if (a.window.status === 'upcoming' && b.window.status === 'upcoming') {
        return Number(a.window.seconds_to_start || 0) - Number(b.window.seconds_to_start || 0);
    }
    if (a.window.status === 'live' && b.window.status === 'live') {
        return Number(b.window.seconds_to_end || 0) - Number(a.window.seconds_to_end || 0);
    }
    return b.liquidity - a.liquidity;
}

function pickCurrentCoinUpDownCandidate(markets: CoinUpDownMarketCandidate[]): CoinUpDownMarketCandidate | null {
    return markets
        .filter((market) => market.live)
        .sort(compareCoinUpDownCandidate)[0] || null;
}

function pickNextCoinUpDownCandidate(markets: CoinUpDownMarketCandidate[]): CoinUpDownMarketCandidate | null {
    return markets
        .filter((market) => market.window.status === 'upcoming')
        .sort((a, b) => a.window.seconds_to_start - b.window.seconds_to_start)[0] || null;
}

function pickExecutionCoinUpDownCandidate(markets: CoinUpDownMarketCandidate[]): CoinUpDownMarketCandidate | null {
    const immediate = markets
        .filter((market) => market.orderable)
        .sort(compareCoinUpDownCandidate);
    return immediate[0] || null;
}

function applyCoinUpDownSelectionState(markets: CoinUpDownMarketCandidate[]): {
    markets: CoinUpDownMarketCandidate[];
    primaryCandidate: CoinUpDownMarketCandidate | null;
    executionCandidate: CoinUpDownMarketCandidate | null;
    currentCandidate: CoinUpDownMarketCandidate | null;
    watchlist: CoinUpDownMarketCandidate[];
    reasonCode: 'ok' | 'primary_candidate_missing' | 'no_near_term_window' | 'future_watchlist_only';
} {
    const currentCandidate = pickCurrentCoinUpDownCandidate(markets);
    const primaryCandidate = pickNextCoinUpDownCandidate(markets) || currentCandidate;
    const executionCandidate = pickExecutionCoinUpDownCandidate(markets);
    const primaryKey = primaryCandidate ? `${primaryCandidate.id}:${primaryCandidate.market.id}` : null;
    const currentKey = currentCandidate ? `${currentCandidate.id}:${currentCandidate.market.id}` : null;
    const annotated = markets.map((market) => {
        const key = `${market.id}:${market.market.id}`;
        const nextWindowCandidate = Boolean(primaryKey && key === primaryKey && market.window.status === 'upcoming');
        const watchlistOnly = Boolean(primaryKey && key !== primaryKey && market.window.status === 'upcoming');
        return {
            ...market,
            next_window_candidate: nextWindowCandidate,
            watchlist_only: watchlistOnly,
        };
    });
    const watchlist = annotated.filter((market) => market.watchlist_only);
    const reasonCode = primaryCandidate
        ? 'ok'
        : watchlist.length > 0
            ? 'future_watchlist_only'
            : markets.length > 0
                ? 'primary_candidate_missing'
                : 'no_near_term_window';
    return {
        markets: annotated,
        primaryCandidate,
        executionCandidate,
        currentCandidate: currentKey
            ? annotated.find((market) => `${market.id}:${market.market.id}` === currentKey) || null
            : null,
        watchlist,
        reasonCode,
    };
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
        /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*ET/i
    );
    if (!match) return null;

    const month = MONTH_LOOKUP[String(match[1] || '').toLowerCase()];
    const day = Number(match[2]);
    const startHour = to24Hour(Number(match[3]), String(match[5] || match[8]));
    const startMinute = match[4] ? Number(match[4]) : 0;
    const endHour = to24Hour(Number(match[6]), String(match[8]));
    const endMinute = match[7] ? Number(match[7]) : 0;
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

function validateSelectionAgainstMarkets(params: {
    question: string;
    outcome: string;
    tokenId: string;
    eventId?: string | null;
    eventTitle?: string | null;
    markets: ParsedMarket[];
    source: 'event_id' | 'search_exact';
}): PolymarketSelectionValidation {
    const normalizedQuestion = normalizeComparableText(params.question);
    const normalizedOutcome = normalizeComparableText(params.outcome);
    const tokenId = String(params.tokenId || '').trim();
    const questionMatches = params.markets.filter((market) => normalizeComparableText(market.question) === normalizedQuestion);
    const matchedMarket = questionMatches.find((market) =>
        market.outcomes.some((outcome) => {
            const outcomeNameMatches = normalizeComparableText(outcome.name) === normalizedOutcome;
            const outcomeTokenMatches = String(outcome.tokenId || '').trim() === tokenId;
            return outcomeNameMatches || outcomeTokenMatches;
        }),
    ) || questionMatches[0] || null;

    if (!matchedMarket) {
        return {
            matched: false,
            source: params.source,
            eventId: params.eventId || null,
            eventTitle: params.eventTitle || null,
            marketId: null,
            marketSlug: null,
            conditionId: null,
            questionMatched: false,
            outcomeMatched: false,
            tokenMatched: false,
            acceptingOrders: null,
            reason: 'question_not_found',
        };
    }

    const matchedOutcome = matchedMarket.outcomes.find((outcome) => normalizeComparableText(outcome.name) === normalizedOutcome) || null;
    if (!matchedOutcome) {
        return {
            matched: false,
            source: params.source,
            eventId: params.eventId || null,
            eventTitle: params.eventTitle || null,
            marketId: matchedMarket.id,
            marketSlug: matchedMarket.slug,
            conditionId: matchedMarket.conditionId,
            questionMatched: true,
            outcomeMatched: false,
            tokenMatched: false,
            acceptingOrders: matchedMarket.acceptingOrders,
            reason: 'outcome_not_found',
        };
    }

    const tokenMatched = String(matchedOutcome.tokenId || '').trim() === tokenId;
    return {
        matched: tokenMatched,
        source: params.source,
        eventId: params.eventId || null,
        eventTitle: params.eventTitle || null,
        marketId: matchedMarket.id,
        marketSlug: matchedMarket.slug,
        conditionId: matchedMarket.conditionId,
        questionMatched: true,
        outcomeMatched: true,
        tokenMatched,
        acceptingOrders: matchedMarket.acceptingOrders,
        reason: tokenMatched ? 'ok' : 'token_mismatch',
    };
}

export const __testables = {
    normalizeDate,
    normalizeComparableText,
    parseMarket,
    parseMarketWindowLabel,
    mapCoinUpDownEvent,
    applyCoinUpDownSelectionState,
    compareNewMarketPriority,
    isEligibleNewMarketWindow,
    normalizeSearchEvents,
    normalizeCoinSeriesName,
    getCurrentEtWindowStart,
    buildExactFiveMinuteWindowQuery,
    validateSelectionAgainstMarkets,
    isExactFiveMinuteWindow,
    MIN_TRADABLE_LIQUIDITY,
    TRADABLE_HORIZON_SECONDS,
    RECOMMENDABLE_HORIZON_SECONDS,
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
    const response = await unifiedApiService.fetchJson<any>({
        url,
        method: 'GET',
        requestTimeout: 15000,
        endpointName: 'polymarket-search'
    });

    const results = normalizeSearchEvents(response);

    if (results.length === 0) {
        return { events: [] };
    }

    // Extract events from search results
    return {
        events: results.map((event: any) => ({
            id: event.id.toString(),
            title: event.title,
            volume: Math.floor(event.volume || 0),
            liquidity: Math.floor(event.liquidity || 0),
            endDate: normalizeDate(event.endDate)
        }))
    };
}

async function searchRawEvents(query: string, limit: number = 10): Promise<any[]> {
    const url = `${GAMMA_API_BASE}/public-search?q=${encodeURIComponent(query)}&limit=${limit}&events_status=active`;
    const response = await unifiedApiService.fetchJson<any>({
        url,
        method: 'GET',
        requestTimeout: 15000,
        endpointName: 'polymarket-search-raw',
    });
    return normalizeSearchEvents(response);
}

async function fetchActiveEventsChronologically(params: {
    limit: number;
    offset?: number;
}): Promise<PolymarketEvent[]> {
    const url = `${GAMMA_API_BASE}/events?limit=${params.limit}&offset=${params.offset || 0}&active=true&closed=false&order=startDate&ascending=true`;
    return unifiedApiService.fetchJson<PolymarketEvent[]>({
        url,
        method: 'GET',
        requestTimeout: 15000,
        endpointName: 'polymarket-events-chronological',
    });
}

async function fetchAuthoritativeMarket(params: {
    marketId?: string | null;
    marketSlug?: string | null;
}): Promise<ParsedMarket | null> {
    const marketId = normalizeString(params.marketId);
    const marketSlug = normalizeString(params.marketSlug);
    if (!marketId && !marketSlug) return null;

    const query = marketId
        ? `id=${encodeURIComponent(marketId)}`
        : `slug=${encodeURIComponent(String(marketSlug))}`;
    const url = `${GAMMA_API_BASE}/markets?limit=5&active=true&closed=false&${query}`;
    const data = await unifiedApiService.fetchJson<PolymarketMarket[]>({
        url,
        method: 'GET',
        requestTimeout: 15000,
        endpointName: 'polymarket-market-authoritative',
    });

    const parsed = data.map(parseMarket);
    if (marketId) {
        return parsed.find((market) => String(market.id) === marketId) || parsed[0] || null;
    }
    return parsed.find((market) => market.slug === marketSlug) || parsed[0] || null;
}

export async function verifyPolymarketSelection(params: {
    question: string;
    outcome: string;
    tokenId: string;
    eventId?: string | null;
}): Promise<PolymarketSelectionValidation> {
    const tokenId = String(params.tokenId || '').trim();
    const question = String(params.question || '').trim();
    const outcome = String(params.outcome || '').trim();
    if (!tokenId || !question || !outcome) {
        return {
            matched: false,
            source: 'none',
            eventId: params.eventId || null,
            eventTitle: null,
            marketId: null,
            marketSlug: null,
            conditionId: null,
            questionMatched: false,
            outcomeMatched: false,
            tokenMatched: false,
            acceptingOrders: null,
            reason: 'question_not_found',
        };
    }

    if (params.eventId) {
        try {
            const event = await getEventDetails(String(params.eventId));
            return validateSelectionAgainstMarkets({
                question,
                outcome,
                tokenId,
                eventId: event.id,
                eventTitle: event.title,
                markets: event.markets,
                source: 'event_id',
            });
        } catch {
            // Fall through to exact search lookup.
        }
    }

    const rawEvents = await searchRawEvents(question, 5);
    for (const event of rawEvents) {
        const markets = Array.isArray(event?.markets)
            ? event.markets
                .filter((market: any) => !market?.closed)
                .map((market: PolymarketMarket) => parseMarket(market))
            : [];
        if (markets.length === 0) continue;
        const validation = validateSelectionAgainstMarkets({
            question,
            outcome,
            tokenId,
            eventId: normalizeString(event?.id),
            eventTitle: normalizeString(event?.title),
            markets,
            source: 'search_exact',
        });
        if (validation.questionMatched) {
            return validation;
        }
    }

    return {
        matched: false,
        source: params.eventId ? 'event_id' : 'search_exact',
        eventId: params.eventId || null,
        eventTitle: null,
        marketId: null,
        marketSlug: null,
        conditionId: null,
        questionMatched: false,
        outcomeMatched: false,
        tokenMatched: false,
        acceptingOrders: null,
        reason: params.eventId ? 'event_lookup_failed' : 'question_not_found',
    };
}

export async function resolveAuthoritativePolymarketSelection(params: {
    question: string;
    outcome: string;
    tokenId: string;
    marketId?: string | null;
    marketSlug?: string | null;
}): Promise<PolymarketSelectionValidation> {
    const market = await fetchAuthoritativeMarket({
        marketId: params.marketId,
        marketSlug: params.marketSlug,
    }).catch(() => null);
    if (!market) {
        return {
            matched: false,
            source: 'none',
            eventId: null,
            eventTitle: null,
            marketId: normalizeString(params.marketId),
            marketSlug: normalizeString(params.marketSlug),
            conditionId: null,
            questionMatched: false,
            outcomeMatched: false,
            tokenMatched: false,
            acceptingOrders: null,
            reason: 'event_lookup_failed',
        };
    }

    return validateSelectionAgainstMarkets({
        question: params.question,
        outcome: params.outcome,
        tokenId: params.tokenId,
        markets: [market],
        source: 'event_id',
        eventId: null,
        eventTitle: market.question,
    });
}

export async function getCoinUpDownMarkets(params: {
    coin?: string | null;
    limit?: number;
    windowsAhead?: number;
} = {}): Promise<{
    currentTimeEt: string;
    currentTimeEtStrict: string;
    series: string[];
    count: number;
    primaryCandidate: CoinUpDownMarketCandidate | null;
    executionCandidate: CoinUpDownMarketCandidate | null;
    currentCandidate: CoinUpDownMarketCandidate | null;
    watchlist: CoinUpDownMarketCandidate[];
    markets: CoinUpDownMarketCandidate[];
    note: string;
    reasonCode: 'ok' | 'primary_candidate_missing' | 'no_near_term_window' | 'future_watchlist_only';
}> {
    const now = new Date();
    const requestedSeries = normalizeCoinSeriesName(params.coin);
    const series = requestedSeries ? [requestedSeries] : DEFAULT_COIN_UP_DOWN_SERIES;
    const windowsAhead = Math.min(Math.max(params.windowsAhead || (requestedSeries ? 8 : 3), 1), 12);
    const limit = Math.min(Math.max(params.limit || 10, 1), 20);

    const maxResultsNeeded = Math.max(limit * 3, series.length * windowsAhead * 2);
    const eventScanCandidates = new Map<string, CoinUpDownMarketCandidate>();
    for (let offset = 0; offset < 300 && eventScanCandidates.size < maxResultsNeeded; offset += 100) {
        const batch = await fetchActiveEventsChronologically({ limit: 100, offset });
        if (!Array.isArray(batch) || batch.length === 0) break;
        for (const event of batch) {
            if (!isCoinUpDownSeriesEvent(event, series)) continue;
            const mapped = mapCoinUpDownEvent(event, now);
            if (!mapped) continue;
            const key = `${mapped.id}:${mapped.market.id}`;
            if (!eventScanCandidates.has(key)) {
                eventScanCandidates.set(key, mapped);
            }
        }
        if (batch.length < 100) break;
    }

    let markets = Array.from(eventScanCandidates.values()).sort(compareCoinUpDownCandidate);
    let fallbackReason: 'none' | 'fuzzy_search_only' = 'none';

    if (markets.length === 0 && requestedSeries) {
        const searchQueries = buildFiveMinuteSearchQueries(now, requestedSeries, windowsAhead);
        const rawResults = await Promise.all(searchQueries.map((candidate) => searchRawEvents(candidate.query, 10)));
        const exactMatches = new Map<string, CoinUpDownMarketCandidate>();
        for (let index = 0; index < searchQueries.length; index += 1) {
            const candidate = searchQueries[index];
            const events = rawResults[index] || [];
            for (const event of events) {
                const title = normalizeComparableText(event?.title);
                if (title !== normalizeComparableText(candidate.query)) continue;
                const mapped = mapCoinUpDownEvent(event, now);
                if (!mapped) continue;
                const key = `${mapped.id}:${mapped.market.id}`;
                if (!exactMatches.has(key)) {
                    exactMatches.set(key, mapped);
                }
            }
        }
        markets = Array.from(exactMatches.values()).sort(compareCoinUpDownCandidate);
        if (markets.length > 0) {
            fallbackReason = 'fuzzy_search_only';
        }
    }

    const selected = applyCoinUpDownSelectionState(markets);
    const slicedMarkets = selected.markets.slice(0, limit);

    const note = selected.primaryCandidate
        ? 'Exact 5-minute coin Up/Down windows found via active-event scan. Answer from primary_candidate first; keep additional future windows as watchlist only.'
        : selected.watchlist.length > 0
            ? 'Only farther-future 5-minute windows are visible right now. No near-term primary candidate is available.'
            : `No coin Up/Down 5-minute window found within the next ${Math.round((windowsAhead * 5) / 60 * 10) / 10} hour(s) of ET search windows.`;

    console.info('[Polymarket5mDiscovery]', {
        requested_coin: requestedSeries || null,
        current_time_et: formatDateTimeInEt(now),
        candidate_count: selected.markets.length,
        primary_candidate_title: selected.primaryCandidate?.title || null,
        execution_candidate_title: selected.executionCandidate?.title || null,
        fallback_reason: fallbackReason,
        reason_code: selected.reasonCode,
    });

    return {
        currentTimeEt: formatDateTimeInEt(now),
        currentTimeEtStrict: formatDateTimeInEt(now),
        series,
        count: slicedMarkets.length,
        primaryCandidate: selected.primaryCandidate,
        executionCandidate: selected.executionCandidate,
        currentCandidate: selected.currentCandidate,
        watchlist: selected.watchlist.slice(0, limit),
        markets: slicedMarkets,
        note,
        reasonCode: selected.reasonCode,
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
        tradable: boolean;
        recommendable: boolean;
        recommendable_detail: 'ok' | 'watchlist_only' | 'no_window_found';
        tradable_detail: string;
        markets: ParsedMarket[];
    }>;
    eligibleWindowCount: number;
    tradableWindowCount: number;
    recommendableWindowCount: number;
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
    let tradableWindowCount = 0;
    let recommendableWindowCount = 0;
    const mappedEvents = data.map((event, index) => {
        const markets = (event.markets || [])
            .filter((market) => !market.closed)
            .map(parseMarket);
        const windowCandidates = markets
            .map((market) => parseMarketWindowLabel(market.question, now))
            .filter((window): window is ParsedMarketWindow => Boolean(window));
        const eligibleWindows = windowCandidates.filter(isEligibleNewMarketWindow);
        const recommendedWindow = eligibleWindows.sort(compareNewMarketPriority)[0] || null;
        
        // Check tradability: within 6h AND has real liquidity
        const eventLiquidity = Math.floor(event.liquidity || 0);
        const withinTradableHorizon = recommendedWindow
            ? (recommendedWindow.status === 'live' || 
               (recommendedWindow.status === 'upcoming' && 
                (recommendedWindow.secondsToStart ?? Number.MAX_SAFE_INTEGER) <= TRADABLE_HORIZON_SECONDS))
            : false;
        const hasLiquidity = eventLiquidity >= MIN_TRADABLE_LIQUIDITY;
        const isTradable = withinTradableHorizon && hasLiquidity;
        const isRecommendable = recommendedWindow
            ? (
                (recommendedWindow.status === 'upcoming'
                    && (recommendedWindow.secondsToStart ?? Number.MAX_SAFE_INTEGER) <= RECOMMENDABLE_HORIZON_SECONDS)
                || (recommendedWindow.status === 'live'
                    && (recommendedWindow.secondsToEnd ?? 0) > NEW_MARKET_MIN_LIVE_SECONDS_LEFT)
            )
            : false;
        
        if (recommendedWindow) eligibleWindowCount += 1;
        if (isTradable) tradableWindowCount += 1;
        if (isRecommendable) recommendableWindowCount += 1;
        
        const sortPriority = !recommendedWindow
            ? 5
            : isRecommendable && recommendedWindow.status === 'upcoming'
                ? 0
                : isRecommendable && recommendedWindow.status === 'live'
                    ? 1
                    : isTradable && recommendedWindow.status === 'upcoming'
                        ? 2
                        : isTradable && recommendedWindow.status === 'live'
                            ? 3
                            : 4;

        const recommendableDetail: 'ok' | 'watchlist_only' | 'no_window_found' = !recommendedWindow
            ? 'no_window_found'
            : isRecommendable
                ? 'ok'
                : 'watchlist_only';

        return {
            id: event.id,
            title: event.title,
            volume: Math.floor(event.volume || 0),
            liquidity: eventLiquidity,
            creationDate: normalizeDate(event.startDate) || '',
            recommendedWindow,
            tradable: isTradable,
            recommendable: isRecommendable,
            recommendable_detail: recommendableDetail,
            tradable_detail: !recommendedWindow
                ? 'no_window_found'
                : !withinTradableHorizon
                    ? 'window_too_far_ahead'
                    : !hasLiquidity
                        ? 'no_liquidity_yet'
                        : 'ok',
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
        if ((a.__sort.priority === 1 && b.__sort.priority === 1) || (a.__sort.priority === 3 && b.__sort.priority === 3)) {
            if (a.__sort.secondsToEnd !== b.__sort.secondsToEnd) {
                return b.__sort.secondsToEnd - a.__sort.secondsToEnd;
            }
        }
        if ((a.__sort.priority === 2 && b.__sort.priority === 2) || (a.__sort.priority === 4 && b.__sort.priority === 4)) {
            if (a.__sort.startMs !== b.__sort.startMs) {
                return a.__sort.startMs - b.__sort.startMs;
            }
        }
        return a.__sort.sourceIndex - b.__sort.sourceIndex;
    });

    return {
        events: mappedEvents.map(({ __sort, ...event }) => event),
        eligibleWindowCount,
        tradableWindowCount,
        recommendableWindowCount,
        selectionNote: recommendableWindowCount > 0
            ? `${recommendableWindowCount} near-term short-window market(s) are suitable answer candidates. Keep farther windows as watchlist-only discovery.`
            : tradableWindowCount > 0
                ? `${tradableWindowCount} market(s) are tradable now (within 6h and have liquidity), but none are near-term enough to recommend as the "next" short-window answer.`
                : eligibleWindowCount > 0
                    ? `${eligibleWindowCount} short-window market(s) found but none are near-term answer candidates yet. Keep them visible as watchlist items and explain when they might open.`
                : 'No short-window market found within 48 hours.'
    };
}

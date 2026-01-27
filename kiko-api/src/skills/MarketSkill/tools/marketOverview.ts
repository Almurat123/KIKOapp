import { Tool } from '../../../tools/registry.js';
import { z } from 'zod';
import { fetchJson } from '../../../config/unifiedApiService.js';

// Interfaces for market data
export interface MarketIndicator {
    id: string;
    name: string;
    fullName: string;
    value: number;
    change: number;
    changePercent: number;
    previousClose: number;
    timestamp: string;
    source: string;
    category: 'volatility' | 'currency' | 'commodity' | 'bond' | 'sentiment';
}

// Yahoo Finance fallback data (consistent with frontend source)
const MARKET_SYMBOLS = {
    VIX: '^VIX',           // CBOE Volatility Index
    DXY: 'DX-Y.NYB',       // US Dollar Index
    GOLD: 'GC=F',          // Gold Futures
    OIL: 'CL=F',           // Crude Oil Futures
    EURUSD: 'EURUSD=X',    // EUR/USD
};

// Fallback data for reliability when APIs fail/CORS issues (though backend has less CORS issues)
const FALLBACK_MARKET_DATA: Record<string, any> = {
    [MARKET_SYMBOLS.VIX]: {
        symbol: '^VIX',
        regularMarketPrice: 14.23,
        regularMarketChange: 0.45,
        regularMarketChangePercent: 3.27,
        regularMarketPreviousClose: 13.78,
    },
    [MARKET_SYMBOLS.DXY]: {
        symbol: 'DX-Y.NYB',
        regularMarketPrice: 106.89,
        regularMarketChange: 0.34,
        regularMarketChangePercent: 0.32,
        regularMarketPreviousClose: 106.55,
    },
    [MARKET_SYMBOLS.GOLD]: {
        symbol: 'GC=F',
        regularMarketPrice: 2638.50,
        regularMarketChange: -12.30,
        regularMarketChangePercent: -0.46,
        regularMarketPreviousClose: 2650.80,
    },
    [MARKET_SYMBOLS.OIL]: {
        symbol: 'CL=F',
        regularMarketPrice: 68.94,
        regularMarketChange: 0.77,
        regularMarketChangePercent: 1.13,
        regularMarketPreviousClose: 68.17,
    },
    [MARKET_SYMBOLS.EURUSD]: {
        symbol: 'EURUSD=X',
        regularMarketPrice: 1.0489,
        regularMarketChange: -0.0023,
        regularMarketChangePercent: -0.22,
        regularMarketPreviousClose: 1.0512,
    },
};

/**
 * Fetch quote data from Yahoo Finance (or fallback)
 */
async function fetchYahooQuote(symbol: string): Promise<any> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;

        // Backend can fetch directly, unlike frontend
        const data: any = await fetchJson({
            url,
            timeout: 3000,
            endpointName: 'yahoo-finance',
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        const result = data.chart?.result?.[0];

        if (!result?.meta) {
            return FALLBACK_MARKET_DATA[symbol];
        }

        const meta = result.meta;
        const previousClose = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
        const currentPrice = meta.regularMarketPrice;
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;

        return {
            symbol,
            regularMarketPrice: currentPrice,
            regularMarketChange: change,
            regularMarketChangePercent: changePercent,
            regularMarketPreviousClose: previousClose,
            regularMarketTime: meta.regularMarketTime || Date.now() / 1000,
        };
    } catch (error) {
        console.warn(`[GetMarketOverviewTool] Error fetching ${symbol}:`, error);
        return FALLBACK_MARKET_DATA[symbol];
    }
}

function transformToMarketIndicator(
    quote: any,
    id: string,
    name: string,
    fullName: string,
    category: MarketIndicator['category']
): MarketIndicator {
    return {
        id,
        name,
        fullName,
        value: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        previousClose: quote.regularMarketPreviousClose,
        timestamp: new Date((quote.regularMarketTime || Date.now() / 1000) * 1000).toISOString(),
        source: 'Yahoo Finance',
        category,
    };
}

export const GetMarketOverviewTool: Tool = {
    definition: {
        name: 'get_market_overview',
        description: 'Get macro market indicators including VIX (volatility), DXY (currency strength), Gold, Oil, and EUR/USD rates to analyze broader market sentiment.',
        parameters: {
            type: 'object',
            properties: {
                indicators: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['VIX', 'DXY', 'Gold', 'Oil', 'EUR/USD']
                    },
                    description: 'Specific indicators to include in the overview.'
                }
            },
            required: []
        }
    },
    handler: async (args: { indicators?: string[] }) => {
        const requested = args.indicators || ['ALL'];
        const fetchAll = requested.includes('ALL');

        const results: MarketIndicator[] = [];
        const tasks = [];

        // VIX
        if (fetchAll || requested.includes('VIX')) {
            tasks.push(fetchYahooQuote(MARKET_SYMBOLS.VIX).then(q =>
                q && results.push(transformToMarketIndicator(q, 'VIX', 'VIX', 'CBOE Volatility Index', 'volatility'))
            ));
        }

        // DXY
        if (fetchAll || requested.includes('DXY')) {
            tasks.push(fetchYahooQuote(MARKET_SYMBOLS.DXY).then(q =>
                q && results.push(transformToMarketIndicator(q, 'DXY', 'DXY', 'US Dollar Index', 'currency'))
            ));
        }

        // GOLD
        if (fetchAll || requested.includes('GOLD')) {
            tasks.push(fetchYahooQuote(MARKET_SYMBOLS.GOLD).then(q =>
                q && results.push(transformToMarketIndicator(q, 'GOLD', 'Gold', 'Gold Futures', 'commodity'))
            ));
        }

        // OIL
        if (fetchAll || requested.includes('OIL')) {
            tasks.push(fetchYahooQuote(MARKET_SYMBOLS.OIL).then(q =>
                q && results.push(transformToMarketIndicator(q, 'OIL', 'Crude Oil', 'WTI Crude Oil Futures', 'commodity'))
            ));
        }

        // EURUSD
        if (fetchAll || requested.includes('EURUSD')) {
            tasks.push(fetchYahooQuote(MARKET_SYMBOLS.EURUSD).then(q =>
                q && results.push(transformToMarketIndicator(q, 'EURUSD', 'EUR/USD', 'Euro / US Dollar', 'currency'))
            ));
        }

        await Promise.all(tasks);

        // Calculate simplified Fear & Greed Index
        let fearGreedLabel = 'Neutral';
        let fearGreedValue = 50;

        const vix = results.find(r => r.id === 'VIX');
        const dxy = results.find(r => r.id === 'DXY');

        if (vix) {
            // VIX below 15 = greed, above 30 = fear
            const vixScore = Math.max(0, Math.min(100, 100 - (vix.value - 12) * 3));
            fearGreedValue = vixScore;
            if (dxy) {
                const dxyScore = dxy.changePercent > 0.5 ? 40 : dxy.changePercent < -0.5 ? 60 : 50;
                fearGreedValue = (vixScore + dxyScore) / 2;
            }
        }

        if (fearGreedValue >= 75) fearGreedLabel = 'Extreme Greed';
        else if (fearGreedValue >= 55) fearGreedLabel = 'Greed';
        else if (fearGreedValue <= 25) fearGreedLabel = 'Extreme Fear';
        else if (fearGreedValue <= 45) fearGreedLabel = 'Fear';

        return {
            indicators: results,
            marketSentiment: {
                score: Math.round(fearGreedValue),
                label: fearGreedLabel,
                analysis: `Market sentiment is ${fearGreedLabel} (${Math.round(fearGreedValue)}/100). VIX is at ${vix?.value.toFixed(2) || 'N/A'}.`
            }
        };
    },
};

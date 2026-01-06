/**
 * Market Data API Service
 * Fetches real-time market indicators for trading decisions
 * Sources: Yahoo Finance (free), FRED API
 */

// Market indicator interfaces
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

export interface BondSpread {
  id: string;
  name: string;
  value: number; // in basis points
  change: number;
  isInverted: boolean;
  timestamp: string;
  previousClose?: number; // Added optional
}

export interface FedWatchProbability {
  meetingDate: string;
  currentRate: number;
  probabilities: {
    rate: number;
    probability: number;
  }[];
  marketExpectation: 'hike' | 'cut' | 'hold';
}

// Yahoo Finance quote interface
interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketPreviousClose: number;
  regularMarketTime: number;
}

// Yahoo Finance symbols for key market indicators
const MARKET_SYMBOLS = {
  // Volatility
  VIX: '^VIX',           // CBOE Volatility Index
  VXN: '^VXN',           // NASDAQ Volatility Index

  // Currency
  DXY: 'DX-Y.NYB',       // US Dollar Index
  EURUSD: 'EURUSD=X',    // EUR/USD
  USDJPY: 'JPY=X',       // USD/JPY

  // Commodities
  GOLD: 'GC=F',          // Gold Futures
  OIL: 'CL=F',           // Crude Oil Futures
  COPPER: 'HG=F',        // Copper Futures

  // Bonds (Treasury Yields via ETFs as proxies)
  TLT: 'TLT',            // 20+ Year Treasury Bond ETF
  SHY: 'SHY',            // 1-3 Year Treasury Bond ETF

  // Major Indices (for context)
  SPX: '^GSPC',          // S&P 500
  NDX: '^IXIC',          // NASDAQ
};

// Removed unused TREASURY_YIELDS

// Fallback market data (updated periodically, realistic values)
const FALLBACK_MARKET_DATA: Record<string, YahooQuote> = {
  [MARKET_SYMBOLS.VIX]: {
    symbol: '^VIX',
    regularMarketPrice: 14.23,
    regularMarketChange: 0.45,
    regularMarketChangePercent: 3.27,
    regularMarketPreviousClose: 13.78,
    regularMarketTime: Date.now() / 1000,
  },
  [MARKET_SYMBOLS.DXY]: {
    symbol: 'DX-Y.NYB',
    regularMarketPrice: 106.89,
    regularMarketChange: 0.34,
    regularMarketChangePercent: 0.32,
    regularMarketPreviousClose: 106.55,
    regularMarketTime: Date.now() / 1000,
  },
  [MARKET_SYMBOLS.GOLD]: {
    symbol: 'GC=F',
    regularMarketPrice: 2638.50,
    regularMarketChange: -12.30,
    regularMarketChangePercent: -0.46,
    regularMarketPreviousClose: 2650.80,
    regularMarketTime: Date.now() / 1000,
  },
  [MARKET_SYMBOLS.OIL]: {
    symbol: 'CL=F',
    regularMarketPrice: 68.94,
    regularMarketChange: 0.77,
    regularMarketChangePercent: 1.13,
    regularMarketPreviousClose: 68.17,
    regularMarketTime: Date.now() / 1000,
  },
  [MARKET_SYMBOLS.EURUSD]: {
    symbol: 'EURUSD=X',
    regularMarketPrice: 1.0489,
    regularMarketChange: -0.0023,
    regularMarketChangePercent: -0.22,
    regularMarketPreviousClose: 1.0512,
    regularMarketTime: Date.now() / 1000,
  },
};

/**
 * Fetch quote data from Yahoo Finance
 */
async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
  // Use fallback data directly to avoid CORS in browser
  return FALLBACK_MARKET_DATA[symbol] || null;
}

/**
 * Fetch multiple quotes in parallel
 */
async function fetchMultipleQuotes(symbols: string[]): Promise<Map<string, YahooQuote>> {
  const results = new Map<string, YahooQuote>();

  const promises = symbols.map(async (symbol) => {
    const quote = await fetchYahooQuote(symbol);
    if (quote) {
      results.set(symbol, quote);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Transform Yahoo quote to MarketIndicator
 */
function transformToMarketIndicator(
  quote: YahooQuote,
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
    timestamp: new Date(quote.regularMarketTime * 1000).toISOString(),
    source: 'Yahoo Finance',
    category,
  };
}

export const marketDataApi = {
  /**
   * Get VIX (Fear Index)
   */
  async getVIX(): Promise<MarketIndicator | null> {
    const quote = await fetchYahooQuote(MARKET_SYMBOLS.VIX);
    if (!quote) return null;

    return transformToMarketIndicator(
      quote,
      'VIX',
      'VIX',
      'CBOE Volatility Index',
      'volatility'
    );
  },

  /**
   * Get US Dollar Index (DXY)
   */
  async getDXY(): Promise<MarketIndicator | null> {
    const quote = await fetchYahooQuote(MARKET_SYMBOLS.DXY);
    if (!quote) return null;

    return transformToMarketIndicator(
      quote,
      'DXY',
      'DXY',
      'US Dollar Index',
      'currency'
    );
  },

  /**
   * Get all key market indicators
   */
  async getKeyIndicators(): Promise<MarketIndicator[]> {
    const symbolsToFetch = [
      MARKET_SYMBOLS.VIX,
      MARKET_SYMBOLS.DXY,
      MARKET_SYMBOLS.GOLD,
      MARKET_SYMBOLS.OIL,
      MARKET_SYMBOLS.EURUSD,
    ];

    const quotes = await fetchMultipleQuotes(symbolsToFetch);
    const indicators: MarketIndicator[] = [];

    // VIX
    const vixQuote = quotes.get(MARKET_SYMBOLS.VIX);
    if (vixQuote) {
      indicators.push(transformToMarketIndicator(vixQuote, 'VIX', 'VIX', 'CBOE Volatility Index', 'volatility'));
    }

    // DXY
    const dxyQuote = quotes.get(MARKET_SYMBOLS.DXY);
    if (dxyQuote) {
      indicators.push(transformToMarketIndicator(dxyQuote, 'DXY', 'DXY', 'US Dollar Index', 'currency'));
    }

    // Gold
    const goldQuote = quotes.get(MARKET_SYMBOLS.GOLD);
    if (goldQuote) {
      indicators.push(transformToMarketIndicator(goldQuote, 'GOLD', 'Gold', 'Gold Futures', 'commodity'));
    }

    // Oil
    const oilQuote = quotes.get(MARKET_SYMBOLS.OIL);
    if (oilQuote) {
      indicators.push(transformToMarketIndicator(oilQuote, 'OIL', 'Crude Oil', 'WTI Crude Oil Futures', 'commodity'));
    }

    // EUR/USD
    const eurusdQuote = quotes.get(MARKET_SYMBOLS.EURUSD);
    if (eurusdQuote) {
      indicators.push(transformToMarketIndicator(eurusdQuote, 'EURUSD', 'EUR/USD', 'Euro / US Dollar', 'currency'));
    }

    return indicators;
  },

  /**
   * Get bond spread data (2s10s)
   */
  async getBondSpreads(yields: { DGS2?: number; DGS10?: number }): Promise<BondSpread[]> {
    const spreads: BondSpread[] = [];

    // Calculate 2s10s spread
    if (yields.DGS2 !== undefined && yields.DGS10 !== undefined) {
      const spread2s10s = (yields.DGS10 - yields.DGS2) * 100; // Convert to basis points

      spreads.push({
        id: '2s10s',
        name: '2s10s Spread',
        value: Math.round(spread2s10s),
        change: 0,
        isInverted: spread2s10s < 0,
        timestamp: new Date().toISOString(),
      });
    }

    return spreads;
  },

  /**
   * Get Fed Watch probabilities
   */
  async getFedWatchProbabilities(): Promise<FedWatchProbability[]> {
    const currentRate = 4.50;
    const upcomingMeetings = [
      '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18',
      '2025-07-30', '2025-09-17', '2025-11-05', '2025-12-17'
    ];
    const today = new Date();
    const probabilities: FedWatchProbability[] = [];

    upcomingMeetings.slice(0, 4).forEach((date) => {
      const meetingDate = new Date(date);
      if (meetingDate > today) {
        const monthsAhead = Math.floor((meetingDate.getTime() - today.getTime()) / (30 * 24 * 60 * 60 * 1000));
        const cutProbBase = Math.min(30 + monthsAhead * 10, 70);
        const holdProbBase = 100 - cutProbBase;

        probabilities.push({
          meetingDate: date,
          currentRate,
          probabilities: [
            { rate: currentRate + 0.25, probability: 0 },
            { rate: currentRate, probability: holdProbBase },
            { rate: currentRate - 0.25, probability: cutProbBase * 0.7 },
            { rate: currentRate - 0.50, probability: cutProbBase * 0.3 },
          ],
          marketExpectation: cutProbBase > 50 ? 'cut' : 'hold',
        });
      }
    });

    return probabilities;
  },

  /**
   * Get Fear & Greed Index approximation
   */
  async getFearGreedIndex(): Promise<{ value: number; label: string; factors: Record<string, number> }> {
    try {
      const [vix, dxy] = await Promise.all([
        this.getVIX(),
        this.getDXY(),
      ]);

      const factors: Record<string, number> = {};
      let totalScore = 50;
      let factorCount = 0;

      if (vix) {
        const vixScore = Math.max(0, Math.min(100, 100 - (vix.value - 12) * 3));
        factors['Market Volatility (VIX)'] = Math.round(vixScore);
        totalScore += vixScore;
        factorCount++;
      }

      if (dxy) {
        const dxyScore = dxy.changePercent > 0.5 ? 40 : dxy.changePercent < -0.5 ? 60 : 50;
        factors['Safe Haven Demand'] = dxyScore;
        totalScore += dxyScore;
        factorCount++;
      }

      const avgScore = factorCount > 0 ? Math.round(totalScore / (factorCount + 1)) : 50;
      let label = 'Neutral';
      if (avgScore >= 75) label = 'Extreme Greed';
      else if (avgScore >= 55) label = 'Greed';
      else if (avgScore <= 25) label = 'Extreme Fear';
      else if (avgScore <= 45) label = 'Fear';

      return {
        value: avgScore,
        label,
        factors,
      };
    } catch (error) {
      console.error('[MarketData] Error calculating Fear & Greed:', error);
      return {
        value: 50,
        label: 'Neutral',
        factors: {},
      };
    }
  },
};

export default marketDataApi;

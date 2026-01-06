import { scrapeDexScreenerTrending } from '../dexscreenerScraper.js';
import * as dexScreener from '../dexscreener.js';

// Configuration
const CHAINS = ['base', 'solana', 'bsc'];  // Removed ETH (less "fun" tokens)
const TOKENS_PER_CHAIN = 3;  // 3 tokens per chain = 9 total
const DURATION = '1h';  // 1h trending

// ========== Enhanced Token Filter ==========

// Stablecoin symbols
const STABLECOIN_SYMBOLS = new Set([
    'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDP', 'GUSD',
    'LUSD', 'sUSD', 'HUSD', 'USDD', 'FDUSD', 'PYUSD', 'cUSD', 'CUSD',
    'EURC', 'EURT', 'UST', 'MIM', 'DOLA', 'alUSD', 'OUSD', 'BEAN',
    'USDJ', 'USDN', 'USDX', 'VST', 'HAY', 'CRVUSD', 'GHO', 'mkUSD',
    'eUSD', 'USDe', 'USDY', 'USD+', 'USDB', 'agEUR', 'jEUR', 'cEUR',
    // SKY/Maker ecosystem stablecoins
    'USDS', 'sUSDS', 'sDAI', 'sDai',
    // Other stablecoins
    'USDtb', 'USDTB', 'frxUSD', 'CASH'
]);

// Wrapped / Bridged / Staked token symbols
const WRAPPED_SYMBOLS = new Set([
    // Wrapped native tokens
    'WETH', 'WBTC', 'WBNB', 'WMATIC', 'WAVAX', 'WFTM', 'WCRO', 'WONE',
    'wSOL', 'WSOL', 'WTRX', 'WXRP', 'WDOGE', 'WKLAY',
    // Coinbase wrapped tokens
    'cbBTC', 'cbETH',
    // Other wrapped BTC variants
    'tBTC', 'renBTC', 'sBTC', 'BTCB', 'HBTC', 'imBTC', 'pBTC', 'oBTC',
    // Liquid Staking Derivatives (LSDs)
    'stETH', 'wstETH', 'rETH', 'cbETH', 'sfrxETH', 'frxETH', 'ankrETH',
    'mETH', 'swETH', 'ETHx', 'osETH', 'oETH',
    'stSOL', 'mSOL', 'jitoSOL', 'bSOL', 'scnSOL', 'cgntSOL',
    'sAVAX', 'stMATIC', 'MaticX', 'ankrMATIC',
    'BNBx', 'stkBNB', 'ankrBNB',
    // Bridged tokens
    'axlUSDC', 'axlETH', 'axlWBTC', 'axlDAI',
    'cETH', 'cDAI', 'cUSDC', 'cUSDT', // Compound cTokens
    'aETH', 'aDAI', 'aUSDC', 'aUSDT', // Aave aTokens
]);

// Custom exclusions - tokens that appear too frequently or are already well-known
const CUSTOM_EXCLUSIONS = new Set([
    'VIRTUAL', // Virtual Protocol on Base
    'AERO',    // Aerodrome on Base  
    'AVNT',    // Avantis on Base
    'ZORA',    // Zora on Base
    'CARV',    // CARV on Base
]);

// Name patterns to filter (case-insensitive matching)
const FILTERED_NAME_PATTERNS = [
    /^wrapped\s/i,
    /^bridged\s/i,
    /^staked\s/i,
    /^liquid\s*staked/i,
    /\spegged$/i,
    /^aave\s/i,
    /^compound\s/i,
    /\sLP$/i,           // LP tokens
    /\sLP\s*Token$/i,
    /^(USD|EUR|GBP|JPY|CNY|KRW)\s/i,  // Fiat-named tokens
    /stablecoin/i,      // Anything with "stablecoin" in name
    /\swrapped\s/i,     // "X Wrapped Y" pattern
    /^coinbase\s*wrapped/i, // Coinbase wrapped tokens
    /^savings\s/i,      // "Savings X" pattern (sUSDS, sDAI)
];

/**
 * Check if a token should be filtered out
 */
function shouldFilterToken(symbol: string, name: string): boolean {
    const upperSymbol = symbol.toUpperCase();

    // Check symbol blacklists
    if (STABLECOIN_SYMBOLS.has(upperSymbol)) return true;
    if (WRAPPED_SYMBOLS.has(symbol)) return true; // Case-sensitive for LSDs
    if (WRAPPED_SYMBOLS.has(upperSymbol)) return true;
    if (CUSTOM_EXCLUSIONS.has(upperSymbol)) return true;

    // Check name patterns
    for (const pattern of FILTERED_NAME_PATTERNS) {
        if (pattern.test(name)) return true;
    }

    return false;
}


// Max market cap threshold (e.g. $1 Billion)
const MAX_MARKET_CAP = 1_000_000_000;

export interface TrendingToken {
    name: string;
    symbol: string;
    address: string;
    chain: string;
    price: string | number;
    priceChange: number;
    volume: number;
    marketCap: number;
    imageUrl?: string;
}

export interface NewsTrendingData {
    tokens: TrendingToken[];
    chains: string[];
    timestamp: number;
}

/**
 * Collects top trending tokens from all configured chains
 * Uses DexScreener API with enhanced filtering
 * @param exclusionList - List of token symbols to exclude (e.g. recently covered tokens)
 */
export async function collectTrendingTokens(exclusionList: Set<string> = new Set()): Promise<NewsTrendingData> {
    console.log(`[NewsCollector] Starting collection for chains: ${CHAINS.join(', ')}`);
    if (exclusionList.size > 0) {
        console.log(`[NewsCollector] Applying exclusion list with ${exclusionList.size} tokens.`);
    }

    const tokenPromises = CHAINS.map(async (chain) => {
        try {
            // Fetch from DexScreener - fetch more to allow for filtering
            const results = await dexScreener.getTrendingTokensByChain(chain, 30, DURATION);

            // Apply enhanced filter:
            // 1. Stablecoins/Wrapped tokens
            // 2. Custom manual exclusions
            // 3. Dynamic exclusion list (cooldown)
            // 4. Market Cap threshold
            const filteredResults = results.filter((t: any) => {
                const upperSymbol = t.symbol.toUpperCase();

                if (shouldFilterToken(t.symbol, t.name)) {
                    console.log(`[NewsCollector] FILTERED (stablecoin/wrapped): ${t.symbol}`);
                    return false;
                }
                if (exclusionList.has(upperSymbol)) {
                    console.log(`[NewsCollector] FILTERED (cooldown): ${t.symbol}`);
                    return false;
                }
                if (CUSTOM_EXCLUSIONS.has(upperSymbol)) {
                    console.log(`[NewsCollector] FILTERED (custom exclusion): ${t.symbol}`);
                    return false;
                }

                // Market Cap Filter (using FDV as proxy)
                const mcap = Number(t.fdv || 0);
                if (mcap > MAX_MARKET_CAP) {
                    console.log(`[NewsCollector] FILTERED (market cap $${(mcap / 1e9).toFixed(2)}B > $1B): ${t.symbol}`);
                    return false;
                }

                return true;
            });

            // Map to our simplified format and take top N
            return filteredResults.slice(0, TOKENS_PER_CHAIN).map((t: any) => ({
                name: t.name,
                symbol: t.symbol,
                address: t.address,
                chain: chain,
                price: t.price || 0,
                priceChange: parseFloat(String(t.priceChange24h || t.priceChange6h || '0')),
                volume: parseFloat(String(t.volume24h || '0')),
                marketCap: Number(t.fdv || 0), // Using FDV as Market Cap proxy
                imageUrl: t.imageUrl
            }));
        } catch (error) {
            console.error(`[NewsCollector] Failed to fetch for ${chain}:`, error);
            return [];
        }
    });

    const chainResults = await Promise.all(tokenPromises);
    const allTokens = chainResults.flat();

    console.log(`[NewsCollector] Collected ${allTokens.length} tokens total.`);

    return {
        tokens: allTokens,
        chains: CHAINS,
        timestamp: Date.now()
    };
}

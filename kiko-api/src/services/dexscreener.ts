/**
 * DexScreener API Service
 * Documentation: https://docs.dexscreener.com/
 * 
 * Free API with rate limit ~300 requests/minute
 * Used as fallback for GeckoTerminal
 */

const DEXSCREENER_BASE_URL = 'https://api.dexscreener.com/latest/dex';
const DEXSCREENER_TOKEN_PROFILES_URL = 'https://api.dexscreener.com/token-profiles/latest/v1';
const DEXSCREENER_TOKEN_BOOSTS_URL = 'https://api.dexscreener.com/token-boosts/top/v1';

// Import TokenSearchResult type for compatibility with GeckoTerminal
import { getTrendingTokens as getGeckoTrendingTokens, type TokenSearchResult } from './geckoTerminal.js';
import { fetchTrendingAddresses, isWSSupportedChain } from './dexscreenerWS.js';

export interface DexScreenerToken {
  address: string;
  name: string;
  symbol: string;
  chainId: string;
  network: string; // Add network field for consistency
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv?: number;
  poolAddress?: string; // Add poolAddress (pairAddress)
  pairCreatedAt?: number; // Pair creation timestamp
  imageUrl?: string; // Token logo
  socials?: Array<{ type: string; url: string }>; // Twitter, Discord, etc.
  websites?: Array<{ url: string; label?: string }>; // Official websites
  decimals?: number;
  holders?: number;
}

/**
 * Chain ID mapping for DexScreener API
 */
const CHAIN_ID_MAP: Record<string, string> = {
  'eth': 'ethereum',
  'ethereum': 'ethereum',
  'bsc': 'bsc',
  'base': 'base',
  'arbitrum': 'arbitrum',
  'optimism': 'optimism',
  'polygon': 'polygon',
  'avalanche': 'avalanche',
  'solana': 'solana',
};

const NETWORK_MAP: Record<string, string> = {
  'ethereum': 'eth',
  'bsc': 'bsc',
  'base': 'base',
  'arbitrum': 'arbitrum',
  'optimism': 'optimism',
  'polygon': 'polygon',
  'avalanche': 'avax',
  'solana': 'solana',
};

/**
 * Tokens to exclude from trending lists
 * Includes: native tokens, wrapped tokens, stablecoins
 */
const EXCLUDED_TOKEN_SYMBOLS = new Set([
  // Native & Wrapped tokens
  'ETH', 'WETH', 'WBTC', 'BTC',
  'BNB', 'WBNB',
  'SOL', 'WSOL',
  'MATIC', 'WMATIC', 'POL',
  'AVAX', 'WAVAX',
  'FTM', 'WFTM',
  'OP',
  'ARB',
  // Stablecoins
  'USDT', 'USDC', 'USDC.e', 'USDbC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'USDP', 'GUSD', 'sUSD', 'USDD', 'PYUSD',
  'EURC', 'EURS',
  // Wrapped/Bridged assets
  'cbETH', 'stETH', 'wstETH', 'rETH', 'frxETH', 'sfrxETH', 'cbBTC', 'tBTC',
  // Common LP/receipt tokens
  'aUSDC', 'aUSDT', 'cUSDC', 'cUSDT',
]);

// Some tokens have unique addresses we should also filter
const EXCLUDED_TOKEN_ADDRESSES = new Set([
  // ETH zero address placeholder
  '0x0000000000000000000000000000000000000000',
  // Base WETH
  '0x4200000000000000000000000000000000000006',
  // Base USDbC
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
  // Base USDC
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  // Base cbBTC
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
  // Ethereum WETH
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  // Ethereum USDC
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  // Ethereum USDT
  '0xdac17f958d2ee523a2206206994597c13d831ec7',
  // BSC WBNB
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  // BSC BUSD
  '0xe9e7cea3dedca5984780bafc599bd69add087d56',
].map(a => a.toLowerCase()));

/**
 * Chain to Trust Wallet blockchain name mapping for fallback images
 */
const CHAIN_TO_TRUSTWALLET: Record<string, string> = {
  'ethereum': 'ethereum',
  'eth': 'ethereum',
  'bsc': 'smartchain',
  'base': 'base',
  'arbitrum': 'arbitrum',
  'polygon': 'polygon',
  'optimism': 'optimism',
  'avalanche': 'avalanchec',
};

/**
 * Get fallback image URL from Trust Wallet assets
 */
function getTrustWalletImageUrl(chainId: string, address: string): string | undefined {
  const twChain = CHAIN_TO_TRUSTWALLET[chainId.toLowerCase()];
  if (!twChain || !address) return undefined;
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${twChain}/assets/${address}/logo.png`;
}

/**
 * Search for tokens
 */
export async function searchTokens(query: string): Promise<DexScreenerToken[]> {
  try {
    const url = `${DEXSCREENER_BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { pairs?: any[] };

    if (!data.pairs || !Array.isArray(data.pairs)) {
      return [];
    }

    return data.pairs.map((pair: any) => {
      const chainId = pair.chainId || '';
      const network = NETWORK_MAP[chainId.toLowerCase()] || chainId.toLowerCase();

      return {
        address: pair.baseToken?.address || '',
        name: pair.baseToken?.name || '',
        symbol: pair.baseToken?.symbol || '',
        chainId: chainId,
        network: network,
        price: parseFloat(pair.priceUsd || '0'),
        priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
        volume24h: parseFloat(pair.volume?.h24 || '0'),
        liquidity: parseFloat(pair.liquidity?.usd || '0'),
        fdv: pair.fdv ? parseFloat(pair.fdv) : undefined,
        poolAddress: pair.pairAddress, // Critical for charts
        socials: pair.info?.socials,
        websites: pair.info?.websites,
      };
    });
  } catch (error) {
    console.error('Error searching tokens on DexScreener:', error);
    return [];
  }
}

/**
 * Get token details by address
 * Returns token info and the most liquid pair address
 */
export async function getTokenDetails(chainId: string, address: string): Promise<DexScreenerToken | null> {
  try {
    const url = `${DEXSCREENER_BASE_URL}/tokens/${address}`;
    console.log(`[DexScreener] Fetching token details: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[DexScreener] HTTP error ${response.status} for ${address}`);
      return null;
    }

    const data = await response.json() as { pairs?: any[] };

    if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
      console.warn(`[DexScreener] No pairs found for ${address}`);
      return null;
    }

    console.log(`[DexScreener] Found ${data.pairs.length} pairs for ${address}`);

    // Get the most liquid pair
    const pair = data.pairs.sort((a: any, b: any) =>
      parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
    )[0];

    // Map network from Dexscreener to our schema
    const network = NETWORK_MAP[chainId.toLowerCase()] || chainId.toLowerCase();

    return {
      address: address,
      name: pair.baseToken?.name || '',
      symbol: pair.baseToken?.symbol || '',
      chainId: chainId,
      network: network,
      price: parseFloat(pair.priceUsd || '0'),
      priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
      volume24h: parseFloat(pair.volume?.h24 || '0'),
      liquidity: parseFloat(pair.liquidity?.usd || '0'),
      fdv: pair.fdv ? parseFloat(pair.fdv) : undefined,
      poolAddress: pair.pairAddress,
      pairCreatedAt: pair.pairCreatedAt, // Pool creation timestamp
      imageUrl: pair.info?.imageUrl || undefined, // Token logo
      socials: pair.info?.socials || [], // Twitter, Discord links
      websites: pair.info?.websites || [], // Official websites
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[DexScreener] Request timeout for ${address}`);
    } else {
      console.error(`[DexScreener] Error fetching token details for ${address}:`, error.message);
    }
    return null;
  }
}

/**
 * Alias for getTokenDetails to match common naming convention
 */
export const getTokenInfo = getTokenDetails;

/**
 * Get pair address for a token (for use with Gecko Terminal chart API)
 * Returns the pair address of the most liquid pair
 */
export async function getTokenPairAddress(
  network: string,
  tokenAddress: string
): Promise<string | null> {
  try {
    console.log(`[DexScreener] Fetching pair address for ${tokenAddress} on ${network}`);

    // Map network to DexScreener chain ID
    const chainId = CHAIN_ID_MAP[network.toLowerCase()] || network.toLowerCase();
    const url = `${DEXSCREENER_BASE_URL}/tokens/${tokenAddress}`;

    console.log(`[DexScreener] Request URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }, // Add User-Agent to avoid Cloudflare 403
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`[DexScreener] API error: ${response.status} ${response.statusText}`, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json() as { pairs?: any[] };

    if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
      console.warn(`[DexScreener] No pairs found for token ${tokenAddress} on ${network}`);
      return null;
    }

    // Filter pairs by chain and get the most liquid one
    const chainPairs = data.pairs.filter((p: any) =>
      p.chainId?.toLowerCase() === chainId.toLowerCase()
    );

    if (chainPairs.length === 0) {
      console.warn(`[DexScreener] No pairs found for chain ${chainId}`);
      return null;
    }

    // Get the most liquid pair
    const bestPair = chainPairs.sort((a: any, b: any) =>
      parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
    )[0];

    // DexScreener pair address is in pairAddress field
    const pairAddress = bestPair.pairAddress;

    if (!pairAddress) {
      console.warn(`[DexScreener] Pair address not found in pair data`);
      return null;
    }

    console.log(`[DexScreener] ✓ Found pair address: ${pairAddress} (liquidity: $${bestPair.liquidity?.usd || 0})`);
    return pairAddress;
  } catch (error: any) {
    console.error(`[DexScreener] Error fetching pair address:`, error.message);
    return null;
  }
}

/**
 * Get trending/popular tokens for a specific chain
 * Uses DexScreener's token-boosts endpoint and filters by chain
 * Returns TokenSearchResult[] for compatibility with GeckoTerminal
 */
export async function getTrendingTokensByChain(
  chainId: string,
  limit: number = 50,
  duration: '5m' | '1h' | '6h' | '24h' = '5m'
): Promise<TokenSearchResult[]> {
  try {
    console.log(`[DexScreener] Fetching trending tokens for chain: ${chainId}, duration: ${duration}`);

    // Map our chain ID to DexScreener's chain ID format
    const dexScreenerChainId = CHAIN_ID_MAP[chainId.toLowerCase()] || chainId.toLowerCase();

    // Map timeframes to DexScreener fields
    const durationMap: Record<string, string> = {
      '5m': 'm5',
      '1h': 'h1',
      '6h': 'h6',
      '24h': 'h24'
    };
    const timeKey = durationMap[duration] || 'h24';

    // Map to store unique tokens with their raw data for scoring
    const tokenCandidates = new Map<string, any>();

    // 1. Get Boosted Tokens (Seed 1)
    try {
      const boostsResponse = await fetch(DEXSCREENER_TOKEN_BOOSTS_URL);
      if (boostsResponse.ok) {
        const boostsData = await boostsResponse.json();
        if (Array.isArray(boostsData)) {
          for (const item of boostsData) {
            if (item.chainId?.toLowerCase() === dexScreenerChainId && item.tokenAddress) {
              // Boosts endpoint doesn't return full stats, so we'll need to fetch them
              // We defer fetching details to the scoring phase to batch or prioritize
              // For now, we add them to candidates. Score will be calculated after fetching details.
              // Actually, efficiency is key. Let's fetch pairwise details later.
              tokenCandidates.set(item.tokenAddress.toLowerCase(), { address: item.tokenAddress, type: 'boost' });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[DexScreener] Failed to fetch boosts', e);
    }

    // 2. Search for High Volume Pairs (Seed 2)
    // We use chain-specific search terms to find organic high volume tokens
    // Include DEX names to find all pairs on major DEXes
    const CHAIN_SEARCH_TERMS: Record<string, string[]> = {
      'ethereum': ['uniswap', 'sushiswap', 'curve', 'WETH', 'USDC', 'USDT',],
      'solana': ['pumpswap', 'raydium', 'orca', 'jupiter', 'meteora', 'SOL', 'USDC', 'USDT',],
      'bsc': ['pancakeswap', 'WBNB', 'USDT', 'CAKE', 'BUSD',],
      'base': ['uniswap', 'aerodrome', 'WETH', 'USDC', 'Zora'],
      'arbitrum': ['uniswap', 'sushiswap', 'gmx', 'WETH', 'USDC', 'ARB', 'GMX',],
      'optimism': ['uniswap', 'velodrome', 'WETH', 'USDC', 'OP', 'VELO',],
      'polygon': ['uniswap', 'quickswap', 'sushiswap', 'WMATIC', 'USDC', 'USDT',],
    };

    const searchTerms = CHAIN_SEARCH_TERMS[dexScreenerChainId] || ['WETH', 'USDC', 'USDT'];

    // Execute searches in parallel
    const searchPromises = searchTerms.map(async (term) => {
      try {
        const searchUrl = `${DEXSCREENER_BASE_URL}/search?q=${term}`;
        const res = await fetch(searchUrl);
        if (!res.ok) return [];
        const data = await res.json() as { pairs?: any[] };
        return data.pairs || [];
      } catch (e) {
        return [];
      }
    });

    const searchResults = await Promise.all(searchPromises);

    // Process search results
    for (const pairs of searchResults) {
      for (const pair of pairs) {
        if (pair.chainId?.toLowerCase() !== dexScreenerChainId) continue;

        const tokenAddress = pair.baseToken?.address;
        if (!tokenAddress) continue;

        // If already exists, we might have better data now (full pair data)
        // Use the pair data directly if available
        if (!tokenCandidates.has(tokenAddress.toLowerCase())) {
          tokenCandidates.set(tokenAddress.toLowerCase(), { address: tokenAddress, pairData: pair, type: 'search' });
        } else {
          // Update existing boost candidate with real pair data if we found it
          const existing = tokenCandidates.get(tokenAddress.toLowerCase());
          if (!existing.pairData) {
            existing.pairData = pair;
          }
        }
      }
    }

    // 3. Enrich Data for Boost-only candidates
    // If we have candidates from Boosts that didn't appear in search (unlikely for top ones, but possible),
    // we need to fetch their data.
    // To save time, we only fetch top 10 boosts if they miss data.
    let boostFetchCount = 0;
    for (const [addr, candidate] of tokenCandidates.entries()) {
      if (!candidate.pairData && candidate.type === 'boost' && boostFetchCount < 10) {
        // Fetch details
        const details = await getTokenPairData(dexScreenerChainId, candidate.address);
        if (details) {
          candidate.pairData = details; // This is TokenSearchResult, slightly different shape but contains key metrics
          // We need to normalize or re-fetch pair specific data if we want strict scoring
          // getTokenPairData internally fetches /tokens/{addr} which returns pairs.
          // Ideally we want the raw pair data.
        }
        boostFetchCount++;
      }
    }

    // 4. Calculate Scores
    const scoredTokens: (TokenSearchResult & { score: number })[] = [];

    for (const candidate of tokenCandidates.values()) {
      const p = candidate.pairData;
      if (!p) continue;

      // Normalize metrics
      // Note: p can be raw pair from search OR TokenSearchResult from getTokenPairData.
      // We need to handle both or ensure consistency.
      // Let's assume raw pair data structure for search results, and map TokenSearchResult back if needed.
      // Actually, getTokenPairData returns formatting consistent with TokenSearchResult.
      // Let's rely on raw pair data structure primarily.

      // Extract metrics based on selected duration
      let volume = 0;
      let txns = 0;
      let liquidity = 0;
      let priceChange = 0;
      let name = '';
      let symbol = '';
      let address = candidate.address;
      let imageUrl = '';
      let price = 0;
      let fdv = 0;
      let poolAddress = '';

      if (p.baseToken) { // Raw pair structure
        volume = parseFloat(p.volume?.[timeKey] || '0');
        txns = (p.txns?.[timeKey]?.buys || 0) + (p.txns?.[timeKey]?.sells || 0);
        liquidity = parseFloat(p.liquidity?.usd || '0');
        priceChange = parseFloat(p.priceChange?.[timeKey] || '0');
        name = p.baseToken.name;
        symbol = p.baseToken.symbol;
        imageUrl = p.info?.imageUrl || '';
        price = parseFloat(p.priceUsd || '0');
        fdv = parseFloat(p.fdv || '0');
        poolAddress = p.pairAddress;
      } else { // TokenSearchResult structure (fallback)
        // Note: TokenSearchResult largely assumes 24h, but we can try to find fields if they existed
        // For now, if enrichment returned limited data, we might be stuck with 24h fallback or need to extend TokenSearchResult
        // But raw pair data (from search) is rich, so most candidates will have full fields.
        volume = typeof p.volume24h === 'number' ? p.volume24h : parseFloat(p.volume24h || '0');
        txns = 0; // We might lose txns in TokenSearchResult interface currently
        liquidity = typeof p.liquidity === 'number' ? p.liquidity : parseFloat(p.liquidity || '0');
        priceChange = typeof p.priceChange24h === 'number' ? p.priceChange24h : parseFloat(p.priceChange24h || '0');
        name = p.name;
        symbol = p.symbol;
        imageUrl = p.imageUrl;
        price = p.price;
        fdv = p.fdv;
        poolAddress = p.poolAddress;
      }

      // Fallback image
      if (!imageUrl) {
        imageUrl = getTrustWalletImageUrl(dexScreenerChainId, address) || '';
      }

      // Scoring Algorithm (Approximate DexScreener Trending Weighting)
      // Logarithmic scale to dampen massive outliers
      const volumeScore = Math.log10(volume + 1) * 40;     // 40% Weight for Volume
      const txnsScore = Math.log10(txns + 1) * 20;         // 20% Weight for Transactions
      const liquidityScore = Math.log10(liquidity + 1) * 10; // 10% Weight for Liquidity (Constant across timeframes)

      // Boost penalty/bonus
      const isBoosted = candidate.type === 'boost';
      const boostMultiplier = isBoosted ? 1.2 : 1.0;

      // Spam filter
      if (liquidity < 1000) continue; // Filter out ultra-low liquidity dust

      // Extract additional fields for complete data
      let priceChange5m: number | undefined;
      let priceChange1h: number | undefined;
      let priceChange6h: number | undefined;
      let poolCreatedAt: string | undefined;
      let buys24h = 0;
      let sells24h = 0;

      if (p.baseToken) { // Raw pair structure - extract all fields
        priceChange5m = p.priceChange?.m5 !== undefined ? parseFloat(p.priceChange.m5) : undefined;
        priceChange1h = p.priceChange?.h1 !== undefined ? parseFloat(p.priceChange.h1) : undefined;
        priceChange6h = p.priceChange?.h6 !== undefined ? parseFloat(p.priceChange.h6) : undefined;
        poolCreatedAt = p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : undefined;
        buys24h = p.txns?.h24?.buys || 0;
        sells24h = p.txns?.h24?.sells || 0;
      }

      const totalScore = (volumeScore + txnsScore + liquidityScore) * boostMultiplier;

      scoredTokens.push({
        address,
        name,
        symbol,
        network: NETWORK_MAP[dexScreenerChainId] || chainId,
        price,
        priceChange5m,
        priceChange1h,
        priceChange6h,
        priceChange24h: priceChange,
        volume24h: volume,
        txns24h: txns,
        buys24h,
        sells24h,
        liquidity,
        fdv,
        imageUrl,
        poolAddress,
        poolCreatedAt,
        socials: p.info?.socials,
        websites: p.info?.websites,
        score: totalScore
      } as any);
    }

    // 5. Sort by Score
    scoredTokens.sort((a, b) => b.score - a.score);

    console.log(`[DexScreener] Processed ${tokenCandidates.size} candidates, returning top ${limit}`);

    return scoredTokens.slice(0, limit);

  } catch (error) {
    console.error('[DexScreener] Error fetching trending tokens:', error);
    return [];
  }
}

/**
 * Helper function to get token pair data and convert to TokenSearchResult
 */
async function getTokenPairData(chainId: string, tokenAddress: string): Promise<TokenSearchResult | null> {
  try {
    const url = `${DEXSCREENER_BASE_URL}/tokens/${tokenAddress}`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json() as { pairs?: any[] };

    if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
      return null;
    }

    // Filter by chain and get the most liquid pair
    const chainPairs = data.pairs.filter((p: any) =>
      p.chainId?.toLowerCase() === chainId.toLowerCase()
    );

    if (chainPairs.length === 0) return null;

    const pair = chainPairs.sort((a: any, b: any) =>
      parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
    )[0];

    return {
      address: tokenAddress,
      name: pair.baseToken?.name || '',
      symbol: pair.baseToken?.symbol || '',
      network: NETWORK_MAP[chainId] || chainId,
      imageUrl: pair.info?.imageUrl || getTrustWalletImageUrl(chainId, tokenAddress),
      price: parseFloat(pair.priceUsd || '0') || undefined,
      priceChange24h: parseFloat(pair.priceChange?.h24 || '0') || undefined,
      volume24h: parseFloat(pair.volume?.h24 || '0') || undefined,
      liquidity: parseFloat(pair.liquidity?.usd || '0') || undefined,
      fdv: pair.fdv ? parseFloat(pair.fdv) : undefined,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get candlestick/OHLCV data from DexScreener
 * DexScreener provides price history in their pair data
 * Note: DexScreener has limited historical data compared to Gecko Terminal
 * Returns data in the same format as Gecko Terminal for consistency
 */
export async function getCandlestickData(
  network: string,
  pairAddress: string,
  timeframe: string = 'h1',
  limit: number = 100
): Promise<any[]> {
  const startTime = Date.now();
  const REQUEST_TIMEOUT = 30000; // 30 seconds

  try {
    console.log(`[DexScreener] ===== Fetching candlestick data =====`);
    console.log(`[DexScreener] Network: ${network}, Pair: ${pairAddress}, Timeframe: ${timeframe}, Limit: ${limit}`);

    // Validate inputs
    if (!network || !pairAddress) {
      throw new Error('Network and pairAddress are required');
    }

    if (limit < 1 || limit > 1000) {
      limit = Math.max(1, Math.min(1000, limit));
      console.warn(`[DexScreener] Limit adjusted to ${limit}`);
    }

    // DexScreener API endpoint for pair data
    // Format: /pairs/{chainId}/{pairAddress}
    const chainId = CHAIN_ID_MAP[network.toLowerCase()] || network.toLowerCase();
    const url = `${DEXSCREENER_BASE_URL}/pairs/${chainId}/${pairAddress}`;

    console.log(`[DexScreener] Request URL: ${url}`);

    // Add timeout to fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`);
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`[DexScreener] API error: ${response.status} ${response.statusText}`, errorText.substring(0, 200));
      return [];
    }

    const data = await response.json() as { pair?: any; pairs?: any[] };

    // DexScreener can return either { pair: {...} } or { pairs: [...] }
    let pair: any = null;
    if (data.pair) {
      pair = data.pair;
    } else if (data.pairs && Array.isArray(data.pairs) && data.pairs.length > 0) {
      // Get the most liquid pair
      pair = data.pairs.sort((a: any, b: any) =>
        parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
      )[0];
    }

    if (!pair) {
      console.warn(`[DexScreener] No pair data found`);
      return [];
    }

    // DexScreener provides price history in priceHistory field
    // Format: array of [timestamp, price] pairs or array of objects
    let priceHistory: any[] = [];

    if (pair.priceHistory && Array.isArray(pair.priceHistory)) {
      priceHistory = pair.priceHistory;
    } else {
      // DexScreener might not have priceHistory field
      // Try to use current price data to create at least one candle
      const currentPrice = parseFloat(pair.priceUsd || '0');
      if (currentPrice > 0) {
        const now = Date.now();
        // Create a simple candle from current price
        priceHistory = [[now, currentPrice]];
        console.log(`[DexScreener] No price history, using current price: ${currentPrice}`);
      } else {
        console.warn(`[DexScreener] No price history available and no current price`);
        return [];
      }
    }

    if (!Array.isArray(priceHistory) || priceHistory.length === 0) {
      console.warn(`[DexScreener] No price history available`);
      return [];
    }

    // Convert price history to OHLCV format
    // Since DexScreener only provides price history (not full OHLCV),
    // we'll create synthetic candles from price data
    const result: any[] = [];

    // Group prices by timeframe
    const timeframeMs: Record<string, number> = {
      'm1': 60 * 1000,
      'm5': 5 * 60 * 1000,
      'm15': 15 * 60 * 1000,
      'm30': 30 * 60 * 1000,
      'h1': 60 * 60 * 1000,
      'h4': 4 * 60 * 60 * 1000,
      'h6': 6 * 60 * 60 * 1000,
      'h12': 12 * 60 * 60 * 1000,
      'd1': 24 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    const intervalMs = timeframeMs[timeframe.toLowerCase()] || 60 * 60 * 1000;

    // Group price points by time interval
    const candles = new Map<number, { prices: number[], timestamps: number[] }>();

    for (const item of priceHistory) {
      let timestamp: number;
      let price: number;

      // Handle different price history formats
      if (Array.isArray(item) && item.length >= 2) {
        // Format: [timestamp, price]
        timestamp = item[0];
        price = item[1];
      } else if (typeof item === 'object' && item.timestamp && item.price) {
        // Format: { timestamp, price }
        timestamp = item.timestamp;
        price = item.price;
      } else {
        continue;
      }

      // Validate data
      if (typeof timestamp !== 'number' || typeof price !== 'number' || isNaN(price) || isNaN(timestamp)) {
        continue;
      }

      // Convert timestamp to milliseconds if it's in seconds
      if (timestamp < 1e12) {
        timestamp = timestamp * 1000;
      }

      // Round timestamp to interval
      const candleTime = Math.floor(timestamp / intervalMs) * intervalMs;

      if (!candles.has(candleTime)) {
        candles.set(candleTime, { prices: [], timestamps: [] });
      }

      const candle = candles.get(candleTime)!;
      candle.prices.push(price);
      candle.timestamps.push(timestamp);
    }

    // Convert to OHLCV format
    const sortedCandles = Array.from(candles.entries()).sort((a, b) => a[0] - b[0]);

    console.log(`[DexScreener] Grouped ${priceHistory.length} price points into ${sortedCandles.length} candles for ${timeframe} timeframe`);

    // Return all candles if we have fewer than requested, otherwise take the most recent
    const candlesToProcess = sortedCandles.length <= limit
      ? sortedCandles
      : sortedCandles.slice(-limit);

    // Validate and normalize candles
    for (const [candleTime, candleData] of candlesToProcess) {
      if (candleData.prices.length === 0) continue;

      const prices = candleData.prices.filter(p => isFinite(p) && p > 0);
      if (prices.length === 0) continue;

      // Sort prices by timestamp to get correct open/close
      const priceWithTime = candleData.prices.map((p, i) => ({
        price: p,
        time: candleData.timestamps[i] || candleTime,
      })).filter(p => isFinite(p.price) && p.price > 0)
        .sort((a, b) => a.time - b.time);

      if (priceWithTime.length === 0) continue;

      const open = priceWithTime[0].price;
      const close = priceWithTime[priceWithTime.length - 1].price;
      const high = Math.max(...priceWithTime.map(p => p.price));
      const low = Math.min(...priceWithTime.map(p => p.price));

      // Validate OHLC
      if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) {
        // Auto-correct
        const maxPrice = Math.max(open, high, low, close);
        const minPrice = Math.min(open, high, low, close);
        const correctedHigh = Math.max(high, maxPrice);
        const correctedLow = Math.min(low, minPrice);

        if (correctedHigh < correctedLow) continue;

        result.push({
          time: Math.floor(candleTime / 1000), // Unix timestamp in seconds
          open: open,
          high: correctedHigh,
          low: correctedLow,
          close: close,
          volume: 0, // DexScreener price history doesn't include volume
        });
      } else {
        result.push({
          time: Math.floor(candleTime / 1000), // Unix timestamp in seconds
          open: open,
          high: high,
          low: low,
          close: close,
          volume: 0, // DexScreener price history doesn't include volume
        });
      }
    }

    // Sort by time to ensure chronological order
    result.sort((a, b) => a.time - b.time);

    // Remove duplicates by time (keep latest)
    const deduplicated: any[] = [];
    const seenTimes = new Set<number>();
    for (let i = result.length - 1; i >= 0; i--) {
      if (!seenTimes.has(result[i].time)) {
        seenTimes.add(result[i].time);
        deduplicated.unshift(result[i]);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[DexScreener] ✓ Generated ${deduplicated.length} candles from ${priceHistory.length} price points (requested ${limit}) in ${duration}ms`);

    if (deduplicated.length === 0 && priceHistory.length > 0) {
      console.warn(`[DexScreener] ⚠ Failed to generate candles from ${priceHistory.length} price points`);
      console.warn(`[DexScreener] Sample price history:`, priceHistory.slice(0, 3));
    }

    // Return all if we have fewer than requested, otherwise take the most recent
    if (deduplicated.length <= limit) {
      return deduplicated;
    }
    return deduplicated.slice(-limit);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[DexScreener] ✗ Error fetching candlestick data after ${duration}ms:`, error.message);
    // Security: Stack trace logging removed in production
    return [];
  }
}

/**
 * Get high-quality trending tokens using DexScreener's boost + pair data
 * This provides better quality than trending_pools from GeckoTerminal
 * 
 * Algorithm:
 * 1. Fetch token boosts (most actively boosted tokens - indicates real interest)
 * 2. Filter by requested chainId
 * 3. Batch enrich with pair data (volume, price, liquidity, txns)
 * 4. Apply quality filters (min liquidity $5000, min volume $1000)
 * 5. Return sorted by boost score + volume weighted
 * 
 * @param chainId - Chain to filter by (e.g., 'solana', 'ethereum', 'base')
 * @param limit - Maximum number of tokens to return (default 50)
 */
export async function getTrendingTokensPremium(
  chainId: string,
  limit: number = 50
): Promise<TokenSearchResult[]> {
  const startTime = Date.now();
  const normalizedChainId = CHAIN_ID_MAP[chainId.toLowerCase()] || chainId.toLowerCase();

  try {
    console.log(`[DexScreener Premium] Fetching trending tokens for chain: ${normalizedChainId}, limit: ${limit}`);

    let trendingAddresses: string[] = [];
    const isWSAvailable = isWSSupportedChain(normalizedChainId);
    const WS_ONLY_CHAINS = new Set(['base', 'bsc']);

    // Note: Solana WebSocket returns binary protobuf data that can't be reliably parsed
    // with regex - extracted addresses are invalid. Skip WebSocket for Solana.
    const useWebSocket = isWSAvailable && WS_ONLY_CHAINS.has(normalizedChainId);

    // Step 1: Try to get trending addresses from WebSocket (Most accurate for EVM chains)
    if (useWebSocket) {
      try {
        // Use 5m trending by default for "Live Trending"
        trendingAddresses = await fetchTrendingAddresses({
          chain: normalizedChainId,
          timeFrame: 'm5',
          rankBy: 'trendingScoreM5'
        });

        if (trendingAddresses.length > 0) {
          console.log(`[DexScreener Premium] Found ${trendingAddresses.length} addresses via WebSocket for ${normalizedChainId}`);
        }
      } catch (wsError: any) {
        console.warn(`[DexScreener Premium] WebSocket fetch failed: ${wsError.message}`);
      }
    }


    // Step 2: Fallback to Boosts + Search if WS fails or is not supported
    if (trendingAddresses.length === 0) {
      console.log(`[DexScreener Premium] Using fallback discovery (Boosts + Organic search)`);

      // Step 2a: Fetch token boosts
      let chainBoosts: any[] = [];
      try {
        const boostsResponse = await fetch(DEXSCREENER_TOKEN_BOOSTS_URL);
        if (boostsResponse.ok) {
          const boostsData = await boostsResponse.json() as any[];
          chainBoosts = boostsData.filter((boost: any) => boost.chainId?.toLowerCase() === normalizedChainId);
        }
      } catch (e) { }

      // Step 2b: Organic high-volume search discovery (Your previous improvement)
      const ORGANIC_SEARCH_TERMS: Record<string, string[]> = {
        'base': ['uniswap', 'aerodrome', 'base', 'weth', 'usdc', 'zora'],
        'ethereum': ['uniswap', 'ethereum', 'weth', 'usdc', 'usdt'],
        'solana': ['raydium', 'jupiter', 'pump', 'sol', 'usdc'],
        'bsc': ['pancakeswap', 'bnb', 'wbnb', 'usdt', 'busd'],
        'arbitrum': ['uniswap', 'gmx', 'arbitrum', 'weth', 'usdc'],
        'optimism': ['uniswap', 'velodrome', 'optimism', 'op', 'usdc'],
        'polygon': ['uniswap', 'quickswap', 'polygon', 'matic', 'usdc', 'usdt'],
      };

      const searchTerms = ORGANIC_SEARCH_TERMS[normalizedChainId] || ['uniswap', 'weth', 'usdc'];
      const organicTokenAddresses = new Set<string>();

      for (const searchTerm of searchTerms) {
        try {
          const searchUrl = `${DEXSCREENER_BASE_URL}/search?q=${searchTerm}`;
          const searchData = await (await fetch(searchUrl)).json() as { pairs?: any[] };
          if (searchData.pairs) {
            for (const pair of searchData.pairs) {
              if (pair.chainId?.toLowerCase() !== normalizedChainId) continue;
              const volume = parseFloat(pair.volume?.h24 || '0');
              const liquidity = parseFloat(pair.liquidity?.usd || '0');
              if (volume > 500000 || (liquidity > 100000 && volume > 50000)) {
                const baseAddr = pair.baseToken?.address?.toLowerCase();
                if (baseAddr) organicTokenAddresses.add(baseAddr);
              }
            }
          }
        } catch (e) { }
      }

      const boostedAddrs = chainBoosts.map(b => b.tokenAddress?.toLowerCase());
      trendingAddresses = [...new Set([...boostedAddrs, ...Array.from(organicTokenAddresses)])].filter(Boolean) as string[];
    }

    if (trendingAddresses.length === 0) {
      console.warn(`[DexScreener Premium] No trending tokens discovered for ${normalizedChainId}`);
      return getTrendingTokensByChain(chainId, limit, '6h');
    }

    // Step 3: Enrich with pair data via HTTP API in batches
    // Fetch more addresses since many may be pool addresses, not tokens
    const tokensToEnrich = trendingAddresses.slice(0, Math.min(limit * 3, 150));
    const enrichedTokensMap = new Map<string, TokenSearchResult>();

    const batchSize = 30;
    for (let i = 0; i < tokensToEnrich.length; i += batchSize) {
      const batch = tokensToEnrich.slice(i, i + batchSize);
      const addressesParam = batch.join(',');

      try {
        const pairUrl = `https://api.dexscreener.com/tokens/v1/${normalizedChainId}/${addressesParam}`;
        const pairResponse = await fetch(pairUrl);
        if (!pairResponse.ok) continue;

        const pairData = await pairResponse.json() as any[];
        if (!Array.isArray(pairData)) continue;

        for (const pair of pairData) {
          const baseTokenAddr = pair.baseToken?.address?.toLowerCase();
          if (!baseTokenAddr) continue;

          // We might get multiple pairs for the same token, keep the most liquid one
          const currentLiquidity = parseFloat(pair.liquidity?.usd || '0');
          const existing = enrichedTokensMap.get(baseTokenAddr);
          const existingLiquidity = typeof existing?.liquidity === 'string'
            ? parseFloat(existing.liquidity)
            : (existing?.liquidity || 0);

          if (!existing || currentLiquidity > existingLiquidity) {
            let imageUrl = pair.info?.imageUrl;
            if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = `https://cdn.dexscreener.com/cms/images/${imageUrl}`;
            }

            const volume24h = parseFloat(pair.volume?.h24 || '0');
            const priceChange24h = parseFloat(pair.priceChange?.h24 || '0');
            const symbol = pair.baseToken?.symbol || 'UNKNOWN';

            // Filter out native tokens, wrapped tokens, and stablecoins
            if (EXCLUDED_TOKEN_SYMBOLS.has(symbol.toUpperCase()) || EXCLUDED_TOKEN_ADDRESSES.has(baseTokenAddr)) {
              continue;
            }

            // Quality filter: Minimum liquidity $5000 or Volume $1000
            if (currentLiquidity < 5000 && volume24h < 1000) continue;

            enrichedTokensMap.set(baseTokenAddr, {
              address: pair.baseToken?.address || baseTokenAddr,
              name: pair.baseToken?.name || 'Unknown',
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              network: normalizedChainId,
              price: parseFloat(pair.priceUsd || '0'),
              priceChange24h,
              volume24h,
              liquidity: currentLiquidity,
              fdv: parseFloat(pair.fdv || '0'),
              poolAddress: pair.pairAddress,
              poolCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined,
              imageUrl: imageUrl || getTrustWalletImageUrl(normalizedChainId, baseTokenAddr),
              txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
              buys24h: pair.txns?.h24?.buys || 0,
              sells24h: pair.txns?.h24?.sells || 0,
              priceChange5m: parseFloat(pair.priceChange?.m5 || '0'),
              priceChange1h: parseFloat(pair.priceChange?.h1 || '0'),
              priceChange6h: parseFloat(pair.priceChange?.h6 || '0'),
              socials: pair.info?.socials,
              websites: pair.info?.websites,
            });
          }
        }
      } catch (batchError) {
        console.error(`[DexScreener Premium] Batch fetch error:`, batchError);
      }
    }

    // Step 4: Re-collect tokens and maintain trending order
    // trendingAddresses contains the sequence from DexScreener WebSocket
    const finalTokens: TokenSearchResult[] = [];
    for (const addr of trendingAddresses) {
      const token = enrichedTokensMap.get(addr.toLowerCase());
      if (token) {
        finalTokens.push(token);
        if (finalTokens.length >= limit) break;
      }
    }

    // Step 5: Fill with fallback tokens if we don't have enough
    if (finalTokens.length < limit) {
      console.log(`[DexScreener Premium] Only ${finalTokens.length} tokens from WebSocket, filling to ${limit}...`);
      try {
        const fallbackTokens = await getTrendingTokensByChain(chainId, limit, '6h');
        const existingAddresses = new Set(finalTokens.map(t => t.address.toLowerCase()));

        for (const token of fallbackTokens) {
          if (finalTokens.length >= limit) break;
          if (!existingAddresses.has(token.address.toLowerCase())) {
            finalTokens.push(token);
            existingAddresses.add(token.address.toLowerCase());
          }
        }
        console.log(`[DexScreener Premium] Filled to ${finalTokens.length} tokens with fallback`);
      } catch (fallbackError) {
        console.warn(`[DexScreener Premium] Fallback fill error:`, fallbackError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[DexScreener Premium] ✓ Found ${finalTokens.length} trending tokens for ${normalizedChainId} in ${duration}ms`);

    // Step 6: Deduplicate by symbol (keep highest liquidity to filter out copycats)
    // This prevents confusion when copycat tokens have the same symbol as official ones
    const symbolMap = new Map<string, TokenSearchResult>();
    for (const token of finalTokens) {
      const sym = (token.symbol || '').toUpperCase();
      if (!sym) continue;

      const existing = symbolMap.get(sym);
      const tokenLiq = typeof token.liquidity === 'number' ? token.liquidity : 0;
      const existingLiq = existing ? (typeof existing.liquidity === 'number' ? existing.liquidity : 0) : 0;

      if (!existing || tokenLiq > existingLiq) {
        symbolMap.set(sym, token);
      }
    }

    let deduplicatedTokens = Array.from(symbolMap.values());
    const removedCount = finalTokens.length - deduplicatedTokens.length;
    if (removedCount > 0) {
      console.log(`[DexScreener Premium] Removed ${removedCount} duplicate-symbol tokens (kept highest liquidity)`);
    }

    // Step 7: Backfill after symbol-dedupe to try to reach requested limit
    if (deduplicatedTokens.length < limit) {
      const existingAddresses = new Set(deduplicatedTokens.map(t => t.address.toLowerCase()));

      try {
        const fallbackTokens = await getTrendingTokensByChain(chainId, limit, '6h');
        for (const token of fallbackTokens) {
          if (deduplicatedTokens.length >= limit) break;
          if (!existingAddresses.has(token.address.toLowerCase())) {
            deduplicatedTokens.push(token);
            existingAddresses.add(token.address.toLowerCase());
          }
        }
      } catch (fallbackError) {
        console.warn(`[DexScreener Premium] Post-dedupe DexScreener fill error:`, fallbackError);
      }

      if (deduplicatedTokens.length < limit) {
        try {
          const geckoTokens = await getGeckoTrendingTokens(chainId, limit, '5m', 1000);
          for (const token of geckoTokens) {
            if (deduplicatedTokens.length >= limit) break;
            if (!existingAddresses.has(token.address.toLowerCase())) {
              deduplicatedTokens.push(token);
              existingAddresses.add(token.address.toLowerCase());
            }
          }
        } catch (geckoError) {
          console.warn(`[DexScreener Premium] Post-dedupe Gecko fill error:`, geckoError);
        }
      }
    }

    return deduplicatedTokens;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[DexScreener Premium] ✗ Global error after ${duration}ms:`, error.message);
    return getTrendingTokensByChain(chainId, limit, '6h');
  }
}

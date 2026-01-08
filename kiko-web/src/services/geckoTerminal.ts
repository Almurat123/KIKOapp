/**
 * Gecko Terminal API Service (Enhanced)
 * Documentation: https://docs.geckoterminal.com/
 */

const GECKO_TERMINAL_BASE_URL = 'https://api.geckoterminal.com/api/v2';

/**
 * Request timeout in milliseconds (30 seconds)
 */
const REQUEST_TIMEOUT = 30000;

/**
 * Maximum number of retries
 */
const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (in milliseconds)
 */
const BASE_RETRY_DELAY = 1000;

/**
 * Custom error types for better error handling
 */
export class GeckoTerminalError extends Error {
  public readonly type: 'network' | 'api' | 'data' | 'timeout';
  public readonly statusCode?: number;
  public readonly originalError?: any;

  constructor(
    message: string,
    type: 'network' | 'api' | 'data' | 'timeout',
    statusCode?: number,
    originalError?: any
  ) {
    super(message);
    this.name = 'GeckoTerminalError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        // Check if it's a timeout
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
          throw new GeckoTerminalError(
            `Request timeout after ${REQUEST_TIMEOUT}ms`,
            'timeout',
            undefined,
            fetchError
          );
        }
        throw fetchError;
      }
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain errors
      if (error instanceof GeckoTerminalError && error.type === 'timeout') {
        // For timeout, retry with exponential backoff
        if (attempt < retries) {
          const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
          console.log(`[fetchWithRetry] Attempt ${attempt + 1} failed (timeout), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // Check if it's a network error (should retry)
      if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ENOTFOUND')
      ) {
        if (attempt < retries) {
          const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
          console.log(`[fetchWithRetry] Attempt ${attempt + 1} failed (network error), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new GeckoTerminalError(
          `Network error after ${retries + 1} attempts: ${error.message}`,
          'network',
          undefined,
          error
        );
      }

      // For other errors, don't retry
      throw error;
    }
  }

  // If we get here, all retries failed
  throw lastError;
}

export interface TokenSearchResult {
  address: string;
  name: string;
  symbol: string;
  network: string;
  imageUrl?: string;        // Token logo/avatar URL
  poolCreatedAt?: string;   // Pool creation timestamp (ISO string)
  poolAddress?: string;     // Pool address for chart data
  poolId?: string;          // Full pool ID (network_address)
  price?: number;
  priceChange24h?: number;
  priceChange5m?: number;   // 5 minutes
  priceChange1h?: number;   // 1 hour
  priceChange6h?: number;   // 6 hours
  volume24h?: number;
  txns24h?: number;         // 24h transaction count
  buys24h?: number;         // 24h buy count
  sells24h?: number;        // 24h sell count
  liquidity?: number;
  fdv?: number;
}

/**
 * Chain to Trust Wallet blockchain name mapping
 * Used to construct fallback image URLs from Trust Wallet assets
 */
const CHAIN_TO_TRUSTWALLET: Record<string, string> = {
  'eth': 'ethereum',
  'ethereum': 'ethereum',
  'bsc': 'smartchain',
  'base': 'base',
  'arbitrum': 'arbitrum',
  'polygon': 'polygon',
  'optimism': 'optimism',
  'avalanche': 'avalanchec',
};

/**
 * Get fallback image URL from Trust Wallet assets
 * Format: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{address}/logo.png
 */
function getTrustWalletImageUrl(network: string, address: string): string | undefined {
  const twChain = CHAIN_TO_TRUSTWALLET[network.toLowerCase()];
  if (!twChain || !address) return undefined;

  // Checksum the address for ETH-compatible chains
  const checksumAddress = address; // In production, should use ethers.getAddress() for checksum
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${twChain}/assets/${checksumAddress}/logo.png`;
}

/**
 * Search for tokens
 * Gecko Terminal search endpoint returns pools, we extract unique tokens from pools
 */
export async function searchTokens(query: string, network?: string): Promise<TokenSearchResult[]> {
  try {
    // Use search/pools endpoint which works better for general search
    const url = `${GECKO_TERMINAL_BASE_URL}/search/pools?query=${encodeURIComponent(query)}`;

    const response = await fetchWithRetry(url);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    // Extract unique tokens from pools (use base_token from each pool)
    const tokenMap = new Map<string, TokenSearchResult>();

    for (const item of data.data) {
      const attributes = item.attributes || {};
      const baseToken = attributes.base_token || {};

      // Use base token address as key to avoid duplicates
      const tokenAddress = baseToken.address;
      if (!tokenAddress) continue;

      // Skip if already added (prefer pools with higher liquidity)
      if (tokenMap.has(tokenAddress.toLowerCase())) {
        const existing = tokenMap.get(tokenAddress.toLowerCase())!;
        const currentLiquidity = attributes.reserve_in_usd || 0;
        const existingLiquidity = existing.liquidity || 0;

        // Keep the one with higher liquidity
        if (currentLiquidity <= existingLiquidity) continue;
      }

      // Extract price changes for different timeframes
      const priceChange = attributes.price_change_percentage || {};

      // Parse price changes - use the exact values from API
      const priceChange5m = priceChange.m5 !== undefined && priceChange.m5 !== null
        ? parseFloat(String(priceChange.m5))
        : undefined;
      const priceChange1h = priceChange.h1 !== undefined && priceChange.h1 !== null
        ? parseFloat(String(priceChange.h1))
        : undefined;
      const priceChange6h = priceChange.h6 !== undefined && priceChange.h6 !== null
        ? parseFloat(String(priceChange.h6))
        : undefined;
      const priceChange24h = priceChange.h24 !== undefined && priceChange.h24 !== null
        ? parseFloat(String(priceChange.h24))
        : undefined;

      tokenMap.set(tokenAddress.toLowerCase(), {
        address: tokenAddress,
        name: baseToken.name || '',
        symbol: baseToken.symbol || '',
        network: attributes.network || network || '',
        price: attributes.base_token_price_usd,
        priceChange5m: priceChange5m,
        priceChange1h: priceChange1h,
        priceChange6h: priceChange6h,
        priceChange24h: priceChange24h,
        volume24h: attributes.volume_usd?.h24,
        liquidity: attributes.reserve_in_usd,
        fdv: attributes.fdv_usd,
      });
    }

    return Array.from(tokenMap.values());
  } catch (error) {
    console.error('Error searching tokens:', error);
    return [];
  }
}

/**
 * Get token details by address
 * First try to get token info, then get pool data for price/volume
 */
export async function getTokenDetails(network: string, address: string): Promise<TokenSearchResult | null> {


  try {
    // Map network names to Gecko Terminal format
    const networkMap: Record<string, string> = {
      'sol': 'solana',
      'solana': 'solana',
      'eth': 'eth',
      'ethereum': 'eth',
      'bsc': 'bsc',
      'base': 'base',
      'arbitrum': 'arbitrum',
      'optimism': 'optimism',
      'polygon': 'polygon',
      'avax': 'avalanche',
      'avalanche': 'avalanche',
      'fantom': 'fantom',
    };

    const geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();

    // Special handling for Solana addresses
    // Solana addresses are base58 encoded and typically 32-44 characters
    const isSolana = geckoNetwork === 'solana' || network.toLowerCase() === 'sol';
    if (isSolana) {
      // Validate Solana address format (base58, typically 32-44 chars)
      if (!address || address.length < 32 || address.length > 44) {
      }
    }

    // First, get pools for this token to find the most liquid pool
    const poolsUrl = `${GECKO_TERMINAL_BASE_URL}/networks/${geckoNetwork}/tokens/${address}/pools`;


    const poolsResponse = await fetchWithRetry(poolsUrl, {
      headers: { 'Accept': 'application/json' },
    });


    if (!poolsResponse.ok) {
      const errorText = await poolsResponse.text().catch(() => '');
      console.error(`[getTokenDetails] GeckoTerminal API error:`, {
        status: poolsResponse.status,
        statusText: poolsResponse.statusText,
        error: errorText.substring(0, 500),
        url: poolsUrl,
      });
      return null;
    }

    const poolsData = await poolsResponse.json();

    console.log(`[getTokenDetails] Pools data:`, {
      hasData: !!poolsData.data,
      isArray: Array.isArray(poolsData.data),
      dataLength: poolsData.data?.length || 0,
      hasErrors: !!poolsData.errors,
      errors: poolsData.errors,
    });

    if (!poolsData.data || !Array.isArray(poolsData.data) || poolsData.data.length === 0) {
      return null;
    }

    // Get the most liquid pool
    const pools = poolsData.data.sort((a: any, b: any) => {
      const liquidityA = a.attributes?.reserve_in_usd || 0;
      const liquidityB = b.attributes?.reserve_in_usd || 0;
      return liquidityB - liquidityA;
    });


    const bestPool = pools[0];
    const attributes = bestPool.attributes || {};
    const baseToken = attributes.base_token || {};
    const poolId = bestPool.id;

    // Determine if the queried token is base or quote token
    const relationships = bestPool.relationships || {};
    const baseTokenData = relationships.base_token?.data;
    const quoteTokenData = relationships.quote_token?.data;
    const isBaseToken = baseTokenData?.id?.toLowerCase().endsWith(address.toLowerCase());
    const isQuoteToken = quoteTokenData?.id?.toLowerCase().endsWith(address.toLowerCase());

    console.log(`[getTokenDetails] Best pool info:`, {
      poolId: poolId,
      hasAddress: !!attributes.address,
      address: attributes.address,
      liquidity: attributes.reserve_in_usd,
      baseToken: baseToken.symbol || baseToken.name || 'unknown',
      isBaseToken,
      isQuoteToken,
      baseTokenPrice: attributes.base_token_price_usd,
      quoteTokenPrice: attributes.quote_token_price_usd,
      tokenPrice: attributes.token_price_usd,
    });

    // Extract pool address from pool ID or attributes
    // For Solana, pool ID format is typically: solana_<pool_address>
    // Pool address might be in attributes.address or extracted from poolId
    let poolAddress: string | undefined;

    if (attributes.address) {
      poolAddress = attributes.address;
    } else if (poolId && poolId.includes('_')) {
      // Pool ID format: network_address (e.g., "solana_HFW7xAgagD7GEL1fd9wTc8MywTU4YRSjxidmMzZbDDgY")
      const parts = poolId.split('_');
      if (parts.length >= 2) {
        // For Solana, the address is everything after the first underscore
        // For other networks, it might be different
        poolAddress = parts.slice(1).join('_');

        // For Solana, validate the extracted address format
        if (isSolana && poolAddress) {
          if (poolAddress.length < 32 || poolAddress.length > 44) {
          }
        }
      }
    } else if (poolId) {
      // Some networks might use poolId directly as address
      poolAddress = poolId;
    } else {
    }

    // Extract price changes for different timeframes
    const priceChange = attributes.price_change_percentage || {};

    // Parse price changes - use the exact values from API
    const priceChange5m = priceChange.m5 !== undefined && priceChange.m5 !== null
      ? parseFloat(String(priceChange.m5))
      : undefined;
    const priceChange1h = priceChange.h1 !== undefined && priceChange.h1 !== null
      ? parseFloat(String(priceChange.h1))
      : undefined;
    const priceChange6h = priceChange.h6 !== undefined && priceChange.h6 !== null
      ? parseFloat(String(priceChange.h6))
      : undefined;
    const priceChange24h = priceChange.h24 !== undefined && priceChange.h24 !== null
      ? parseFloat(String(priceChange.h24))
      : undefined;

    // CRITICAL FIX: Use correct price field based on token position in pool
    // token_price_usd is the most reliable field (always the queried token's price)
    // Fallback to base_token_price_usd or quote_token_price_usd based on token position
    let tokenPrice: number | undefined;

    // Priority 1: token_price_usd (always correct for the queried token)
    if (attributes.token_price_usd !== undefined && attributes.token_price_usd !== null) {
      tokenPrice = parseFloat(String(attributes.token_price_usd));
    }
    // Priority 2: Check if queried token is quote token
    else if (isQuoteToken && attributes.quote_token_price_usd !== undefined && attributes.quote_token_price_usd !== null) {
      tokenPrice = parseFloat(String(attributes.quote_token_price_usd));
    }
    // Priority 3: Check if queried token is base token
    else if (isBaseToken && attributes.base_token_price_usd !== undefined && attributes.base_token_price_usd !== null) {
      tokenPrice = parseFloat(String(attributes.base_token_price_usd));
    }
    // Priority 4: Fallback to quote_token_price_usd (for stablecoins like USDC)
    else if (attributes.quote_token_price_usd !== undefined && attributes.quote_token_price_usd !== null) {
      tokenPrice = parseFloat(String(attributes.quote_token_price_usd));
    }
    // Priority 5: Last resort - base_token_price_usd (may be wrong)
    else if (attributes.base_token_price_usd !== undefined && attributes.base_token_price_usd !== null) {
      tokenPrice = parseFloat(String(attributes.base_token_price_usd));
    } else {
    }

    return {
      address: address,
      name: baseToken.name || '',
      symbol: baseToken.symbol || '',
      network: network, // Keep original network name for consistency
      poolAddress: poolAddress,
      poolId: poolId,
      price: tokenPrice,
      priceChange5m: priceChange5m,
      priceChange1h: priceChange1h,
      priceChange6h: priceChange6h,
      priceChange24h: priceChange24h,
      volume24h: attributes.volume_usd?.h24,
      liquidity: attributes.reserve_in_usd,
      fdv: attributes.fdv_usd,
    };
  } catch (error: any) {
    return null;
  }
}

/**
 * Minimum liquidity threshold to filter out spam/fake tokens
 * Tokens with less than $10,000 liquidity are likely spam or manipulation
 */
const MIN_LIQUIDITY_USD = 10000;

/**
 * Supported trending durations
 */
export type TrendingDuration = '5m' | '1h' | '6h' | '24h';

/**
 * Get trending tokens for a network
 * Uses GeckoTerminal's trending_pools endpoint for quality data
 * Filters out low-liquidity tokens to avoid spam/manipulation
 * 
 * @param network - Network identifier (eth, base, bsc, arbitrum, etc.)
 * @param limit - Maximum number of tokens to return
 * @param duration - Trending duration: '5m', '1h', '6h', '24h' (default: '24h')
 */
export async function getTrendingTokens(
  network: string = 'eth',
  limit: number = 50,
  duration: TrendingDuration = '24h'
): Promise<TokenSearchResult[]> {
  try {
    console.log(`[GeckoTerminal] Fetching TRENDING tokens for network: ${network}, limit: ${limit}, duration: ${duration}`);

    // Map network name to Gecko Terminal network identifier
    const networkMap: Record<string, string> = {
      'eth': 'eth',
      'ethereum': 'eth',
      'bsc': 'bsc',
      'solana': 'solana',
      'base': 'base',
      'arbitrum': 'arbitrum',
      'optimism': 'optimism',
      'polygon': 'polygon',
      'avax': 'avalanche',
      'avalanche': 'avalanche',
    };

    const geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();

    // Extract unique tokens from trending pools
    const tokenMap = new Map<string, TokenSearchResult>();
    const maxPages = 5; // Fetch up to 5 pages to get enough unique tokens

    for (let page = 1; page <= maxPages && tokenMap.size < limit; page++) {
      // Use trending_pools endpoint with duration parameter
      // Supported durations: 5m, 1h, 6h, 24h
      const url = `${GECKO_TERMINAL_BASE_URL}/networks/${geckoNetwork}/trending_pools?page=${page}&include=base_token&duration=${duration}`;

      console.log(`[GeckoTerminal] Requesting trending page ${page} (${duration}): ${url}`);

      const response = await fetchWithRetry(url);

      if (!response.ok) {
        console.error(`[GeckoTerminal] API error on page ${page}: ${response.status} ${response.statusText}`);
        break; // Stop if we hit an error
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.log(`[GeckoTerminal] No more pools on page ${page}`);
        break; // No more data
      }

      // Build a map of tokens from included array for quick lookup
      const tokenMapById = new Map<string, any>();
      if (data.included && Array.isArray(data.included)) {
        for (const includedItem of data.included) {
          if (includedItem.type === 'token' && includedItem.id) {
            tokenMapById.set(includedItem.id, includedItem.attributes || {});
          }
        }
      }

      // Process pools from this page
      for (const item of data.data) {
        if (tokenMap.size >= limit) break; // We have enough tokens

        const attributes = item.attributes || {};
        const relationships = item.relationships || {};

        // Get base_token from relationships
        let baseToken: any = null;

        if (relationships.base_token?.data?.id) {
          const baseTokenId = relationships.base_token.data.id;
          baseToken = tokenMapById.get(baseTokenId);

          if (!baseToken) continue;
        } else {
          continue;
        }

        const tokenAddress = baseToken.address;
        if (!tokenAddress) continue;

        // Filter out low-liquidity tokens (likely spam or manipulation)
        const liquidity = parseFloat(attributes.reserve_in_usd) || 0;
        if (liquidity < MIN_LIQUIDITY_USD) {
          console.log(`[GeckoTerminal] Skipping ${baseToken.symbol} - low liquidity: $${liquidity.toFixed(2)}`);
          continue;
        }

        // Skip if already added (prefer pools with higher liquidity for same token)
        if (tokenMap.has(tokenAddress.toLowerCase())) {
          const existing = tokenMap.get(tokenAddress.toLowerCase())!;
          const existingLiquidity = existing.liquidity || 0;

          // Keep the one with higher liquidity
          if (liquidity <= existingLiquidity) continue;
        }

        // Extract price changes for different timeframes
        const priceChange = attributes.price_change_percentage || {};

        // Parse price changes - use the exact values from API
        // Note: "0" is a valid value (means no change in that timeframe)
        const priceChange5m = priceChange.m5 !== undefined && priceChange.m5 !== null
          ? parseFloat(String(priceChange.m5))
          : undefined;
        const priceChange1h = priceChange.h1 !== undefined && priceChange.h1 !== null
          ? parseFloat(String(priceChange.h1))
          : undefined;
        const priceChange6h = priceChange.h6 !== undefined && priceChange.h6 !== null
          ? parseFloat(String(priceChange.h6))
          : undefined;
        const priceChange24h = priceChange.h24 !== undefined && priceChange.h24 !== null
          ? parseFloat(String(priceChange.h24))
          : undefined;

        // Get image URL: first try GeckoTerminal, then fallback to Trust Wallet
        const imageUrl = baseToken.image_url || getTrustWalletImageUrl(geckoNetwork, tokenAddress);

        // Get transaction counts
        const txns = attributes.transactions || {};
        const buys24h = txns.h24?.buys || 0;
        const sells24h = txns.h24?.sells || 0;
        const txns24h = buys24h + sells24h;

        tokenMap.set(tokenAddress.toLowerCase(), {
          address: tokenAddress,
          name: baseToken.name || '',
          symbol: baseToken.symbol || '',
          network: geckoNetwork,
          imageUrl: imageUrl,
          poolCreatedAt: attributes.pool_created_at,
          price: attributes.base_token_price_usd,
          priceChange5m: priceChange5m,
          priceChange1h: priceChange1h,
          priceChange6h: priceChange6h,
          priceChange24h: priceChange24h,
          volume24h: attributes.volume_usd?.h24,
          txns24h: txns24h,
          buys24h: buys24h,
          sells24h: sells24h,
          liquidity: attributes.reserve_in_usd,
          fdv: attributes.fdv_usd,
        });
      }

      console.log(`[GeckoTerminal] Page ${page}: Found ${data.data.length} pools, ${tokenMap.size} unique tokens so far`);

      // Add a small delay between requests to avoid rate limiting
      if (page < maxPages && tokenMap.size < limit) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Keep trending order (trending_pools already returns in trending order)
    // Convert Map to array while preserving insertion order
    const tokens = Array.from(tokenMap.values());

    console.log(`[GeckoTerminal] Extracted ${tokens.length} trending tokens (filtered by liquidity >= $${MIN_LIQUIDITY_USD})`);

    // Return up to limit tokens, keeping trending order
    const result = tokens.slice(0, limit);
    console.log(`[GeckoTerminal] Returning ${result.length} tokens (requested: ${limit})`);
    return result;
  } catch (error) {
    console.error('[GeckoTerminal] Error fetching trending tokens:', error);
    if (error instanceof Error) {
      console.error('[GeckoTerminal] Error details:', error.message);
      console.error('[GeckoTerminal] Stack:', error.stack);
    }
    return [];
  }
}

/**
 * DEX ID mapping for different chains
 * Used to construct the correct DEX ID for GeckoTerminal API
 */
const DEX_ID_MAP: Record<string, Record<string, string>> = {
  'base': {
    'uniswap': 'uniswap-v3-base',
    'uniswap_v3': 'uniswap-v3-base',
    'uniswap-v3': 'uniswap-v3-base',
    'aerodrome': 'aerodrome-base',
    'pancakeswap': 'pancakeswap-v3-base',
  },
  'eth': {
    'uniswap': 'uniswap_v3',
    'uniswap_v3': 'uniswap_v3',
    'uniswap-v3': 'uniswap_v3',
    'sushiswap': 'sushiswap',
  },
  'arbitrum': {
    'uniswap': 'uniswap-v3-arbitrum',
    'uniswap_v3': 'uniswap-v3-arbitrum',
    'uniswap-v3': 'uniswap-v3-arbitrum',
    'camelot': 'camelot-v3',
  },
  'solana': {
    'raydium': 'raydium',
    'orca': 'orca',
    'meteora': 'meteora',
  },
  'bsc': {
    'pancakeswap': 'pancakeswap-v3-bsc',
    'uniswap': 'uniswap-v3-bsc',
  },
};

/**
 * Sort options for pools by DEX endpoint
 */
export type PoolSortOption = 'h24_volume_usd_desc' | 'h24_tx_count_desc';

/**
 * Get pools for a specific DEX on a network
 * Uses GeckoTerminal's /networks/{network}/dexes/{dex}/pools endpoint
 * 
 * @param network - Network identifier (eth, base, bsc, arbitrum, solana)
 * @param dex - DEX identifier (uniswap, pancakeswap, raydium, etc.)
 * @param limit - Maximum number of tokens to return
 * @param sortBy - Sort option: 'h24_volume_usd_desc' or 'h24_tx_count_desc'
 */
export async function getPoolsByDex(
  network: string = 'base',
  dex: string = 'uniswap',
  limit: number = 50,
  sortBy: PoolSortOption = 'h24_volume_usd_desc'
): Promise<TokenSearchResult[]> {
  try {
    console.log(`[GeckoTerminal] Fetching pools for DEX: ${dex} on network: ${network}, limit: ${limit}`);

    // Map network name to Gecko Terminal network identifier
    const networkMap: Record<string, string> = {
      'eth': 'eth',
      'ethereum': 'eth',
      'bsc': 'bsc',
      'solana': 'solana',
      'base': 'base',
      'arbitrum': 'arbitrum',
      'optimism': 'optimism',
      'polygon': 'polygon',
      'avax': 'avalanche',
      'avalanche': 'avalanche',
    };

    const geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();

    // Get DEX ID for the network
    const dexLower = dex.toLowerCase();
    const networkDexMap = DEX_ID_MAP[geckoNetwork] || {};
    const dexId = networkDexMap[dexLower] || dexLower;

    console.log(`[GeckoTerminal] Using DEX ID: ${dexId} for network: ${geckoNetwork}`);

    // Extract unique tokens from pools
    const tokenMap = new Map<string, TokenSearchResult>();
    const maxPages = 3; // Fetch up to 3 pages

    for (let page = 1; page <= maxPages && tokenMap.size < limit; page++) {
      const url = `${GECKO_TERMINAL_BASE_URL}/networks/${geckoNetwork}/dexes/${dexId}/pools?page=${page}&include=base_token&sort=${sortBy}`;

      console.log(`[GeckoTerminal] Requesting DEX pools page ${page}: ${url}`);

      const response = await fetchWithRetry(url);

      if (!response.ok) {
        console.error(`[GeckoTerminal] API error on page ${page}: ${response.status} ${response.statusText}`);
        break;
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.log(`[GeckoTerminal] No more pools on page ${page}`);
        break;
      }

      // Build a map of tokens from included array for quick lookup
      const tokenMapById = new Map<string, any>();
      if (data.included && Array.isArray(data.included)) {
        for (const includedItem of data.included) {
          if (includedItem.type === 'token' && includedItem.id) {
            tokenMapById.set(includedItem.id, includedItem.attributes || {});
          }
        }
      }

      // Process pools from this page
      for (const item of data.data) {
        if (tokenMap.size >= limit) break;

        const attributes = item.attributes || {};
        const relationships = item.relationships || {};

        // Get base_token from relationships
        let baseToken: any = null;

        if (relationships.base_token?.data?.id) {
          const baseTokenId = relationships.base_token.data.id;
          baseToken = tokenMapById.get(baseTokenId);

          if (!baseToken) continue;
        } else {
          continue;
        }

        const tokenAddress = baseToken.address;
        if (!tokenAddress) continue;

        // Filter out low-liquidity tokens
        const liquidity = parseFloat(attributes.reserve_in_usd) || 0;
        if (liquidity < MIN_LIQUIDITY_USD) {
          continue;
        }

        // Skip if already added (prefer pools with higher liquidity)
        if (tokenMap.has(tokenAddress.toLowerCase())) {
          const existing = tokenMap.get(tokenAddress.toLowerCase())!;
          const existingLiquidity = existing.liquidity || 0;
          if (liquidity <= existingLiquidity) continue;
        }

        // Extract price changes
        const priceChange = attributes.price_change_percentage || {};
        const priceChange5m = priceChange.m5 !== undefined && priceChange.m5 !== null
          ? parseFloat(String(priceChange.m5))
          : undefined;
        const priceChange1h = priceChange.h1 !== undefined && priceChange.h1 !== null
          ? parseFloat(String(priceChange.h1))
          : undefined;
        const priceChange6h = priceChange.h6 !== undefined && priceChange.h6 !== null
          ? parseFloat(String(priceChange.h6))
          : undefined;
        const priceChange24h = priceChange.h24 !== undefined && priceChange.h24 !== null
          ? parseFloat(String(priceChange.h24))
          : undefined;

        // Get image URL
        const imageUrl = baseToken.image_url || getTrustWalletImageUrl(geckoNetwork, tokenAddress);

        // Get transaction counts
        const txns = attributes.transactions || {};
        const buys24h = txns.h24?.buys || 0;
        const sells24h = txns.h24?.sells || 0;
        const txns24h = buys24h + sells24h;

        tokenMap.set(tokenAddress.toLowerCase(), {
          address: tokenAddress,
          name: baseToken.name || '',
          symbol: baseToken.symbol || '',
          network: geckoNetwork,
          imageUrl: imageUrl,
          poolCreatedAt: attributes.pool_created_at,
          price: attributes.base_token_price_usd,
          priceChange5m: priceChange5m,
          priceChange1h: priceChange1h,
          priceChange6h: priceChange6h,
          priceChange24h: priceChange24h,
          volume24h: attributes.volume_usd?.h24,
          txns24h: txns24h,
          buys24h: buys24h,
          sells24h: sells24h,
          liquidity: attributes.reserve_in_usd,
          fdv: attributes.fdv_usd,
        });
      }

      console.log(`[GeckoTerminal] DEX pools page ${page}: Found ${data.data.length} pools, ${tokenMap.size} unique tokens so far`);

      // Small delay between requests
      if (page < maxPages && tokenMap.size < limit) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const tokens = Array.from(tokenMap.values());
    console.log(`[GeckoTerminal] Extracted ${tokens.length} tokens from ${dex} on ${network}`);

    return tokens.slice(0, limit);
  } catch (error) {
    console.error('[GeckoTerminal] Error fetching pools by DEX:', error);
    if (error instanceof Error) {
      console.error('[GeckoTerminal] Error details:', error.message);
    }
    return [];
  }
}

/**
 * Aggregate candles to a different timeframe
 * e.g., aggregate minute candles to 5-minute or 15-minute candles
 */
function aggregateCandles(
  candles: any[],
  targetTimeframe: string,
  sourceTimeframe: string
): any[] {
  if (candles.length === 0) {
    console.warn(`[aggregateCandles] Empty input candles array`);
    return [];
  }

  // Calculate aggregation ratio
  const timeframeSeconds: Record<string, number> = {
    'm1': 60, 'm5': 300, 'm15': 900, 'm30': 1800,
    'h1': 3600, 'h4': 14400, 'h6': 21600, 'h12': 43200,
    'd1': 86400, '24h': 86400,
  };

  const sourceSeconds: Record<string, number> = {
    'minute': 60, 'hour': 3600, 'day': 86400,
  };

  const targetSeconds = timeframeSeconds[targetTimeframe] || 3600;
  const sourceIntervalSeconds = sourceSeconds[sourceTimeframe] || 3600;
  const ratio = Math.floor(targetSeconds / sourceIntervalSeconds);

  console.log(`[aggregateCandles] Aggregating ${candles.length} ${sourceTimeframe} candles to ${targetTimeframe}`);
  console.log(`[aggregateCandles] Target interval: ${targetSeconds}s, Source interval: ${sourceIntervalSeconds}s, Ratio: ${ratio}`);

  if (ratio <= 1) {
    // No aggregation needed, but still return a copy
    console.log(`[aggregateCandles] No aggregation needed (ratio <= 1), returning ${candles.length} candles`);
    return [...candles];
  }

  const aggregated: any[] = [];
  const grouped = new Map<number, any[]>();

  // Validate and normalize input candles first
  const validCandles = candles
    .filter(c => {
      if (!c || typeof c.time === 'undefined') {
        return false;
      }
      const candleTime = typeof c.time === 'number' ? c.time : new Date(c.time).getTime() / 1000;
      if (isNaN(candleTime) || !isFinite(candleTime)) {
        return false;
      }
      if (typeof c.open === 'undefined' || typeof c.high === 'undefined' ||
        typeof c.low === 'undefined' || typeof c.close === 'undefined') {
        return false;
      }
      return isFinite(c.open) && isFinite(c.high) && isFinite(c.low) && isFinite(c.close) &&
        c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0;
    })
    .map(c => ({
      time: typeof c.time === 'number' ? Math.floor(c.time) : Math.floor(new Date(c.time).getTime() / 1000),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: (c.volume !== undefined && c.volume !== null && isFinite(c.volume)) ? Number(c.volume) : 0,
    }))
    .sort((a, b) => a.time - b.time); // Sort by time first

  if (validCandles.length === 0) {
    console.warn(`[aggregateCandles] No valid candles after validation`);
    return [];
  }

  // Group candles by target interval with proper alignment
  // For example, 5-minute candles should align to :00, :05, :10, :15, etc.
  for (const candle of validCandles) {
    // Calculate aligned group time
    let groupTime: number;

    if (targetSeconds < 3600) {
      // Minute-based: align to minute boundaries (e.g., 5min -> 00:00, 00:05, 00:10)
      const candleDate = new Date(candle.time * 1000);
      const minutes = candleDate.getUTCMinutes();
      const alignedMinutes = Math.floor(minutes / (targetSeconds / 60)) * (targetSeconds / 60);
      candleDate.setUTCMinutes(alignedMinutes, 0, 0);
      groupTime = Math.floor(candleDate.getTime() / 1000);
    } else if (targetSeconds < 86400) {
      // Hour-based: align to hour boundaries (e.g., 4h -> 00:00, 04:00, 08:00)
      const candleDate = new Date(candle.time * 1000);
      const hours = candleDate.getUTCHours();
      const alignedHours = Math.floor(hours / (targetSeconds / 3600)) * (targetSeconds / 3600);
      candleDate.setUTCHours(alignedHours, 0, 0, 0);
      groupTime = Math.floor(candleDate.getTime() / 1000);
    } else {
      // Day-based: align to day boundaries (00:00:00 UTC)
      const candleDate = new Date(candle.time * 1000);
      candleDate.setUTCHours(0, 0, 0, 0);
      groupTime = Math.floor(candleDate.getTime() / 1000);
    }

    if (!grouped.has(groupTime)) {
      grouped.set(groupTime, []);
    }
    grouped.get(groupTime)!.push(candle);
  }

  console.log(`[aggregateCandles] Grouped ${validCandles.length} valid candles into ${grouped.size} time groups`);

  // Aggregate each group with improved precision
  for (const [groupTime, groupCandles] of Array.from(grouped.entries()).sort((a, b) => a[0] - b[0])) {
    if (groupCandles.length === 0) continue;

    // Sort candles within group by time (should already be sorted, but ensure it)
    const sorted = groupCandles.sort((a, b) => a.time - b.time);

    // Use first candle's open and last candle's close
    const open = sorted[0].open;
    const close = sorted[sorted.length - 1].close;

    // High and low from all candles in the group (more accurate)
    let high = sorted[0].high;
    let low = sorted[0].low;
    let volume = 0;

    for (const candle of sorted) {
      // High is the maximum high across all candles
      if (candle.high > high) {
        high = candle.high;
      }
      // Low is the minimum low across all candles
      if (candle.low < low) {
        low = candle.low;
      }
      // Volume is the sum of all volumes
      volume += candle.volume || 0;
    }

    // Final validation: ensure high >= low
    if (high < low) {
      console.warn(`[aggregateCandles] Invalid OHLC at ${groupTime}: high=${high} < low=${low}, correcting...`);
      high = Math.max(high, Math.max(open, close));
      low = Math.min(low, Math.min(open, close));
    }

    // Ensure high >= max(open, close) and low <= min(open, close)
    const maxPrice = Math.max(open, close);
    const minPrice = Math.min(open, close);
    if (high < maxPrice) {
      high = maxPrice;
    }
    if (low > minPrice) {
      low = minPrice;
    }

    aggregated.push({
      time: groupTime,
      open: open,
      high: high,
      low: low,
      close: close,
      volume: volume,
    });
  }

  console.log(`[aggregateCandles] Aggregated ${validCandles.length} candles into ${aggregated.length} candles`);

  // Final sort by time to ensure chronological order
  aggregated.sort((a, b) => a.time - b.time);

  // Check for gaps in aggregated data
  if (aggregated.length > 1) {
    const gaps: number[] = [];
    for (let i = 1; i < aggregated.length; i++) {
      const timeDiff = aggregated[i].time - aggregated[i - 1].time;
      if (timeDiff > targetSeconds * 1.5) {
        gaps.push(timeDiff);
      }
    }
    if (gaps.length > 0) {
      console.warn(`[aggregateCandles] ⚠ Detected ${gaps.length} gaps in aggregated data (largest: ${Math.max(...gaps)}s)`);
    }
  }

  return aggregated;
}

/**
 * Get K-line/candlestick data
 * Returns validated OHLCV data array
 */
export async function getCandlestickData(
  network: string,
  pairAddress: string,
  timeframe: string = 'h1',
  limit: number = 100
): Promise<any[]> {
  const startTime = Date.now();

  try {
    console.log(`[getCandlestickData] ===== Starting data fetch =====`);
    console.log(`[getCandlestickData] Input: network=${network}, pairAddress=${pairAddress}, timeframe=${timeframe}, limit=${limit}`);

    // Validate inputs
    if (!network || !pairAddress) {
      throw new Error('Network and pairAddress are required');
    }

    if (limit < 1 || limit > 1000) {
      limit = Math.max(1, Math.min(1000, limit));
      console.warn(`[getCandlestickData] Limit adjusted to ${limit}`);
    }

    // Map network names to Gecko Terminal format
    const networkMap: Record<string, string> = {
      'sol': 'solana', 'solana': 'solana',
      'eth': 'eth', 'ethereum': 'eth',
      'bsc': 'bsc', 'base': 'base',
      'arbitrum': 'arbitrum', 'optimism': 'optimism',
      'polygon': 'polygon',
      'avax': 'avalanche', 'avalanche': 'avalanche',
      'fantom': 'fantom',
    };

    // Map timeframe to Gecko Terminal format
    // Gecko Terminal API uses: minute, hour, day (not m1, h1, d1)
    // But we need to aggregate data for different intervals (m5, m15, h4, etc.)
    const timeframeMap: Record<string, string> = {
      'm1': 'minute', 'm5': 'minute', 'm15': 'minute', 'm30': 'minute',
      'h1': 'hour', 'h4': 'hour', 'h6': 'hour', 'h12': 'hour',
      'd1': 'day', '24h': 'day',
      'minute': 'minute', 'hour': 'hour', 'day': 'day',
    };

    const geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();
    const geckoTimeframe = timeframeMap[timeframe.toLowerCase()] || timeframe.toLowerCase();

    if (!geckoTimeframe || !['minute', 'hour', 'day'].includes(geckoTimeframe)) {
      throw new Error(`Invalid timeframe: ${timeframe} (must be m1/m5/m15/m30/h1/h4/h6/h12/d1/24h)`);
    }

    // Store original timeframe for aggregation
    const originalTimeframe = timeframe.toLowerCase();

    // Calculate how many base candles we need to get enough aggregated candles
    // For m5, we need 5x more minute candles; for h4, we need 4x more hour candles
    const timeframeMultiplier: Record<string, number> = {
      'm1': 1, 'm5': 5, 'm15': 15, 'm30': 30,
      'h1': 1, 'h4': 4, 'h6': 6, 'h12': 12,
      'd1': 1, '24h': 1,
    };
    const multiplier = timeframeMultiplier[originalTimeframe] || 1;

    // Adjust limit based on timeframe to ensure we get enough historical data
    // For aggregation, we need more base candles than requested candles
    let adjustedLimit = limit * multiplier;

    if (geckoTimeframe === 'minute') {
      // For minute timeframes, be more aggressive to get enough data
      // m1: request at least 200-500 candles (many tokens have limited history)
      // m5: need 5x more = 1000-2500 candles (but cap at 2000)
      // m15: need 15x more = 3000-7500 candles (but cap at 2000 for API limits)
      if (originalTimeframe === 'm1') {
        adjustedLimit = Math.min(Math.max(limit, 200), 500);
      } else if (originalTimeframe === 'm5') {
        // For m5, we need 5x more minute candles to get 200 m5 candles
        // Request more data to account for sparse data
        adjustedLimit = Math.min(Math.max(limit * 6, 1000), 2500); // Request 2500 minutes to get ~200 m5 candles
      } else if (originalTimeframe === 'm15') {
        // For m15, we need 15x more minute candles to get 200 m15 candles
        // Request more data to account for sparse data and ensure we get enough aggregated candles
        adjustedLimit = Math.min(Math.max(limit * 20, 2000), 3000); // Request 3000 minutes to get ~200 m15 candles
      } else {
        adjustedLimit = Math.min(Math.max(adjustedLimit, 200), 2000);
      }
    } else if (geckoTimeframe === 'hour') {
      // For hour timeframes
      // h1: request 200-500 candles
      // h4: need 4x more = 800-2000 candles
      if (originalTimeframe === 'h1') {
        adjustedLimit = Math.min(Math.max(limit, 200), 500);
      } else if (originalTimeframe === 'h4') {
        // For h4, we need 4x more hour candles to get 200 h4 candles
        adjustedLimit = Math.min(Math.max(limit * 4, 400), 2000);
      } else {
        adjustedLimit = Math.min(Math.max(adjustedLimit, 200), 2000);
      }
      adjustedLimit = Math.min(Math.max(adjustedLimit, 100), 365);
    }

    console.log(`[getCandlestickData] Limit calculation: requested=${limit}, multiplier=${multiplier}, adjusted=${adjustedLimit}`);

    // CRITICAL: Gecko Terminal API has a maximum limit of 1000
    // Cap adjustedLimit to prevent 400 Bad Request errors
    if (adjustedLimit > 1000) {
      console.warn(`[getCandlestickData] Adjusted limit ${adjustedLimit} exceeds API maximum (1000), capping at 1000`);
      adjustedLimit = 1000;
    }

    const url = `${GECKO_TERMINAL_BASE_URL}/networks/${geckoNetwork}/pools/${pairAddress}/ohlcv/${geckoTimeframe}?limit=${adjustedLimit}`;

    console.log(`[getCandlestickData] ===== Fetching candlestick data =====`);
    console.log(`[getCandlestickData] Network: ${network} -> ${geckoNetwork}`);
    console.log(`[getCandlestickData] Pair Address: ${pairAddress}`);
    console.log(`[getCandlestickData] Timeframe: ${timeframe} -> ${geckoTimeframe}`);
    console.log(`[getCandlestickData] Limit: ${limit}`);
    console.log(`[getCandlestickData] Full URL: ${url}`);

    let response: Response;
    try {
      response = await fetchWithRetry(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'KiKo/1.0',
        },
      });
    } catch (error: any) {
      if (error instanceof GeckoTerminalError) {
        console.error(`[getCandlestickData] ✗ ${error.type} error: ${error.message}`);
        if (error.type === 'network' || error.type === 'timeout') {
          // Network/timeout errors should be thrown to allow fallback to DexScreener
          throw error;
        }
      } else {
        console.error(`[getCandlestickData] ✗ Unexpected error:`, error);
        throw new GeckoTerminalError(
          `Unexpected error: ${error.message}`,
          'network',
          undefined,
          error
        );
      }
      // For API errors, return empty array
      return [];
    }

    console.log(`[getCandlestickData] Response status: ${response.status} ${response.statusText}`);
    console.log(`[getCandlestickData] Response headers:`, {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const errorMessage = `Gecko Terminal API error ${response.status}: ${response.statusText}`;
      console.error(`[getCandlestickData] ✗ ${errorMessage}`);
      console.error(`[getCandlestickData] Error response body:`, errorText.substring(0, 500));
      console.error(`[getCandlestickData] Request URL was: ${url}`);

      // Try to parse error as JSON for more details
      try {
        const errorJson = JSON.parse(errorText);
        console.error(`[getCandlestickData] Error JSON:`, JSON.stringify(errorJson, null, 2));
      } catch (e) {
        // Not JSON, already logged as text
      }

      // Throw API error to allow fallback to DexScreener
      throw new GeckoTerminalError(
        errorMessage,
        'api',
        response.status,
        { responseText: errorText }
      );
    }

    const data = await response.json() as any;

    console.log(`[getCandlestickData] Response structure:`, {
      hasData: !!data?.data,
      hasAttributes: !!data?.data?.attributes,
      hasOhlcvList: !!data?.data?.attributes?.ohlcv_list,
      ohlcvLength: data?.data?.attributes?.ohlcv_list?.length || 0,
      responseKeys: data ? Object.keys(data) : [],
      dataKeys: data?.data ? Object.keys(data.data) : null,
      attributesKeys: data?.data?.attributes ? Object.keys(data.data.attributes) : null,
    });

    // Log full response for debugging (truncated if too long)
    const responseStr = JSON.stringify(data);
    if (responseStr.length > 1000) {
      console.log(`[getCandlestickData] Response preview (first 1000 chars):`, responseStr.substring(0, 1000));
    } else {
      console.log(`[getCandlestickData] Full response:`, data);
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      console.error(`[getCandlestickData] ✗ Invalid response format:`, typeof data);
      console.error(`[getCandlestickData] Response value:`, data);
      return [];
    }

    if (!data?.data || !data?.data?.attributes) {
      console.warn(`[getCandlestickData] ⚠ Missing data.attributes in response`);
      console.warn(`[getCandlestickData] Available keys in data:`, data ? Object.keys(data) : []);
      if (data?.data) {
        console.warn(`[getCandlestickData] Available keys in data.data:`, Object.keys(data.data));
      }
      if (data?.errors) {
        console.warn(`[getCandlestickData] API errors:`, data.errors);
      }
      return [];
    }

    const ohlcvList = data.data.attributes.ohlcv_list;

    if (!Array.isArray(ohlcvList)) {
      console.warn(`[getCandlestickData] ⚠ ohlcv_list is not an array:`, typeof ohlcvList);
      console.warn(`[getCandlestickData] ohlcv_list value:`, ohlcvList);
      console.warn(`[getCandlestickData] Available attributes keys:`, Object.keys(data.data.attributes));
      return [];
    }

    if (ohlcvList.length === 0) {
      console.warn(`[getCandlestickData] ⚠ Empty ohlcv_list for pool ${pairAddress}`);
      console.warn(`[getCandlestickData] Network: ${geckoNetwork}, Timeframe: ${geckoTimeframe}, Requested limit: ${adjustedLimit}`);
      console.warn(`[getCandlestickData] This might mean:`);
      console.warn(`  - Pool ${pairAddress} is too new and has no historical data`);
      console.warn(`  - Timeframe ${geckoTimeframe} is not available for this pool`);
      console.warn(`  - Pool may have been removed or is inactive`);
      console.warn(`  - Token may not have enough trading activity for ${originalTimeframe} timeframe`);
      console.warn(`[getCandlestickData] Will try smaller limits and DexScreener fallback...`);

      // Try with progressively smaller limits if the requested limit was too high
      // This is especially important for new tokens with limited history
      // For m1, m5, m15, we need to be more aggressive with retries
      if (geckoTimeframe === 'minute') {
        const retryLimits = originalTimeframe === 'm1'
          ? [100, 50, 25, 10, 5, 1]  // More aggressive retries for m1
          : originalTimeframe === 'm5' || originalTimeframe === 'm15'
            ? [500, 200, 100, 50, 25, 10]  // For m5/m15, try larger limits first
            : [200, 100, 50, 25, 10];

        console.log(`[getCandlestickData] No data with limit ${adjustedLimit}, trying smaller limits: ${retryLimits.join(', ')}`);

        for (const retryLimit of retryLimits) {
          if (retryLimit >= adjustedLimit) continue;

          console.log(`[getCandlestickData] Retrying with limit ${retryLimit} for ${originalTimeframe} timeframe...`);
          const retryUrl = `${GECKO_TERMINAL_BASE_URL}/networks/${geckoNetwork}/pools/${pairAddress}/ohlcv/${geckoTimeframe}?limit=${retryLimit}`;
          try {
            const retryResponse = await fetchWithRetry(retryUrl, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'KiKo/1.0',
              },
            }, 2); // Use fewer retries for retry attempts

            if (!retryResponse.ok) {
              console.warn(`[getCandlestickData] Retry with limit ${retryLimit} failed: ${retryResponse.status}`);
              continue;
            }

            const retryData = await retryResponse.json() as any;

            if (retryData?.data?.attributes?.ohlcv_list && Array.isArray(retryData.data.attributes.ohlcv_list) && retryData.data.attributes.ohlcv_list.length > 0) {
              console.log(`[getCandlestickData] ✓ Retry successful with limit ${retryLimit}, got ${retryData.data.attributes.ohlcv_list.length} candles`);

              // Process the retry data
              const retryOhlcvList = retryData.data.attributes.ohlcv_list;
              const result: any[] = [];

              for (let i = 0; i < retryOhlcvList.length; i++) {
                const item = retryOhlcvList[i];
                if (!Array.isArray(item) || item.length < 6) continue;

                const [time, open, high, low, close, volume] = item;

                if (
                  typeof time !== 'number' || isNaN(time) ||
                  typeof open !== 'number' || isNaN(open) ||
                  typeof high !== 'number' || isNaN(high) ||
                  typeof low !== 'number' || isNaN(low) ||
                  typeof close !== 'number' || isNaN(close) ||
                  typeof volume !== 'number' || isNaN(volume)
                ) {
                  continue;
                }

                // More lenient validation for retry data
                let correctedHigh = high;
                let correctedLow = low;

                const maxPrice = Math.max(open, high, low, close);
                const minPrice = Math.min(open, high, low, close);

                if (high < maxPrice - 0.00000001) {
                  correctedHigh = maxPrice;
                }
                if (low > minPrice + 0.00000001) {
                  correctedLow = minPrice;
                }

                if (correctedHigh < correctedLow - 0.00000001) {
                  continue;
                }

                result.push({
                  time: time,
                  open: open,
                  high: correctedHigh,
                  low: correctedLow,
                  close: close,
                  volume: volume || 0,
                });
              }

              if (result.length > 0) {
                console.log(`[getCandlestickData] ✓ Processed ${result.length} valid candles from retry`);

                // For m1, return directly without aggregation
                if (originalTimeframe === 'm1') {
                  // Return all if we have less than requested
                  if (result.length <= limit) {
                    return result;
                  }
                  return result.slice(-limit);
                }

                // For other timeframes, aggregate if needed
                if (originalTimeframe !== geckoTimeframe && result.length > 0) {
                  const aggregatedResult = aggregateCandles(result, originalTimeframe, geckoTimeframe);
                  // Return all if we have less than requested
                  if (aggregatedResult.length <= limit) {
                    return aggregatedResult;
                  }
                  return aggregatedResult.slice(-limit);
                }

                // Return all if we have less than requested
                if (result.length <= limit) {
                  return result;
                }
                return result.slice(-limit);
              } else {
                console.warn(`[getCandlestickData] Retry with limit ${retryLimit} returned data but processing resulted in 0 valid candles`);
              }
            } else {
              console.log(`[getCandlestickData] Retry with limit ${retryLimit} returned no data`);
            }
          } catch (retryError: any) {
            console.warn(`[getCandlestickData] Retry with limit ${retryLimit} error:`, retryError.message);
            continue;
          }
        }

        console.warn(`[getCandlestickData] All retry attempts failed for ${originalTimeframe} timeframe`);
      }

      return [];
    }

    /**
     * Validate and normalize a single OHLCV candle
     * Returns normalized candle or null if invalid
     */
    function validateAndNormalizeCandle(
      item: any,
      index: number,
      previousCandle?: any
    ): any | null {
      // Validate item format
      if (!Array.isArray(item) || item.length < 6) {
        return null;
      }

      const [time, open, high, low, close, volume] = item;

      // Validate data types
      if (
        typeof time !== 'number' || !isFinite(time) ||
        typeof open !== 'number' || !isFinite(open) ||
        typeof high !== 'number' || !isFinite(high) ||
        typeof low !== 'number' || !isFinite(low) ||
        typeof close !== 'number' || !isFinite(close) ||
        (volume !== undefined && volume !== null && (typeof volume !== 'number' || !isFinite(volume)))
      ) {
        return null;
      }

      // Validate time is reasonable (Unix timestamp in seconds)
      // Should be between 2000-01-01 and 2100-01-01
      if (time < 946684800 || time > 4102444800) {
        return null;
      }

      // Validate prices are positive
      if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
        return null;
      }

      // Validate volume is non-negative
      const normalizedVolume = (volume !== undefined && volume !== null && isFinite(volume)) ? volume : 0;
      if (normalizedVolume < 0) {
        return null;
      }

      // Strict OHLC validation and correction
      const maxPrice = Math.max(open, high, low, close);
      const minPrice = Math.min(open, high, low, close);

      // High must be >= max(open, close, low)
      let correctedHigh = Math.max(high, maxPrice);
      // Low must be <= min(open, close, high)
      let correctedLow = Math.min(low, minPrice);

      // Final validation: high must be >= low
      if (correctedHigh < correctedLow - 0.00000001) {
        return null;
      }

      // Detect abnormal price movements (>50% change from previous candle)
      if (previousCandle) {
        const prevClose = previousCandle.close;
        const priceChange = Math.abs((close - prevClose) / prevClose);

        // If price change is >50%, mark as suspicious but don't reject
        // (could be legitimate market movement)
        if (priceChange > 0.5) {
          console.warn(`[getCandlestickData] Large price movement detected at index ${index}: ${(priceChange * 100).toFixed(2)}% (${prevClose} -> ${close})`);
        }
      }

      // Normalize time to integer (Unix seconds)
      const normalizedTime = Math.floor(time);

      return {
        time: normalizedTime,
        open: open,
        high: correctedHigh,
        low: correctedLow,
        close: close,
        volume: normalizedVolume,
      };
    }

    // Validate and transform data with deduplication
    const result: any[] = [];
    const seenTimes = new Set<number>();
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < ohlcvList.length; i++) {
      const item = ohlcvList[i];
      const previousCandle = result.length > 0 ? result[result.length - 1] : undefined;

      const normalized = validateAndNormalizeCandle(item, i, previousCandle);

      if (!normalized) {
        invalidCount++;
        continue;
      }

      // Deduplicate by time (keep the latest one if duplicates exist)
      if (seenTimes.has(normalized.time)) {
        duplicateCount++;
        // Replace existing candle with same time (keep the latest)
        const existingIndex = result.findIndex(c => c.time === normalized.time);
        if (existingIndex >= 0) {
          result[existingIndex] = normalized;
        }
        continue;
      }

      seenTimes.add(normalized.time);
      result.push(normalized);
    }

    // Sort by time to ensure chronological order
    result.sort((a, b) => a.time - b.time);

    // Check for data gaps and continuity
    if (result.length > 1) {
      const gaps: number[] = [];
      for (let i = 1; i < result.length; i++) {
        const timeDiff = result[i].time - result[i - 1].time;
        // Expected interval based on timeframe
        const expectedInterval = geckoTimeframe === 'minute' ? 60 :
          geckoTimeframe === 'hour' ? 3600 : 86400;

        // If gap is more than 2x expected interval, it's a significant gap
        if (timeDiff > expectedInterval * 2) {
          gaps.push(timeDiff);
        }
      }

      if (gaps.length > 0) {
        console.warn(`[getCandlestickData] ⚠ Detected ${gaps.length} data gaps (largest: ${Math.max(...gaps)}s)`);
      }
    }

    if (invalidCount > 0) {
      console.warn(`[getCandlestickData] Filtered out ${invalidCount} invalid candles`);
    }
    if (duplicateCount > 0) {
      console.warn(`[getCandlestickData] Found ${duplicateCount} duplicate timestamps (kept latest)`);
    }

    // If we need a different interval than what Gecko Terminal provides,
    // aggregate the data (e.g., m5 from minute data, h4 from hour data)
    if (originalTimeframe !== geckoTimeframe && result.length > 0) {
      console.log(`[getCandlestickData] Aggregating ${result.length} ${geckoTimeframe} candles to ${originalTimeframe}...`);
      const aggregatedResult = aggregateCandles(result, originalTimeframe, geckoTimeframe);
      const duration = Date.now() - startTime;
      console.log(`[getCandlestickData] ✓ Aggregated ${result.length} ${geckoTimeframe} candles to ${aggregatedResult.length} ${originalTimeframe} candles in ${duration}ms`);

      // If aggregation resulted in fewer candles than requested, return all we have
      // Don't slice if we have fewer than requested - this means the token has limited history
      let finalAggregated: any[];
      if (aggregatedResult.length <= limit) {
        // Return all aggregated candles if we have fewer than requested
        finalAggregated = aggregatedResult;
        console.log(`[getCandlestickData] Returning all ${finalAggregated.length} aggregated candles (requested ${limit}, but token has limited history)`);
      } else {
        // Take the most recent candles if we have more than requested
        finalAggregated = aggregatedResult.slice(-limit);
      }

      // If aggregation resulted in too few candles, log a warning
      if (finalAggregated.length < limit * 0.5 && result.length > finalAggregated.length) {
        console.warn(`[getCandlestickData] ⚠ Aggregation resulted in only ${finalAggregated.length} candles (requested ${limit}), but we have ${result.length} base candles`);
        console.warn(`[getCandlestickData] This might indicate:`);
        console.warn(`  - Token is very new or has sparse data`);
        console.warn(`  - Data time gaps (missing candles in source data)`);
        console.warn(`  - Sample times: first=${result[0]?.time}, last=${result[result.length - 1]?.time}`);
        console.warn(`  - Time span: ${(result[result.length - 1]?.time - result[0]?.time) / 3600} hours`);
      }

      if (finalAggregated.length === 0) {
        console.error(`[getCandlestickData] ✗ Aggregation resulted in 0 candles! Original data had ${result.length} candles`);
        console.error(`[getCandlestickData] Sample original data:`, result.slice(0, 3));
      }

      return finalAggregated;
    }

    // For direct timeframes (m1 when geckoTimeframe is minute, h1 when geckoTimeframe is hour, etc.)
    // Return all available data if we have less than requested, otherwise limit to requested amount
    let finalResult: any[];
    if (result.length <= limit) {
      // Return all candles if we have fewer than requested (token has limited history)
      finalResult = result;
      console.log(`[getCandlestickData] Returning all ${finalResult.length} candles (requested ${limit}, but token has limited history)`);
    } else {
      // Take the most recent candles if we have more than requested
      finalResult = result.slice(-limit);
    }

    const duration = Date.now() - startTime;
    console.log(`[getCandlestickData] ✓ Processed ${result.length} valid candles, returning ${finalResult.length} (${invalidCount} invalid filtered) in ${duration}ms`);

    if (invalidCount > 0) {
      console.warn(`[getCandlestickData] Filtered out ${invalidCount} invalid candles`);
    }

    if (finalResult.length < limit * 0.5) {
      console.warn(`[getCandlestickData] ⚠ Only ${finalResult.length} candles returned (requested ${limit}), token may have limited history`);
      if (finalResult.length > 0) {
        const timeSpan = (finalResult[finalResult.length - 1]?.time - finalResult[0]?.time) / 3600;
        console.warn(`[getCandlestickData] Time span: ${timeSpan.toFixed(2)} hours`);
      }
    }

    return finalResult;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[getCandlestickData] ✗ Error after ${duration}ms:`, error.message);
    console.error(`[getCandlestickData] Error type:`, error.constructor.name);
    console.error(`[getCandlestickData] Stack:`, error.stack);
    console.error(`[getCandlestickData] Input was: network=${network}, pairAddress=${pairAddress}, timeframe=${timeframe}, limit=${limit}`);

    // Re-throw the error so the caller can handle it
    throw error;
  }
}

/**
 * 0x API Service
 * Documentation: https://0x.org/docs/api
 * 
 * 0x API provides:
 * - Price quotes: GET /swap/v1/price
 * - Swap quotes: GET /swap/v1/quote
 * - Token metadata: GET /token/v1/metadata
 */

import { env } from '../config/env.js';

const ZEROX_BASE_URL = 'https://api.0x.org';
const ZEROX_API_KEY = env.apiKeys.zeroEx || '';

// Chain ID mapping for 0x API (use chain names for base URL)
const CHAIN_ID_MAP: Record<number, string> = {
  1: '1',        // Ethereum
  8453: '8453',  // Base
  42161: '42161', // Arbitrum
  56: '56',      // BSC
  137: '137',    // Polygon
  10: '10',      // Optimism
  43114: '43114', // Avalanche
  250: '250',    // Fantom
};

const FALLBACK_TOKEN_METADATA: Record<number, Record<string, ZeroExTokenMetadata>> = {
  1: {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    '0xdac17f958d2ee523a2206206994597c13d831ec7': {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
  },
  8453: {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913',
    },
    '0x4200000000000000000000000000000000000006': {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      address: '0x4200000000000000000000000000000000000006',
    },
    // Native ETH (0xEeee... format used by DEX aggregators)
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': {
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    },
    '0xd9aaec86b65d86f6a7b5b4b79f91d5dc61c39afc': {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      address: '0xd9AaEc86B65d86F6A7B5B4b79f91D5dc61C39aFc',
    },
  },
  56: {
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': {
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      decimals: 18,
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    },
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18,
      address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d',
    },
    '0x55d398326f99059ff775485246999027b3197955': {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
      address: '0x55d398326f99059fF775485246999027B3197955',
    },
  },
  42161: {
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    },
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    },
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    },
    '0x912ce59144191c1204e64559fe8253a0e49e6548': {
      symbol: 'ARB',
      name: 'Arbitrum',
      decimals: 18,
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    },
  },
  137: {
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': {
      symbol: 'WMATIC',
      name: 'Wrapped MATIC',
      decimals: 18,
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    },
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    },
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
  },
  10: {
    '0x4200000000000000000000000000000000000006': {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      address: '0x4200000000000000000000000000000000000006',
    },
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85': { // Native USDC (new)
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    },
    '0x7f5c764cbc14f9669b88837ca1490cca17c31607': { // Bridged USDC.e (old, deprecated)
      symbol: 'USDC.e',
      name: 'USD Coin (Bridged)',
      decimals: 6,
      address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    },
    '0x94b008aa00579c1307b0ef2b499ad98a8ce58e58': {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: '0x94b008aA00579c1307B0EF2b499aD98a8ce58e58',
    },
    '0x4200000000000000000000000000000000000042': {
      symbol: 'OP',
      name: 'Optimism',
      decimals: 18,
      address: '0x4200000000000000000000000000000000000042',
    },
  },
};

// Chain-specific base URLs for 0x API v2
// Note: Most chains use the main API (api.0x.org) with chainId parameter
// Polygon requires chain-specific URL for v1 endpoint
const CHAIN_BASE_URLS: Record<number, string> = {
  1: 'https://api.0x.org',           // Ethereum
  8453: 'https://api.0x.org',         // Base - use main API with chainId param
  42161: 'https://api.0x.org',        // Arbitrum - use main API with chainId param
  56: 'https://api.0x.org',           // BSC - use main API with chainId param and permit2 endpoint
  137: 'https://api.0x.org',          // Polygon - use main API with chainId param, try permit2 first
  10: 'https://api.0x.org',           // Optimism - use main API with chainId param
};

export interface ZeroExPrice {
  price: string;
  buyAmount: string;
  sellAmount: string;
  buyToken: string;
  sellToken: string;
  allowanceTarget?: string;
  to?: string;
  data?: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
  estimatedGas?: string;
}

export interface ZeroExQuote extends ZeroExPrice {
  guaranteedPrice: string;
  estimatedPriceImpact: string;
  sources: Array<{
    name: string;
    proportion: string;
  }>;
  orders: any[];
  minBuyAmount?: string;
}

export interface ZeroExTokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

/**
 * Get price quote from 0x API
 * @param sellToken - Token address or symbol to sell
 * @param buyToken - Token address or symbol to buy
 * @param sellAmount - Amount to sell (in wei/smallest unit)
 * @param chainId - Chain ID
 * @returns Price quote or null
 */
export async function getZeroExPrice(
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  chainId: number
): Promise<ZeroExPrice | null> {
  try {
    // Get the appropriate base URL for the chain
    const baseUrl = CHAIN_BASE_URLS[chainId] || ZEROX_BASE_URL;

    const params = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
    });

    // For chain-specific base URLs (bsc.api.0x.org, polygon.api.0x.org, etc.),
    // we should NOT include chainId in the URL as the base URL already specifies the chain.
    // For the main api.0x.org, we need to include chainId.
    const isChainSpecificBaseUrl = baseUrl !== ZEROX_BASE_URL;
    const url = isChainSpecificBaseUrl
      ? `${baseUrl}/swap/allowance-holder/price?${params.toString()}`
      : `${baseUrl}/swap/allowance-holder/price?chainId=${chainId}&${params.toString()}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      '0x-version': 'v2',
    };

    if (ZEROX_API_KEY) {
      headers['0x-api-key'] = ZEROX_API_KEY;
    }

    console.log('[0x API] Requesting price from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[0x API] Price request failed: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json() as ZeroExPrice;
    console.log('[0x API] Price received successfully');
    return data;
  } catch (error) {
    console.error('[0x API] Error fetching price:', error);
    return null;
  }
}

/**
 * Get swap quote from 0x API
 * @param sellToken - Token address or symbol to sell
 * @param buyToken - Token address or symbol to buy
 * @param sellAmount - Amount to sell (in wei/smallest unit)
 * @param chainId - Chain ID
 * @param slippagePercentage - Slippage percentage (default: 0.5)
 * @param takerAddress - Optional taker address for better gas estimates
 * @returns Swap quote or null
 */
export async function getZeroExQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  chainId: number,
  slippageBps: number = 50,
  takerAddress?: string
): Promise<ZeroExQuote | null> {
  try {
    // Validate sellAmount - must be greater than 0
    const sellAmountBigInt = BigInt(sellAmount || '0');
    if (sellAmountBigInt === 0n) {
      console.error('[0x API] Invalid sellAmount: must be greater than 0', { sellAmount, sellToken, buyToken, chainId });
      return null;
    }

    // Get the appropriate base URL for the chain
    const baseUrl = CHAIN_BASE_URLS[chainId] || ZEROX_BASE_URL;

    // Polygon: Try permit2 endpoint first (via main API), fallback to v1 if needed
    // Other chains (Arbitrum, Optimism, Base, BSC) use permit2 endpoint via main API with chainId param
    // For Base (8453), try permit2 first, fallback to v1 if needed
    const useLegacyEndpoint = false; // Try permit2 for all chains first, fallback to v1 if needed
    const isPolygon = chainId === 137;

    // Normalize native token addresses
    // All chains now use permit2 endpoint first, which accepts 0xEeee... format for native tokens
    // Only when falling back to v1 endpoint do we need to use wrapped native token addresses
    const normalizeToken = (token: string, isSell: boolean): string => {
      const isNative = token.toLowerCase() === '0x0000000000000000000000000000000000000000'
        || token.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      if (!isNative) {
        return token;
      }

      // For permit2 endpoint (default for all chains), use 0xEeee... format
      // For v1 endpoint (fallback only), we'll convert to wrapped native token in fallback logic
      return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    };

    const normalizeSellToken = normalizeToken(sellToken, true);
    const normalizeBuyToken = normalizeToken(buyToken, false);

    // v1 endpoint uses slippagePercentage (as decimal, e.g., 0.5 for 0.5%)
    // permit2 endpoint uses slippageBps (in basis points, e.g., 50 for 0.5%)
    const params = new URLSearchParams({
      sellToken: normalizeSellToken,
      buyToken: normalizeBuyToken,
      sellAmount,
    });

    // Add slippage parameter based on endpoint type
    if (useLegacyEndpoint) {
      // v1 endpoint: slippagePercentage as decimal (0.5 = 0.5%)
      params.append('slippagePercentage', (slippageBps / 100).toString());
    } else {
      // permit2 endpoint: slippageBps in basis points (50 = 0.5%)
      params.append('slippageBps', Math.round(slippageBps).toString());
    }

    const endpoint = useLegacyEndpoint ? '/swap/v1/quote' : '/swap/permit2/quote';

    // 0x API v2 (permit2) uses 'taker', v1 uses 'takerAddress'
    // Both endpoints require taker address, so we always need to provide it
    // If takerAddress is not provided, we should use a default or throw an error
    const finalTakerAddress = takerAddress || getDefaultTakerAddress(chainId);
    if (!finalTakerAddress) {
      throw new Error(`Taker address is required for chain ${chainId}. Please provide a takerAddress or ensure getDefaultTakerAddress returns a value for this chain.`);
    }

    // v1 endpoint uses 'takerAddress', permit2 uses 'taker'
    if (useLegacyEndpoint) {
      params.append('takerAddress', finalTakerAddress);
    } else {
      params.append('taker', finalTakerAddress);
    }

    // For chain-specific base URLs (bsc.api.0x.org, polygon.api.0x.org, etc.),
    // we should NOT include chainId in the URL as the base URL already specifies the chain.
    // For the main api.0x.org, we need to include chainId.
    const isChainSpecificBaseUrl = baseUrl !== ZEROX_BASE_URL;
    const url = isChainSpecificBaseUrl
      ? `${baseUrl}${endpoint}?${params.toString()}`
      : `${baseUrl}${endpoint}?chainId=${chainId}&${params.toString()}`;

    // Debug logging
    console.log('[0x API] URL construction:', {
      baseUrl,
      ZEROX_BASE_URL,
      isChainSpecificBaseUrl,
      endpoint,
      chainId,
      url,
      params: Object.fromEntries(params.entries()),
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!useLegacyEndpoint) {
      headers['0x-version'] = 'v2';
    }

    if (ZEROX_API_KEY) {
      headers['0x-api-key'] = ZEROX_API_KEY;
    }

    console.log('[0x API] Requesting quote from:', url);
    console.log('[0x API] Quote request details:', {
      sellToken: normalizeSellToken,
      buyToken: normalizeBuyToken,
      sellAmount,
      slippageBps: Math.round(slippageBps),
      chainId,
      takerAddress: finalTakerAddress,
      providedTakerAddress: takerAddress,
      endpoint: useLegacyEndpoint ? 'v1' : 'permit2',
    });

    let response = await fetch(url, {
      method: 'GET',
      headers,
    });

    // Parse the response first to check if it has valid data
    let rawData: any = null;
    let responseWasOk = response.ok;

    if (response.ok) {
      try {
        rawData = await response.json();
      } catch (e) {
        console.error('[0x API] Failed to parse response JSON:', e);
        responseWasOk = false;
      }
    }

    // Check if response has valid transaction data
    // permit2 endpoint returns { transaction: { to, data, value }, buyAmount, ... }
    // v1 endpoint returns { to, data, value, buyAmount, ... } directly
    const hasValidData = rawData && (
      (rawData.transaction?.to && rawData.transaction?.data) || // permit2 format
      (rawData.to && rawData.data) || // v1 format
      rawData.buyAmount // At minimum should have buyAmount
    );

    // If permit2 endpoint fails OR returns empty data for certain chains, try v1 endpoint as fallback
    // Supported chains for fallback: Base (8453), Arbitrum (42161), Optimism (10), Polygon (137)
    const chainsWithFallback = [8453, 42161, 10, 137]; // Base, Arbitrum, Optimism, Polygon
    if ((!responseWasOk || !hasValidData) && !useLegacyEndpoint && chainsWithFallback.includes(chainId)) {
      let originalErrorText = '';
      try {
        if (!responseWasOk) {
          originalErrorText = await response.text();
        } else {
          originalErrorText = `Empty response: ${JSON.stringify(rawData)}`;
        }
      } catch (e) {
        // Ignore if we can't read the error
      }

      console.warn(`[0x API] Permit2 endpoint ${responseWasOk ? 'returned empty data' : 'failed'} for chain ${chainId}, trying v1 endpoint as fallback`, {
        originalError: originalErrorText,
        status: response.status,
        chainId,
        hasValidData,
      });

      // For v1 fallback, we need to use wrapped native token addresses
      // Convert 0xEeee... back to wrapped native token if needed
      const getWrappedNativeForFallback = (token: string): string => {
        if (token.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
          const wrappedNative = getNativeTokenAddress(chainId);
          return wrappedNative || token;
        }
        return token;
      };

      const fallbackSellToken = getWrappedNativeForFallback(normalizeSellToken);
      const fallbackBuyToken = getWrappedNativeForFallback(normalizeBuyToken);

      const fallbackParams = new URLSearchParams({
        sellToken: fallbackSellToken,
        buyToken: fallbackBuyToken,
        sellAmount,
        slippagePercentage: (slippageBps / 100).toString(),
      });

      // v1 endpoint uses 'takerAddress' parameter
      fallbackParams.append('takerAddress', finalTakerAddress);

      // For v1 fallback, use chain-specific URL for Polygon, main API for others
      // Polygon v1 endpoint requires chain-specific URL
      const fallbackBaseUrl = isPolygon ? 'https://polygon.api.0x.org' : baseUrl;
      const isFallbackChainSpecific = fallbackBaseUrl !== ZEROX_BASE_URL;
      const fallbackUrl = isFallbackChainSpecific
        ? `${fallbackBaseUrl}/swap/v1/quote?${fallbackParams.toString()}`
        : `${fallbackBaseUrl}/swap/v1/quote?chainId=${chainId}&${fallbackParams.toString()}`;
      const fallbackHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (ZEROX_API_KEY) {
        fallbackHeaders['0x-api-key'] = ZEROX_API_KEY;
      }

      console.log('[0x API] Trying v1 fallback:', fallbackUrl);

      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'GET',
        headers: fallbackHeaders,
      });

      if (fallbackResponse.ok) {
        console.log('[0x API] Fallback to v1 endpoint succeeded');
        rawData = await fallbackResponse.json();
        const data: ZeroExQuote = {
          ...rawData,
          to: rawData.to,
          data: rawData.data,
          value: rawData.value || '0',
          gas: rawData.gas,
          gasPrice: rawData.gasPrice,
        };
        return data;
      } else {
        // If fallback also fails, use the fallback error for final error handling
        response = fallbackResponse;
        responseWasOk = false;
        rawData = null;
      }
    }

    // Note: v0 endpoint doesn't exist for BSC, so we skip that fallback
    // The 404 error likely indicates insufficient liquidity or unsupported token pair

    if (!responseWasOk) {
      let errorText = '';
      let errorJson: any = null;
      try {
        errorText = await response.text();
        try {
          errorJson = JSON.parse(errorText);
        } catch (e) {
          // If parsing fails, use the text as is
        }
      } catch (e) {
        // If we can't read the response, use status text
        errorText = response.statusText;
      }

      console.error(`[0x API] Quote request failed: ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorText,
        errorJson,
        requestDetails: {
          sellToken: normalizeSellToken,
          buyToken: normalizeBuyToken,
          sellAmount,
          chainId,
          endpoint: useLegacyEndpoint ? 'v1' : 'permit2',
          takerAddress: finalTakerAddress,
          url,
        },
      });

      // For 404 errors, provide more helpful message
      if (response.status === 404) {
        const errorMessage = errorJson?.message || errorText || 'No route found';
        // Convert sellAmount from wei to human-readable for better error message
        const sellAmountNum = parseFloat(sellAmount) / Math.pow(10, 18);
        throw new Error(`0x API error (404): ${errorMessage}. Request details: sellToken=${normalizeSellToken}, buyToken=${normalizeBuyToken}, sellAmount=${sellAmountNum} (${sellAmount} wei), chainId=${chainId}. This may indicate insufficient liquidity for this amount or the token pair is not supported. Try using a smaller amount (e.g., 0.1 instead of ${sellAmountNum}) or a different token pair.`);
      }

      // Throw error with more details for better debugging
      const errorMessage = errorJson?.reason || errorJson?.validationErrors?.[0]?.reason || errorJson?.message || errorText || response.statusText;
      throw new Error(`0x API error (${response.status}): ${errorMessage}`);
    }

    // If we haven't parsed rawData yet (because response was ok from the start and we didn't go through fallback),
    // parse it now
    if (!rawData) {
      rawData = await response.json();
    }

    console.log('[0x API] Quote received successfully');
    console.log('[0x API] Quote response structure:', {
      hasTransaction: !!rawData.transaction,
      hasTo: !!rawData.transaction?.to || !!rawData.to,
      hasData: !!rawData.transaction?.data || !!rawData.data,
      hasValue: !!rawData.transaction?.value || !!rawData.value,
      transactionValue: rawData.transaction?.value || rawData.value,
      usedEndpoint: useLegacyEndpoint ? 'v1' : 'permit2',
    });

    // 0x API v2 (permit2) returns { transaction: { to, data, value, ... }, ... }
    // 0x API v1 returns { to, data, value, ... } directly
    // We need to flatten v2 for backward compatibility
    const data: ZeroExQuote = {
      ...rawData,
      to: rawData.transaction?.to || rawData.to,
      data: rawData.transaction?.data || rawData.data,
      value: rawData.transaction?.value || rawData.value || '0',
      gas: rawData.transaction?.gas || rawData.gas,
      gasPrice: rawData.transaction?.gasPrice || rawData.gasPrice,
    };

    console.log('[0x API] Flattened quote data:', {
      to: data.to?.substring(0, 10),
      dataLength: data.data?.length,
      value: data.value,
      buyAmount: data.buyAmount,
    });

    return data;
  } catch (error) {
    console.error('[0x API] Error fetching quote:', error);
    // Re-throw to let the caller handle it
    throw error;
  }
}

/**
 * Fetch token decimals directly from the blockchain via RPC
 * Used as fallback when 0x API doesn't have metadata for obscure tokens
 */
export async function fetchTokenDecimalsFromRPC(
  tokenAddress: string,
  chainId: number
): Promise<number> {
  // Default to 18 if RPC call fails
  const DEFAULT_DECIMALS = 18;

  // RPC URLs for supported chains
  const rpcUrls: Record<number, string> = {
    1: 'https://eth.llamarpc.com',
    8453: 'https://mainnet.base.org',
    56: 'https://bsc-dataseed.bnbchain.org',
    42161: 'https://arb1.arbitrum.io/rpc',
    137: 'https://polygon-rpc.com',
    10: 'https://mainnet.optimism.io',
    43114: 'https://api.avax.network/ext/bc/C/rpc',
    250: 'https://rpc.ftm.tools',
  };

  const rpcUrl = rpcUrls[chainId];
  if (!rpcUrl) {
    console.warn(`[RPC] No RPC URL for chain ${chainId}, using default decimals`);
    return DEFAULT_DECIMALS;
  }

  try {
    // decimals() selector = 0x313ce567
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          { to: tokenAddress, data: '0x313ce567' },
          'latest'
        ],
        id: 1
      }),
    });

    if (!response.ok) {
      console.warn(`[RPC] Failed to fetch decimals for ${tokenAddress}: HTTP ${response.status}`);
      return DEFAULT_DECIMALS;
    }

    const data = await response.json() as { result?: string; error?: unknown };
    if (data.result && data.result !== '0x') {
      const decimals = parseInt(data.result, 16);
      if (decimals >= 0 && decimals <= 24) {
        console.log(`[RPC] Fetched decimals for ${tokenAddress}: ${decimals}`);
        return decimals;
      }
    }

    console.warn(`[RPC] Invalid decimals response for ${tokenAddress}:`, data);
    return DEFAULT_DECIMALS;
  } catch (error) {
    console.error(`[RPC] Error fetching decimals for ${tokenAddress}:`, error);
    return DEFAULT_DECIMALS;
  }
}

// Cache for token metadata to reduce API calls
const tokenMetadataCache = new Map<string, { data: ZeroExTokenMetadata | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get token metadata from 0x API
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID
 * @returns Token metadata or null
 */
export async function getZeroExTokenMetadata(
  tokenAddress: string,
  chainId: number
): Promise<ZeroExTokenMetadata | null> {
  const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;

  // Check cache first
  const cached = tokenMetadataCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Get the appropriate base URL for the chain
    const baseUrl = CHAIN_BASE_URLS[chainId] || ZEROX_BASE_URL;

    const params = new URLSearchParams({
      token: tokenAddress,
    });

    // For chain-specific base URLs, we should NOT include chainId in the URL
    // For the main api.0x.org, we need to include chainId.
    const isChainSpecificBaseUrl = baseUrl !== ZEROX_BASE_URL;
    const url = isChainSpecificBaseUrl
      ? `${baseUrl}/token/v1/metadata?${params.toString()}`
      : `${ZEROX_BASE_URL}/token/v1/metadata?chainId=${chainId}&${params.toString()}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (ZEROX_API_KEY) {
      headers['0x-api-key'] = ZEROX_API_KEY;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      const data = await response.json() as ZeroExTokenMetadata;
      // Cache successful response
      tokenMetadataCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    }

    // Don't log 404 as warning - it's expected for many tokens
    if (response.status === 404) {
      // Cache 404 to prevent repeated requests
      tokenMetadataCache.set(cacheKey, { data: null, timestamp: Date.now() });
    } else {
      const errorText = await response.text();
      console.warn(`[0x API] Token metadata request failed: ${response.status}`, errorText);
    }
  } catch (error) {
    console.error('[0x API] Error fetching token metadata:', error);
  }

  const normalized = tokenAddress.toLowerCase();
  console.log(`[0x API] Fallback lookup: normalized=${normalized}, chainId=${chainId}, hasChainData=${!!FALLBACK_TOKEN_METADATA[chainId]}`);
  const fallback = FALLBACK_TOKEN_METADATA[chainId]?.[normalized];
  if (fallback) {
    console.log(`[0x API] Using fallback token metadata for ${fallback.symbol} on chain ${chainId}`);
    return fallback;
  }

  // If 0x API and fallback both fail, try fetching decimals from RPC
  console.log(`[0x API] No fallback for ${normalized} on chain ${chainId}, available fallbacks:`, Object.keys(FALLBACK_TOKEN_METADATA[chainId] || {}));
  console.log(`[0x API] No token metadata available for ${tokenAddress} on chain ${chainId}, trying RPC fallback...`);
  const decimals = await fetchTokenDecimalsFromRPC(tokenAddress, chainId);
  return {
    symbol: 'UNKNOWN',
    name: 'Unknown Token',
    decimals,
    address: tokenAddress,
  };
}

/**
 * Convert token amount to wei (smallest unit)
 */
export function toWei(amount: string | number, decimals: number = 18): string {
  const amountStr = typeof amount === 'number' ? amount.toString() : amount;
  if (!amountStr || isNaN(Number(amountStr))) {
    return '0';
  }

  const [integerPart = '0', fractionalPart = ''] = amountStr.split('.');
  const sanitizedInteger = integerPart.replace(/^0+/, '') || '0';
  const truncatedFraction = fractionalPart.slice(0, decimals);
  const paddedFraction = truncatedFraction.padEnd(decimals, '0');

  const integerWei = BigInt(sanitizedInteger) * (10n ** BigInt(decimals));
  const fractionWei = paddedFraction ? BigInt(paddedFraction) : 0n;

  return (integerWei + fractionWei).toString();
}

export function isNativeToken(address?: string | null): boolean {
  if (!address) return true;
  const normalized = address.toLowerCase();
  return normalized === '0x0000000000000000000000000000000000000000' || normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
}

export function getNativeTokenAddress(chainId: number): string | undefined {
  const wrappedNativeAddresses: Record<number, string> = {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    10: '0x4200000000000000000000000000000000000006',
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    250: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
    42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    8453: '0x4200000000000000000000000000000000000006',
  };
  return wrappedNativeAddresses[chainId];
}

export function getDefaultTakerAddress(chainId: number): string | undefined {
  const takerMap: Record<number, string> = {
    1: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
    10: '0xf740b67Da229E02E40Eb673cA13e92B3205B0600',
    56: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
    137: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
    250: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
    42161: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
    43114: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
    8453: '0xf740b67Da229E02E40Eb673cA13e92B3205B0600',
  };
  return takerMap[chainId];
}

/**
 * Get token price in USD using 0x API
 * This uses a stablecoin pair (USDC/USDT) to get USD price
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID
 * @returns Price in USD or null
 */
export async function getTokenPriceUSD(
  tokenAddress: string,
  chainId: number
): Promise<number | null> {
  try {
    // Handle native token - use wrapped native token address (WETH, WBNB, etc.)
    let actualTokenAddress = tokenAddress;
    if (tokenAddress === '0x0000000000000000000000000000000000000000' || !tokenAddress) {
      // Use getNativeTokenAddress which returns the wrapped native token for each chain
      const wrappedNativeAddress = getNativeTokenAddress(chainId);
      if (wrappedNativeAddress) {
        actualTokenAddress = wrappedNativeAddress;
      } else {
        console.warn(`[0x API] No wrapped native token address for chain ${chainId}`);
        return null;
      }
    }

    // Get token metadata to determine decimals
    const tokenMetadata = await getZeroExTokenMetadata(actualTokenAddress, chainId);
    const tokenDecimals = tokenMetadata?.decimals || 18;

    // Use USDC as reference (most chains have USDC)
    const usdcAddresses: Record<number, string> = {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913', // USDC on Base
      42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC on Arbitrum
      56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC on BSC
      137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
      10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC on Optimism
    };

    const usdcAddress = usdcAddresses[chainId];
    if (!usdcAddress) {
      console.warn(`[0x API] No USDC address for chain ${chainId}`);
      return null;
    }

    // Get USDC metadata to determine its decimals
    const usdcMetadata = await getZeroExTokenMetadata(usdcAddress, chainId);
    const usdcDecimals = usdcMetadata?.decimals || 6;

    // Calculate 1 token unit with correct decimals
    const oneToken = toWei('1', tokenDecimals);

    const price = await getZeroExPrice(
      actualTokenAddress,
      usdcAddress,
      oneToken,
      chainId
    );

    if (!price || !price.buyAmount) {
      return null;
    }

    // Convert buyAmount (USDC) to number using correct decimals
    const usdcAmount = parseFloat(price.buyAmount) / Math.pow(10, usdcDecimals);
    return usdcAmount;
  } catch (error) {
    console.error('[0x API] Error fetching token price:', error);
    return null;
  }
}


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
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { callRpc } from './rpcManager.js';

const ZEROX_BASE_URL = 'https://api.0x.org';
const ZEROX_API_KEY = env.apiKeys.zeroEx || '';

// Chain ID mapping for 0x API (verified supported chains only)
// Based on: https://0x.org/docs/introduction/0x-cheat-sheet#-chain-support
const CHAIN_ID_MAP: Record<number, string> = {
  1: '1',        // Ethereum - ✅ Verified
  8453: '8453',  // Base - ✅ Verified  
  42161: '42161', // Arbitrum - ✅ Verified
  56: '56',      // BSC - ✅ Verified
  137: '137',    // Polygon - ✅ Verified
  10: '10',      // Optimism - ✅ Verified
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

// 0x API v2 Response Interfaces (based on official examples)
export interface ZeroExPrice {
  blockNumber?: string;
  buyAmount: string;
  buyToken: string;
  fees: {
    integratorFee: {
      amount: string;
      token: string;
      type: string;
    } | null;
    zeroExFee: {
      amount: string;
      token: string;
      type: string;
    };
    gasFee: null;
  } | null;
  gas: string;
  gasPrice: string;
  grossBuyAmount?: string;
  grossSellAmount?: string;
  issues: {
    allowance: {
      actual: string;
      spender: string;
    } | null;
    balance: null;
    simulationIncomplete: boolean;
    invalidSourcesPassed: any[];
  };
  liquidityAvailable?: boolean; // CRITICAL: Check this before using quote
  minBuyAmount?: string;
  price: string;
  route?: any;
  sellAmount: string;
  sellToken: string;
  totalNetworkFee?: string;
  zid?: string;
  validationErrors?: Array<{
    field: string;
    code: number;
    reason: string;
  }>; // API validation errors (e.g., sellAmount too low)
  // Legacy fields for backward compatibility
  allowanceTarget?: string;
  to?: string;
  data?: string;
  value?: string;
  estimatedGas?: string;
}

export interface ZeroExQuote extends ZeroExPrice {
  transaction: {
    to: string;
    data: string;
    gas: string | null;
    gasPrice: string;
    value: string;
  };
  tokenMetadata?: {
    buyToken: {
      buyTaxBps: string;
      sellTaxBps: string;
    };
    sellToken: {
      buyTaxBps: string;
      sellTaxBps: string | null;
    };
  };
  // Additional quote-specific fields
  guaranteedPrice?: string;
  estimatedPriceImpact?: string;
  sources?: Array<{
    name: string;
    proportion: string;
  }>;
  orders?: any[];
}

export interface ZeroExTokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

export interface ZeroExAffiliateFee {
  affiliateAddress: string; // 0x... recipient
  buyTokenPercentageFeeBps: number; // e.g. 50 = 0.5%
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
  chainId: number,
  signal?: AbortSignal
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

    logger.debug(LogCode.API_FETCH_SUCCESS, '0x API price request', { url });

    // Add timeout for 0x API price calls (10 seconds)
    const data = await fetchJson<ZeroExPrice>({
      url,
      method: 'GET',
      headers,
      timeout: 10000,
      signal
    });

    // Check if liquidity is available

    // Check if liquidity is available
    if (data.liquidityAvailable === false) {
      logger.warn(LogCode.API_FETCH_FAILED, '0x API price returned liquidityAvailable=false', {
        sellToken,
        buyToken,
        chainId
      });
      return null; // No liquidity available for price
    }

    logger.info(LogCode.API_FETCH_SUCCESS, '0x API price received successfully', {
      sellToken,
      buyToken,
      chainId,
      liquidityAvailable: data.liquidityAvailable ?? 'not-specified'
    });
    return data;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, '0x API price fetch error', { error: error.message });
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
  takerAddress?: string, // User's wallet address - CRITICAL for actual swaps
  affiliateFee?: ZeroExAffiliateFee,
  quoteOnly: boolean = false // Set true for price quotes that won't execute
): Promise<ZeroExQuote | null> {
  try {
    // CRITICAL: takerAddress is REQUIRED for allowance-holder endpoint (both price and quote)
    // If no takerAddress is provided, we must use the /price endpoint instead
    if (!takerAddress || takerAddress.length !== 42 || !takerAddress.startsWith('0x')) {
      if (!quoteOnly) {
        logger.error(LogCode.API_FETCH_FAILED, 'Invalid takerAddress - this is REQUIRED to receive swap output', { takerAddress, chainId });
        throw new Error(`takerAddress is required for swap execution. Got: ${takerAddress}`);
      }
      // For price quotes without a taker address, use the /price endpoint instead
      logger.debug(LogCode.API_FETCH_SUCCESS, '0x API: No taker address provided, using /price endpoint for indicative quote', { chainId });
      const priceData = await getZeroExPrice(sellToken, buyToken, sellAmount, chainId);
      if (!priceData) {
        return null;
      }
      // Transform price response to quote format
      return {
        ...priceData,
        transaction: {
          to: priceData.to || '',
          data: priceData.data || '',
          gas: priceData.gas || null,
          gasPrice: priceData.gasPrice || '',
          value: priceData.value || '0',
        },
      } as ZeroExQuote;
    }
    // Validate sellAmount - must be greater than 0
    const sellAmountBigInt = BigInt(sellAmount || '0');
    if (sellAmountBigInt === 0n) {
      logger.error(LogCode.API_FETCH_FAILED, 'Invalid sellAmount: must be greater than 0', { sellAmount, sellToken, buyToken, chainId });
      return null;
    }

    // Get the appropriate base URL for the chain
    const baseUrl = CHAIN_BASE_URLS[chainId] || ZEROX_BASE_URL;

    // Polygon: Try permit2 endpoint first (via main API), fallback to v1 if needed
    // Other chains (Arbitrum, Optimism, Base, BSC) use permit2 endpoint via main API with chainId param

    // CRITICAL: Use AllowanceHolder, NOT Permit2
    // AllowanceHolder is recommended for most integrators - simpler UX, lower gas, no double signatures
    // Permit2 requires complex EIP-712 signing which our current setup doesn't handle
    const useLegacyEndpoint = false; // False = use allowance-holder (V2)
    const isPolygon = chainId === 137;

    // Normalize native token addresses
    // allowance-holder endpoint accepts 0xEeee... format for native tokens
    const normalizeToken = (token: string, isSell: boolean): string => {
      const isNative = token.toLowerCase() === '0x0000000000000000000000000000000000000000'
        || token.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      if (!isNative) {
        return token;
      }

      // For allowance-holder endpoint, use 0xEeee... format
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
      // CRITICAL FIX: Disable sellEntireBalance to avoid conflicts
      // sellEntireBalance causes issues when combined with explicit sellAmount
      // especially for tokens with transfer restrictions or high taxes
      // Instead, we explicitly pass the amount we want to sell
      // sellEntireBalance: 'true',
    });

    // Add slippage parameter based on endpoint type
    if (useLegacyEndpoint) {
      // v1 endpoint: slippagePercentage as decimal (0.005 = 0.5%, 0.03 = 3%)
      // slippageBps is in basis points (50 = 0.5%, 300 = 3%)
      // Convert: bps / 10000 = decimal (50 / 10000 = 0.005)
      params.append('slippagePercentage', (slippageBps / 10000).toString());
    } else {
      // allowance-holder endpoint uses slippageBps in basis points (50 = 0.5%)
      params.append('slippageBps', Math.round(slippageBps).toString());
    }

    // Use allowance-holder endpoint (recommended approach)
    // This is the standard V2 flow - no complex permit2 signatures needed
    const endpoint = useLegacyEndpoint ? '/swap/v1/quote' : '/swap/allowance-holder/quote';

    // CRITICAL: taker parameter is REQUIRED for allowance-holder endpoint
    // At this point, takerAddress is guaranteed to be valid (checked above)
    // v1 endpoint uses 'takerAddress', permit2/allowance-holder uses 'taker'
    if (useLegacyEndpoint) {
      params.append('takerAddress', takerAddress);
    } else {
      params.append('taker', takerAddress);
    }

    // Platform / affiliate fee (0x feature): fee is taken from buyToken and sent to affiliateAddress
    // V2 API uses swapFee parameters (recommended)
    if (affiliateFee && affiliateFee.buyTokenPercentageFeeBps > 0) {
      if (useLegacyEndpoint) {
        // V1 endpoint uses old parameters
        params.append('affiliateAddress', affiliateFee.affiliateAddress);
        params.append('buyTokenPercentageFee', (affiliateFee.buyTokenPercentageFeeBps / 10000).toString());
      } else {
        // V2 endpoint uses new swap fee parameters
        params.append('swapFeeRecipient', affiliateFee.affiliateAddress);
        params.append('swapFeeBps', affiliateFee.buyTokenPercentageFeeBps.toString());
        params.append('swapFeeToken', normalizeBuyToken);
        params.append('tradeSurplusRecipient', affiliateFee.affiliateAddress);
      }
    }

    // For chain-specific base URLs (bsc.api.0x.org, polygon.api.0x.org, etc.),
    // we should NOT include chainId in the URL as the base URL already specifies the chain.
    // For the main api.0x.org, we need to include chainId.
    const isChainSpecificBaseUrl = baseUrl !== ZEROX_BASE_URL;
    const url = isChainSpecificBaseUrl
      ? `${baseUrl}${endpoint}?${params.toString()}`
      : `${baseUrl}${endpoint}?chainId=${chainId}&${params.toString()}`;

    // Debug logging
    logger.debug(LogCode.API_FETCH_SUCCESS, '0x API Quote requesting', {
      endpoint: useLegacyEndpoint ? 'v1' : 'allowance-holder',
      chainId,
      sellToken: normalizeSellToken,
      buyToken: normalizeBuyToken,
      url: url.substring(0, 150) + '...', // Log partial URL for debugging
    });

    logger.debug(LogCode.API_FETCH_SUCCESS, '0x API Quote request', {
      sellToken: `${normalizeSellToken.slice(0, 6)}...${normalizeSellToken.slice(-4)}`,
      buyToken: `${normalizeBuyToken.slice(0, 6)}...${normalizeBuyToken.slice(-4)}`,
      amount: sellAmount,
      endpoint: 'allowance-holder'
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

    // Detail logs kept in debug level
    logger.debug(LogCode.API_FETCH_SUCCESS, '0x API Quote request details', {
      sellToken: normalizeSellToken,
      buyToken: normalizeBuyToken,
      sellAmount,
      slippageBps: Math.round(slippageBps),
      chainId,
      takerAddress: takerAddress || 'not-specified',
      endpoint: useLegacyEndpoint ? 'v1' : 'allowance-holder',
    });

    // Fetch quote from 0x API using unified service
    let rawData: any = null;
    let responseWasOk = false;
    let httpStatus = 0;
    let httpStatusText = '';

    try {
      rawData = await fetchJson<any>({
        url,
        method: 'GET',
        headers,
        timeout: 15000
      });
      responseWasOk = true;
      httpStatus = 200; // fetchJson only succeeds for 2xx responses
    } catch (e: any) {
      responseWasOk = false;

      // Extract HTTP status from error message (format: "HTTP 404: Not Found")
      const statusMatch = e.message.match(/HTTP (\d+):\s*(.+)/);
      if (statusMatch) {
        httpStatus = parseInt(statusMatch[1], 10);
        httpStatusText = statusMatch[2];
      } else {
        httpStatus = 500;
        httpStatusText = e.message;
      }

      logger.debug(LogCode.API_FETCH_FAILED, '0x API quote request failed', {
        status: httpStatus,
        error: httpStatusText,
        chainId
      });
    }

    // Check if response has valid transaction data
    // allowance-holder endpoint returns { transaction: { to, data, value }, buyAmount, ... }
    // v1 endpoint returns { to, data, value, buyAmount, ... } directly
    const hasValidData = rawData && (
      (rawData.transaction?.to && rawData.transaction?.data) || // permit2 format
      (rawData.to && rawData.data) || // v1 format
      rawData.buyAmount // At minimum should have buyAmount
    );

    // If permit2 endpoint fails OR returns empty data for certain chains, try v1 endpoint as fallback
    // Supported chains for fallback: Base (8453), Arbitrum (42161), Optimism (10), Polygon (137), BSC (56)
    const chainsWithFallback = [8453, 42161, 10, 137, 56]; // Base, Arbitrum, Optimism, Polygon, BSC
    if ((!responseWasOk || !hasValidData) && !useLegacyEndpoint && chainsWithFallback.includes(chainId)) {
      const originalErrorText = !responseWasOk
        ? httpStatusText
        : `Empty response: ${JSON.stringify(rawData)}`;

      logger.warn(LogCode.API_FETCH_FAILED, `0x API allowance-holder endpoint returned error, attempting v1 fallback`, {
        status: httpStatus,
        chainId,
        hasValidData,
        attemptedEndpoint: 'allowance-holder',
        sellToken: normalizeSellToken.slice(0, 10) + '...',
        buyToken: normalizeBuyToken.slice(0, 10) + '...',
        reason: !responseWasOk ? 'HTTP error' : 'Invalid response data',
        error: originalErrorText.substring(0, 100)
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
        // v1 expects decimal percent (0.005 = 0.5%)
        slippagePercentage: (slippageBps / 10000).toString(),
      });

      // v1 endpoint uses 'takerAddress' parameter (if provided)
      if (takerAddress) {
        fallbackParams.append('takerAddress', takerAddress);
      }

      if (affiliateFee && affiliateFee.buyTokenPercentageFeeBps > 0) {
        fallbackParams.append('affiliateAddress', affiliateFee.affiliateAddress);
        fallbackParams.append('buyTokenPercentageFee', (affiliateFee.buyTokenPercentageFeeBps / 10000).toString());
      }

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

      logger.debug(LogCode.API_FETCH_SUCCESS, 'Trying 0x API v1 fallback', { fallbackUrl });

      try {
        const fallbackData = await fetchJson<any>({
          url: fallbackUrl,
          method: 'GET',
          headers: fallbackHeaders
        });

        logger.info(LogCode.API_FETCH_SUCCESS, '0x API Fallback to v1 endpoint succeeded');
        rawData = fallbackData;
        responseWasOk = true;

        // Transform fallback data to expected format if needed
        // But here we just return the compatible shape below
        const data: ZeroExQuote = {
          ...rawData,
          to: rawData.to,
          data: rawData.data,
          value: rawData.value || '0',
          gas: rawData.gas,
          gasPrice: rawData.gasPrice,
          allowanceTarget: rawData.allowanceTarget || rawData.issues?.allowance?.spender,
        };
        return data;

      } catch (fallbackError: any) {
        // Fallback fetch itself failed (network error, timeout, etc.)
        logger.warn(LogCode.API_FETCH_FAILED, '0x API v1 fallback fetch failed', {
          error: fallbackError.message,
          originalError: originalErrorText
        });
        // Keep original response and error state to handle below
        // response is still the original failed response
        // responseWasOk is already false or we wouldn't be here (unless it was invalid data)
        // If it was invalid data, we want to fail now.
        if (responseWasOk && !hasValidData) {
          // It was a valid HTTP response but invalid data, and fallback failed.
          // We should probably treat it as failed.
          responseWasOk = false;
          httpStatus = 502; // Bad Gateway / Invalid Upstream Response
          httpStatusText = 'Invalid Data from Primary, Fallback Failed: ' + fallbackError.message;
        }
        rawData = null;
      }
    }

    // Note: v0 endpoint doesn't exist for BSC, so we skip that fallback
    // The 404 error likely indicates insufficient liquidity or unsupported token pair

    if (!responseWasOk || !rawData) {
      logger.error(LogCode.API_FETCH_FAILED, `0x API Quote request failed`, {
        status: httpStatus,
        statusText: httpStatusText,
        chainId,
        sellToken: normalizeSellToken,
        buyToken: normalizeBuyToken
      });

      // For 404 errors, provide more helpful message
      if (httpStatus === 404) {
        throw new Error(`0x API error (404): No route found. Request details: sellToken=${normalizeSellToken}, buyToken=${normalizeBuyToken}, sellAmount=${sellAmount} (raw), chainId=${chainId}. This may indicate insufficient liquidity for this amount or the token pair is not supported.`);
      }

      throw new Error(`0x API error (${httpStatus}): ${httpStatusText}`);
    }



    logger.info(LogCode.API_FETCH_SUCCESS, '0x API Quote received successfully', {
      sellToken,
      buyToken,
      buyAmount: rawData.buyAmount,
      usedEndpoint: useLegacyEndpoint ? 'v1' : 'allowance-holder'
    });

    // 0x API v2 (allowance-holder) returns { transaction: { to, data, value, ... }, ... }
    // 0x API v1 returns { to, data, value, ... } directly
    // We need to flatten v2 for backward compatibility
    let quoteValue = rawData.transaction?.value || rawData.value || '0';

    // CRITICAL: For native token sell, ensure value is set to sellAmount
    // The API should return this, but we validate it for safety
    const isNativeSell = sellToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      sellToken.toLowerCase() === '0x0000000000000000000000000000000000000000';
    if (isNativeSell && (!quoteValue || quoteValue === '0')) {
      quoteValue = sellAmount; // Force value to match sellAmount for native token
    }

    const allowanceTarget = rawData.allowanceTarget || rawData.issues?.allowance?.spender;

    const data: ZeroExQuote = {
      ...rawData,
      to: rawData.transaction?.to || rawData.to,
      data: rawData.transaction?.data || rawData.data,
      value: quoteValue,
      gas: rawData.transaction?.gas || rawData.gas,
      gasPrice: rawData.transaction?.gasPrice || rawData.gasPrice,
      allowanceTarget,
      transaction: rawData.transaction || {
        to: rawData.to,
        data: rawData.data,
        gas: rawData.gas,
        gasPrice: rawData.gasPrice,
        value: quoteValue,
      },
    };

    // Compact log for quote response
    logger.debug(LogCode.API_FETCH_SUCCESS, '0x API Quote response', {
      buyAmount: data.buyAmount,
      gas: data.gas,
      hasAllowanceIssue: !!data.issues?.allowance,
      hasBalanceIssue: !!data.issues?.balance,
      liquidityAvailable: data.liquidityAvailable,
    });

    logger.debug(LogCode.API_FETCH_SUCCESS, '0x API Flattened quote data', {
      to: data.to?.substring(0, 10),
      buyAmount: data.buyAmount,
    });

    // CRITICAL VALIDATION: Check for API validation errors first
    if (data.validationErrors && data.validationErrors.length > 0) {
      const errorMessages = data.validationErrors.map(e => `${e.field}: ${e.reason}`).join(', ');
      logger.warn(LogCode.API_FETCH_FAILED, '0x API returned validation errors', {
        errors: errorMessages,
        sellToken: normalizeSellToken.slice(0, 12),
        buyToken: normalizeBuyToken.slice(0, 12),
      });
      throw new Error(`0x API validation error: ${errorMessages}`);
    }

    // CRITICAL VALIDATION: Check liquidity (based on official examples)
    if (data.liquidityAvailable === false) {
      logger.warn(LogCode.API_FETCH_FAILED, '0x API returned liquidityAvailable=false', {
        sellToken: normalizeSellToken.slice(0, 12),
        buyToken: normalizeBuyToken.slice(0, 12),
        sellAmount,
      });
      throw new Error(`Insufficient liquidity for this trade. Try a smaller amount or different token pair.`);
    }

    // CRITICAL VALIDATION: Ensure the quote has valid transaction data
    // If to/data are missing, the token is likely not tradeable via DEX aggregators
    // (e.g., Four.meme tokens that can only be traded via TokenManager contract)
    if (!data.to || !data.data) {
      logger.error(LogCode.API_FETCH_FAILED, '0x API Quote has invalid/missing transaction data', {
        buyToken,
        sellToken,
        chainId,
      });
      throw new Error(`0x API error: No valid swap route found for token ${buyToken}. This token may only be tradeable via its native platform (e.g., Four.meme, Pump.fun).`);
    }

    if (!data.buyAmount || data.buyAmount === '0') {
      logger.error(LogCode.API_FETCH_FAILED, '0x API Quote has invalid buyAmount', {
        buyAmount: data.buyAmount,
        buyToken: buyToken,
        chainId,
      });
      throw new Error(`0x API error: Zero or invalid output amount for token ${buyToken}. Check liquidity or try a smaller amount.`);
    }

    logger.info(LogCode.API_FETCH_SUCCESS, '0x API Quote successful', {
      sellToken: normalizeSellToken.slice(0, 12),
      buyToken: normalizeBuyToken.slice(0, 12),
      buyAmount: data.buyAmount,
      hasAllowanceIssue: !!data.issues?.allowance,
      usedEndpoint: useLegacyEndpoint ? 'v1' : 'allowance-holder'
    });

    return data;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, '0x API Error fetching quote', { error: error.message });
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

  try {
    // decimals() selector = 0x313ce567
    const result = await callRpc<string>(chainId, 'eth_call', [
      { to: tokenAddress, data: '0x313ce567' },
      'latest'
    ]);

    if (result && result !== '0x') {
      const decimals = parseInt(result, 16);
      if (decimals >= 0 && decimals <= 24) {
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetched decimals from RPC', { tokenAddress, decimals });
        return decimals;
      }
    }

    logger.warn(LogCode.API_FETCH_FAILED, 'Invalid decimals response from RPC', { tokenAddress, result });
    return DEFAULT_DECIMALS;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Error fetching decimals from RPC', { tokenAddress, error: error.message });
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
      logger.warn(LogCode.API_FETCH_FAILED, '0x API Token metadata request failed', { status: response.status, error: errorText });
    }
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, '0x API Error fetching token metadata', { error: error.message });
  }

  const normalized = tokenAddress.toLowerCase();
  const fallback = FALLBACK_TOKEN_METADATA[chainId]?.[normalized];
  if (fallback) {
    logger.info(LogCode.API_FETCH_SUCCESS, 'Using 0x API fallback token metadata', { symbol: fallback.symbol, chainId });
    return fallback;
  }

  // If 0x API and fallback both fail, try fetching decimals from RPC
  logger.info(LogCode.API_FETCH_SUCCESS, 'No token metadata available, trying RPC fallback...', { tokenAddress, chainId });
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
    // Use USDC as reference (most chains have USDC)
    const usdcAddresses: Record<number, string> = {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913', // USDC on Base
      42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC on Arbitrum
      56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC on BSC
      137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
      10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC on Optimism (native)
    };

    const usdcAddress = usdcAddresses[chainId];
    if (!usdcAddress) {
      console.warn(`[0x API] No USDC address for chain ${chainId}`);
      return null;
    }

    // CRITICAL FIX: If token IS USDC itself, return 1.0 (don't call API with same token)
    if (tokenAddress.toLowerCase() === usdcAddress.toLowerCase()) {
      return 1.0;
    }

    // Polygon native USDC (0x3c499...) should also be treated as $1
    if (chainId === 137 && tokenAddress.toLowerCase() === '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359') {
      return 1.0;
    }

    // Handle native token - use wrapped native token address (WETH, WBNB, etc.)
    let actualTokenAddress = tokenAddress;
    const lowerToken = tokenAddress?.toLowerCase() || '';
    if (lowerToken === '0x0000000000000000000000000000000000000000' ||
      lowerToken === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      !tokenAddress) {
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

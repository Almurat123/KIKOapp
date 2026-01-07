import { tokenApi } from '../services/api';
import type { SwapCardData } from '../components/Chat/SwapCardChat';

/**
 * Network mapping from chain names/IDs to API network format
 */
const NETWORK_MAP: Record<string, string> = {
  '1': 'eth',
  'eth': 'eth',
  'ethereum': 'eth',
  '8453': 'base',
  'base': 'base',
  '56': 'bsc',
  'bsc': 'bsc',
  'binance': 'bsc',
  '42161': 'arbitrum',
  'arbitrum': 'arbitrum',
  '137': 'polygon',
  'polygon': 'polygon',
  '10': 'optimism',
  'optimism': 'optimism',
  'op': 'optimism',
  '43114': 'avalanche',
  'avalanche': 'avalanche',
  'avax': 'avalanche',
  '250': 'fantom',
  'fantom': 'fantom',
  '900': 'solana',
  'solana': 'solana',
  'sol': 'solana',
};

/**
 * Default network if not specified
 */
const DEFAULT_NETWORK = 'eth';

/**
 * Format number with commas and decimals
 */
function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';

  // For very small numbers, use more decimal places to preserve precision
  if (num > 0 && num < 0.0001) {
    // Use up to 8 decimal places for very small numbers
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  }

  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format USD value
 */
function formatUSD(value: number | string): string {
  return `$${formatNumber(value, 2)}`;
}

/**
 * Calculate swap rate (1 tokenIn = X tokenOut)
 */
function calculateRate(
  tokenInPrice: number,
  tokenOutPrice: number,
  tokenInSymbol: string,
  tokenOutSymbol: string
): string {
  if (!tokenInPrice || !tokenOutPrice || tokenInPrice === 0) {
    return 'Calculating...';
  }

  const rate = tokenOutPrice / tokenInPrice;

  // Format: "1 TOKEN_IN = X TOKEN_OUT"
  return `1 ${tokenInSymbol} = ${formatNumber(rate, 4)} ${tokenOutSymbol}`;
}

/**
 * Calculate price impact (simplified)
 */
function calculatePriceImpact(
  tokenInPrice: number,
  tokenOutPrice: number,
  liquidity?: number
): string {
  if (!tokenInPrice || !tokenOutPrice) {
    return '~0.01%';
  }

  // Simplified price impact calculation
  // In real implementation, this would use DEX liquidity data
  const baseImpact = 0.01; // 0.01% base impact
  const liquidityFactor = liquidity && liquidity > 0
    ? Math.min(1, 1000000 / liquidity) // Lower liquidity = higher impact
    : 0.5;

  const impact = baseImpact * (1 + liquidityFactor);
  return `~${formatNumber(impact, 2)}%`;
}

/**
 * Get slippage setting (default: Auto 0.5%)
 */
function getSlippageSetting(slippageBps?: number): string {
  if (!slippageBps) {
    return 'Auto (0.5%)';
  }

  const slippagePercent = slippageBps / 100;
  return slippagePercent <= 0.5 ? `Auto (${slippagePercent}%)` : `${slippagePercent}%`;
}

/**
 * Get fallback token image URL from Trust Wallet or other sources
 */
function getTokenImageUrl(network: string, address?: string, symbol?: string): string | undefined {
  if (!address) return undefined;

  // Trust Wallet image URL format
  // https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{address}/logo.png
  const chainMap: Record<string, string> = {
    'eth': 'ethereum',
    'base': 'base',
    'bsc': 'smartchain',
    'arbitrum': 'arbitrum',
    'polygon': 'polygon',
    'optimism': 'optimism',
    'avax': 'avalanchec',
    'fantom': 'fantom',
  };

  const chainName = chainMap[network.toLowerCase()];
  if (chainName && address) {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${address}/logo.png`;
  }

  return undefined;
}

async function fetchTokenData(
  network: string,
  identifier: string
): Promise<{
  symbol: string;
  name: string;
  address?: string;
  price?: number;
  imageUrl?: string;
  liquidity?: number;
} | null> {
  try {
    // First, try to find token in COMMON_TOKENS
    const networkToChainId: Record<string, number> = {
      'eth': 1,
      'ethereum': 1,
      'base': 8453,
      'bsc': 56,
      'binance': 56,
      'arbitrum': 42161,
      'polygon': 137,
      'optimism': 10,
      'avalanche': 43114,
      'avax': 43114,
      'fantom': 250,
      'solana': 900,
      'sol': 900,
    };
    const chainId = networkToChainId[network.toLowerCase()] || 1;

    // Try to get from COMMON_TOKENS
    const { COMMON_TOKENS } = await import('../services/tokenDataService');
    const chainTokens = COMMON_TOKENS[chainId];
    if (chainTokens) {
      // Check if identifier matches a token symbol
      const tokenSymbol = identifier.toUpperCase();
      const token = chainTokens[tokenSymbol];
      if (token) {
        console.log(`[swapDataFetcher] ✓ Found ${tokenSymbol} in COMMON_TOKENS for chain ${chainId}`);
        return {
          symbol: token.symbol,
          name: token.name,
          address: token.address,
          imageUrl: token.logoURI,
        };
      }
    }

    // For Solana network, use different logic
    if (chainId === 900) {
      console.log(`[swapDataFetcher] Fetching Solana token: ${identifier}`);

      // Check if identifier is a Solana address (base58, 32-44 chars)
      const isSolanaAddress = identifier.length >= 32 && identifier.length <= 44 &&
        /^[1-9A-HJ-NP-Za-km-z]+$/.test(identifier);

      if (isSolanaAddress) {
        // Try GeckoTerminal for Solana tokens
        try {
          const { getTokenData } = await import('../services/tokenDataService');
          const tokenData = await getTokenData(identifier, 900);

          if (tokenData && tokenData.symbol !== 'UNKNOWN') {
            console.log(`[swapDataFetcher] ✓ Got Solana token from GeckoTerminal:`, tokenData.symbol);
            return {
              symbol: tokenData.symbol,
              name: tokenData.name,
              address: tokenData.address,
              price: tokenData.price,
              imageUrl: tokenData.logoURI,
            };
          }
        } catch (error) {
          console.warn('[swapDataFetcher] Failed to fetch Solana token from GeckoTerminal:', error);
        }

        // Fallback: return basic info
        return {
          symbol: 'UNKNOWN',
          name: 'Unknown Solana Token',
          address: identifier,
          imageUrl: undefined,
        };
      } else {
        // Symbol-based search for Solana - check COMMON_TOKENS again
        console.warn(`[swapDataFetcher] Solana token symbol not found in COMMON_TOKENS: ${identifier}`);
        return null;
      }
    }

    // For EVM chains, continue with existing logic
    // Check if identifier is a contract address
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(identifier);

    let tokenData: any = null;

    if (isAddress) {
      // Fetch by address
      console.log(`[swapDataFetcher] Fetching token by address: ${identifier} on ${network}`);
      tokenData = await tokenApi.getDetails(network, identifier);

      // If backend returns empty/invalid data, try DexScreener as fallback
      if (!tokenData || !tokenData.symbol || !tokenData.name) {
        console.warn(`[swapDataFetcher] Backend returned invalid data, trying DexScreener fallback...`);
        try {
          // Use tokenDataService to get data from DexScreener
          const { getTokenData } = await import('../services/tokenDataService');
          const dexData = await getTokenData(identifier, chainId);

          if (dexData && dexData.symbol !== 'UNKNOWN') {
            console.log(`[swapDataFetcher] ✓ Got data from DexScreener:`, dexData.symbol);
            tokenData = {
              symbol: dexData.symbol,
              name: dexData.name,
              address: dexData.address,
              price: dexData.price,
              imageUrl: dexData.logoURI,
            };
          }
        } catch (fallbackError) {
          console.warn('[swapDataFetcher] DexScreener fallback also failed:', fallbackError);
        }
      }
    } else {
      // Search by symbol/name
      console.log(`[swapDataFetcher] Searching token by symbol/name: ${identifier} on ${network}`);
      const results = await tokenApi.search(identifier, network);
      if (results.length > 0) {
        tokenData = results[0];
        console.log(`[swapDataFetcher] Found token: ${tokenData.symbol} (${tokenData.name})`);
      } else {
        console.warn(`[swapDataFetcher] No token found for: ${identifier} on ${network}`);
      }
    }

    if (!tokenData) {
      console.error(`[swapDataFetcher] Failed to fetch token data for ${identifier} on ${network}`);
      return null;
    }

    // Validate token data
    if (!tokenData.symbol || !tokenData.name) {
      console.error(`[swapDataFetcher] Invalid token data structure:`, tokenData);
      return null;
    }

    // Get image URL - prefer API response, fallback to Trust Wallet
    let imageUrl = tokenData.imageUrl;
    if (!imageUrl && tokenData.address) {
      imageUrl = getTokenImageUrl(network, tokenData.address, tokenData.symbol);
    }

    const result = {
      symbol: tokenData.symbol,
      name: tokenData.name,
      address: tokenData.address,
      price: tokenData.price,
      imageUrl: imageUrl,
      liquidity: tokenData.liquidity,
    };

    console.log(`[swapDataFetcher] Token data fetched:`, {
      symbol: result.symbol,
      price: result.price,
      hasAddress: !!result.address,
      hasImage: !!result.imageUrl,
    });

    return result;
  } catch (error) {
    console.error(`[swapDataFetcher] Error fetching token data for ${identifier} on ${network}:`, error);
    return null;
  }
}

/**
 * Fetch swap data and format for SwapCard
 */
export async function fetchSwapData(
  tokenIn: string,
  tokenOut: string,
  amount: string | number,
  network?: string | number,
  slippageBps?: number
): Promise<SwapCardData | null> {
  try {
    console.log(`[swapDataFetcher] Fetching swap data:`, {
      tokenIn,
      tokenOut,
      amount,
      network,
      slippageBps,
    });

    // Normalize network
    const networkStr = network
      ? NETWORK_MAP[network.toString().toLowerCase()] || DEFAULT_NETWORK
      : DEFAULT_NETWORK;

    console.log(`[swapDataFetcher] Normalized network: ${networkStr}`);

    // Parse amount
    const amountNum = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    if (isNaN(amountNum) || amountNum <= 0) {
      console.error('[swapDataFetcher] Invalid amount:', amount);
      return null;
    }

    // Fetch both tokens in parallel
    console.log('[swapDataFetcher] Fetching token data in parallel...');
    const [tokenInData, tokenOutData] = await Promise.all([
      fetchTokenData(networkStr, tokenIn),
      fetchTokenData(networkStr, tokenOut),
    ]);

    if (!tokenInData) {
      console.error(`[swapDataFetcher] Failed to fetch tokenIn data: ${tokenIn}`);
      return null;
    }

    if (!tokenOutData) {
      console.error(`[swapDataFetcher] Failed to fetch tokenOut data: ${tokenOut}`);
      return null;
    }

    // Get prices - try from token data first, then fetch from price API if missing
    let tokenInPrice = tokenInData.price;
    let tokenOutPrice = tokenOutData.price;

    // If prices are missing, fetch from price API
    if ((!tokenInPrice || tokenInPrice === 0) || (!tokenOutPrice || tokenOutPrice === 0)) {
      console.log(`[swapDataFetcher] Missing price data, fetching from price API...`);

      // Map network to chainId
      const networkToChainId: Record<string, number> = {
        'eth': 1,
        'ethereum': 1,
        'base': 8453,
        'bsc': 56,
        'binance': 56,
        'arbitrum': 42161,
        'polygon': 137,
        'optimism': 10,
        'avalanche': 43114,
        'avax': 43114,
        'fantom': 250,
      };
      const chainId = networkToChainId[networkStr.toLowerCase()] || 1;

      // Get token addresses (use native token address if ETH)
      const getTokenAddress = (tokenData: any, symbol: string): string => {
        if (tokenData.address) return tokenData.address;
        // For native tokens like ETH, use WETH address
        if (symbol.toUpperCase() === 'ETH' && chainId === 1) {
          return '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
        }
        if (symbol.toUpperCase() === 'ETH' && chainId === 8453) {
          return '0x4200000000000000000000000000000000000006'; // WETH on Base
        }
        return '';
      };

      const tokenInAddress = getTokenAddress(tokenInData, tokenInData.symbol);
      const tokenOutAddress = getTokenAddress(tokenOutData, tokenOutData.symbol);

      if (tokenInAddress && tokenOutAddress) {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
          const priceResponse = await fetch(`${API_BASE_URL}/api/swap/prices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokenInAddress,
              tokenOutAddress,
              chainId,
            }),
          });

          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            if (priceData.success && priceData.data) {
              // Use prices from API if token data didn't have them
              if (!tokenInPrice || tokenInPrice === 0) {
                tokenInPrice = priceData.data.tokenInPrice || 0;
              }
              if (!tokenOutPrice || tokenOutPrice === 0) {
                tokenOutPrice = priceData.data.tokenOutPrice || 0;
              }
              console.log(`[swapDataFetcher] Fetched prices from API:`, {
                tokenInPrice,
                tokenOutPrice,
              });
            }
          }
        } catch (error) {
          console.error(`[swapDataFetcher] Error fetching prices from API:`, error);
        }
      }
    }

    // Fallback to default values for stablecoins if still no price
    if (!tokenInPrice || tokenInPrice === 0) {
      tokenInPrice = (tokenInData.symbol.toUpperCase() === 'USDC' || tokenInData.symbol.toUpperCase() === 'USDT') ? 1 : 0;
    }
    if (!tokenOutPrice || tokenOutPrice === 0) {
      tokenOutPrice = (tokenOutData.symbol.toUpperCase() === 'USDC' || tokenOutData.symbol.toUpperCase() === 'USDT') ? 1 : 0;
    }

    console.log(`[swapDataFetcher] Final token prices:`, {
      tokenIn: { symbol: tokenInData.symbol, price: tokenInPrice },
      tokenOut: { symbol: tokenOutData.symbol, price: tokenOutPrice },
    });

    if (!tokenInPrice || !tokenOutPrice) {
      console.warn(`[swapDataFetcher] Still missing price data after API fetch:`, {
        tokenInPrice,
        tokenOutPrice,
        tokenInSymbol: tokenInData.symbol,
        tokenOutSymbol: tokenOutData.symbol,
      });
    }

    // Calculate amounts
    const amountIn = amountNum;
    const amountOut = tokenInPrice && tokenOutPrice
      ? (amountIn * tokenOutPrice) / tokenInPrice
      : amountIn; // Fallback to same amount if prices unavailable

    console.log(`[swapDataFetcher] Calculated amounts:`, {
      amountIn,
      amountOut,
    });

    // Format amounts
    const formattedAmountIn = formatNumber(amountIn, 4);
    const formattedAmountOut = formatNumber(amountOut, 4);

    // Calculate USD values
    const usdValueIn = tokenInPrice ? amountIn * tokenInPrice : 0;
    const usdValueOut = tokenOutPrice ? amountOut * tokenOutPrice : 0;

    // Calculate rate
    const rate = calculateRate(tokenInPrice, tokenOutPrice, tokenInData.symbol, tokenOutData.symbol);

    // Calculate price impact
    const priceImpact = calculatePriceImpact(
      tokenInPrice,
      tokenOutPrice,
      tokenOutData.liquidity
    );

    // Get slippage
    const slippage = getSlippageSetting(slippageBps);

    // Build swap card data
    const swapData: SwapCardData = {
      tokenIn: {
        symbol: tokenInData.symbol,
        name: tokenInData.name,
        address: tokenInData.address,
        amount: formattedAmountIn,
        usdValue: formatUSD(usdValueIn),
        balance: undefined, // Would need wallet integration
        imageUrl: tokenInData.imageUrl,
      },
      tokenOut: {
        symbol: tokenOutData.symbol,
        name: tokenOutData.name,
        address: tokenOutData.address,
        amount: formattedAmountOut,
        usdValue: formatUSD(usdValueOut),
        imageUrl: tokenOutData.imageUrl,
      },
      rate,
      slippage,
      priceImpact,
      network: networkStr,
    };

    console.log(`[swapDataFetcher] Swap data built successfully:`, {
      tokenIn: swapData.tokenIn.symbol,
      tokenOut: swapData.tokenOut.symbol,
      amountIn: swapData.tokenIn.amount,
      amountOut: swapData.tokenOut.amount,
      rate: swapData.rate,
    });

    return swapData;
  } catch (error) {
    console.error('[swapDataFetcher] Error fetching swap data:', error);
    if (error instanceof Error) {
      console.error('[swapDataFetcher] Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }
    return null;
  }
}

/**
 * Create fallback swap data when API fails
 */
export function createFallbackSwapData(
  tokenIn: string,
  tokenOut: string,
  amount: string | number,
  network?: string
): SwapCardData {
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formattedAmount = formatNumber(amountNum || 1, 4);

  return {
    tokenIn: {
      symbol: tokenIn.toUpperCase(),
      name: tokenIn,
      amount: formattedAmount,
      usdValue: formatUSD(0),
    },
    tokenOut: {
      symbol: tokenOut.toUpperCase(),
      name: tokenOut,
      amount: formattedAmount,
      usdValue: formatUSD(0),
    },
    rate: 'Calculating...',
    slippage: 'Auto (0.5%)',
    priceImpact: '~0.01%',
    network: network || DEFAULT_NETWORK,
  };
}


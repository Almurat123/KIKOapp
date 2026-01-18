/**
 * 代币数据服务
 * 位置: kiko-web/src/services/tokenDataService.ts
 * 功能: 获取代币信息（头像、名字、decimal等）
 */

import { getTokenInfo } from './dexAggregatorService';

export interface TokenData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
}

const TOKEN_DATA_CACHE_TTL_MS = 5 * 60 * 1000;
const TOKEN_DATA_CONCURRENCY = 4;

type TokenDataCacheEntry = {
  data: TokenData;
  expiresAt: number;
};

const tokenDataCache = new Map<string, TokenDataCacheEntry>();
const tokenDataInflight = new Map<string, Promise<TokenData>>();

const getTokenCacheKey = (address: string, chainId: number) => `${chainId}:${address.toLowerCase()}`;

/**
 * 获取代币数据（包含价格信息和头像）
 * 优先级: DexScreener → GeckoTerminal → 基础信息
 */
export async function getTokenData(address: string, chainId: number): Promise<TokenData> {
  const cacheKey = getTokenCacheKey(address, chainId);
  const cached = tokenDataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const inflight = tokenDataInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
  try {
    // 1. 先尝试从 DexScreener 获取完整信息（包括头像）
    try {
      const dexData = await fetchTokenFromDexScreener(address, chainId);
      if (dexData && dexData.logoURI) {
        console.log('[TokenData] Got token data from DexScreener:', dexData.symbol);
        return dexData;
      }
    } catch (error) {
      console.warn('[TokenData] DexScreener fetch failed:', error);
    }

    // 2. 尝试从 GeckoTerminal 获取信息
    try {
      const geckoData = await fetchTokenFromGeckoTerminal(address, chainId);
      if (geckoData && geckoData.logoURI) {
        console.log('[TokenData] Got token data from GeckoTerminal:', geckoData.symbol);
        return geckoData;
      }
    } catch (error) {
      console.warn('[TokenData] GeckoTerminal fetch failed:', error);
    }

    // 3. 最后尝试从 dexAggregatorService 获取基础信息
    const baseInfo = await getTokenInfo(address, chainId);
    console.log('[TokenData] Using base token info:', baseInfo.symbol);

    return {
      address: baseInfo.address,
      symbol: baseInfo.symbol,
      name: baseInfo.name,
      decimals: baseInfo.decimals,
      logoURI: baseInfo.logoURI,
      chainId,
    };
  } catch (error) {
    console.error('[TokenData] Error getting token data:', error);
    throw error;
  }
  })();

  tokenDataInflight.set(cacheKey, request);
  try {
    const data = await request;
    tokenDataCache.set(cacheKey, { data, expiresAt: Date.now() + TOKEN_DATA_CACHE_TTL_MS });
    return data;
  } finally {
    tokenDataInflight.delete(cacheKey);
  }
}

/**
 * 在所有支持的链上查找代币
 */
export async function findTokenOnAnyChain(address: string): Promise<TokenData | null> {
  // Try DexScreener first as it's fastest for multi-chain check (it returns chainId in response)
  try {
    console.log('[TokenData] Searching for token globally:', address);
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(address)}`);
    if (response.ok) {
      const data = await response.json() as {
        pairs?: Array<{
          chainId: string;
          baseToken?: { address: string; name: string; symbol: string };
          priceUsd: string;
          info?: { imageUrl?: string };
        }>
      };

      console.log('[TokenData] DexScreener search result:', {
        pairsFound: data.pairs?.length || 0,
        firstPair: data.pairs?.[0] ? {
          chainId: data.pairs[0].chainId,
          baseToken: data.pairs[0].baseToken?.symbol,
          hasImage: !!data.pairs[0].info?.imageUrl
        } : null
      });

      if (data.pairs && data.pairs.length > 0) {
        // Find the pair that matches the token address exactly
        const match = data.pairs.find(p => p.baseToken?.address.toLowerCase() === address.toLowerCase());

        if (match) {
          // Map DexScreener chain slug to chainId
          const chainMap: Record<string, number> = {
            'ethereum': 1,
            'base': 8453,
            'bsc': 56,
            'polygon': 137,
            'arbitrum': 42161,
            'optimism': 10,
            'avalanche': 43114,
            'fantom': 250,
            'solana': 900
          };

          const detectedChainId = chainMap[match.chainId];
          if (detectedChainId) {
            const tokenData = {
              address: match.baseToken!.address,
              symbol: match.baseToken!.symbol,
              name: match.baseToken!.name,
              decimals: 18,
              logoURI: match.info?.imageUrl, // Image is in info.imageUrl
              chainId: detectedChainId,
              price: parseFloat(match.priceUsd)
            };
            console.log(`[TokenData] ✓ Found token on chain: ${match.chainId} (${detectedChainId})`, tokenData);
            return tokenData;
          }
        } else {
          console.warn('[TokenData] Token address not found in pairs baseToken');
        }
      } else {
        console.warn('[TokenData] No pairs found in DexScreener response');
      }
    } else {
      console.warn('[TokenData] DexScreener API returned non-OK status:', response.status);
    }
  } catch (e) {
    console.error('[TokenData] Global search failed:', e);
  }

  // Fallback: Search in COMMON_TOKENS across all chains
  console.log('[TokenData] Falling back to COMMON_TOKENS search');
  for (const [chainIdStr, tokens] of Object.entries(COMMON_TOKENS)) {
    const chainId = parseInt(chainIdStr);
    for (const token of Object.values(tokens)) {
      if (token.address.toLowerCase() === address.toLowerCase()) {
        console.log(`[TokenData] ✓ Found token in COMMON_TOKENS: ${token.symbol} on chain ${chainId}`);
        return token;
      }
    }
  }

  console.warn('[TokenData] Token not found in DexScreener or COMMON_TOKENS');
  return null;
}

/**
 * 从 DexScreener 获取完整代币信息（包括头像、价格等）
 */
async function fetchTokenFromDexScreener(
  tokenAddress: string,
  chainId: number
): Promise<TokenData | null> {
  try {
    const chainMap: Record<number, string> = {
      1: 'ethereum',
      8453: 'base',
      42161: 'arbitrum',
      56: 'bsc',
      137: 'polygon',
      250: 'fantom',
      10: 'optimism',
      43114: 'avalanche',
    };

    const chain = chainMap[chainId];
    if (!chain) {
      console.warn(`[DexScreener] Unsupported chainId: ${chainId}`);
      return null;
    }

    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(tokenAddress)}`);
    if (!response.ok) {
      console.warn(`[DexScreener] API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      pairs?: Array<{
        chainId: string;
        baseToken?: {
          address: string;
          name: string;
          symbol: string;
          imageUrl?: string;
        };
        priceUsd: string;
        priceChange?: { h24: string };
        marketCap?: number;
        volume?: { h24: number };
        liquidity?: { usd: number };
      }>
    };

    if (!data.pairs || data.pairs.length === 0) {
      console.warn(`[DexScreener] No pairs found for token: ${tokenAddress}`);
      return null;
    }

    // 找到匹配的链和代币
    const pair = data.pairs.find((p) =>
      p.chainId === chain &&
      p.baseToken?.address.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (!pair || !pair.baseToken) {
      console.warn(`[DexScreener] No matching pair found for chain: ${chain}`);
      return null;
    }

    return {
      address: pair.baseToken.address,
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      decimals: 18, // DexScreener doesn't provide decimals, use default
      logoURI: pair.baseToken.imageUrl,
      chainId,
      price: parseFloat(pair.priceUsd),
      priceChange24h: pair.priceChange?.h24 ? parseFloat(pair.priceChange.h24) : undefined,
      marketCap: pair.marketCap,
      volume24h: pair.volume?.h24,
    };
  } catch (error) {
    console.error('[DexScreener] Error fetching token:', error);
    return null;
  }
}

/**
 * 从 DexScreener 获取价格信息（保留用于向后兼容）
 */
async function fetchPriceFromDexScreener(
  tokenAddress: string,
  chainId: number
): Promise<{ logoURI?: string; price?: number; priceChange24h?: number; marketCap?: number; volume24h?: number }> {
  const tokenData = await fetchTokenFromDexScreener(tokenAddress, chainId);
  if (!tokenData) return {};

  return {
    logoURI: tokenData.logoURI,
    price: tokenData.price,
    priceChange24h: tokenData.priceChange24h,
    marketCap: tokenData.marketCap,
    volume24h: tokenData.volume24h,
  };
}

/**
 * 从 GeckoTerminal 获取完整代币信息
 */
async function fetchTokenFromGeckoTerminal(
  tokenAddress: string,
  chainId: number
): Promise<TokenData | null> {
  try {
    const networkMap: Record<number, string> = {
      1: 'eth',
      8453: 'base',
      42161: 'arbitrum',
      56: 'bsc',
      137: 'polygon',
      250: 'fantom',
      10: 'optimism',
      43114: 'avax',
      900: 'solana',
    };

    const network = networkMap[chainId];
    if (!network) {
      console.warn(`[GeckoTerminal] Unsupported chainId: ${chainId}`);
      return null;
    }

    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${tokenAddress}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[GeckoTerminal] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.data || !data.data.attributes) {
      console.warn(`[GeckoTerminal] No data found for token: ${tokenAddress}`);
      return null;
    }

    const attrs = data.data.attributes;

    return {
      address: tokenAddress,
      symbol: attrs.symbol || 'UNKNOWN',
      name: attrs.name || 'Unknown Token',
      decimals: attrs.decimals || 18,
      logoURI: attrs.image_url,
      chainId,
      price: attrs.price_usd ? parseFloat(attrs.price_usd) : undefined,
      priceChange24h: attrs.price_change_percentage?.h24,
      marketCap: attrs.market_cap_usd,
      volume24h: attrs.volume_usd?.h24,
    };
  } catch (error) {
    console.error('[GeckoTerminal] Error fetching token:', error);
    return null;
  }
}

/**
 * 批量获取代币数据
 */
export async function getTokensData(addresses: string[], chainId: number): Promise<TokenData[]> {
  try {
    const uniqueAddresses = Array.from(
      new Map(addresses.map(addr => [addr.toLowerCase(), addr])).values()
    );
    const concurrency = Math.max(1, Math.min(TOKEN_DATA_CONCURRENCY, uniqueAddresses.length));
    const results: TokenData[] = [];
    let index = 0;

    const workers = Array.from({ length: concurrency }, async () => {
      while (index < uniqueAddresses.length) {
        const currentIndex = index++;
        const addr = uniqueAddresses[currentIndex];
        try {
          const data = await getTokenData(addr, chainId);
          results.push(data);
        } catch (error) {
          console.warn('[TokenData] Skipping token data after error:', { address: addr, chainId, error });
        }
      }
    });

    await Promise.all(workers);
    return results;
  } catch (error) {
    console.error('Error getting tokens data:', error);
    throw error;
  }
}

/**
 * 获取常见代币（USDC, USDT, WETH 等）
 */
export const COMMON_TOKENS: Record<number, Record<string, TokenData>> = {
  // Ethereum
  1: {
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 1,
      logoURI: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    },
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 1,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    },
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      chainId: 1,
      logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
    },
    DAI: {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      chainId: 1,
      logoURI: 'https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png',
    },
    WETH: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 1,
      logoURI: 'https://assets.coingecko.com/coins/images/2518/large/weth.png',
    },
    WBTC: {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      chainId: 1,
      logoURI: 'https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png',
    },
    UNI: {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      chainId: 1,
      logoURI: 'https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png',
    },
  },
  // Base
  8453: {
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 8453,
      logoURI: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    },
    USDC: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 8453,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 8453,
      logoURI: 'https://assets.coingecko.com/coins/images/2518/large/weth.png',
    },
  },
  // Arbitrum
  42161: {
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 42161,
      logoURI: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    },
    USDC: {
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 42161,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    },
    USDT: {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      chainId: 42161,
      logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
    },
    WETH: {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 42161,
      logoURI: 'https://assets.coingecko.com/coins/images/2518/large/weth.png',
    },
  },
  // BSC
  56: {
    BNB: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
      chainId: 56,
      logoURI: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
    },
    USDC: {
      address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18,
      chainId: 56,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    },
    USDT: {
      address: '0x55d398326f99059fF775485246999027B3197955',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
      chainId: 56,
      logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
    },
    WBNB: {
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      decimals: 18,
      chainId: 56,
      logoURI: 'https://assets.coingecko.com/coins/images/12591/large/binance-coin-logo.png',
    },
  },
  // Polygon
  137: {
    MATIC: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18,
      chainId: 137,
      logoURI: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
    },
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 137,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    },
    USDT: {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      chainId: 137,
      logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
    },
    WMATIC: {
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      symbol: 'WMATIC',
      name: 'Wrapped MATIC',
      decimals: 18,
      chainId: 137,
      logoURI: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
    },
  },
  // Optimism
  10: {
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chainId: 10,
      logoURI: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    },
    USDC: {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Native USDC (Circle-issued)
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 10,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    },
    USDT: {
      address: '0x94b008aA00579c1307B0EF2b499aD98a8ce58e58',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      chainId: 10,
      logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      chainId: 10,
      logoURI: 'https://assets.coingecko.com/coins/images/2518/large/weth.png',
    },
  },
  // Solana
  900: {
    SOL: {
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      chainId: 900,
      logoURI: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    },
    USDC: {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 900,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    },
    USDT: {
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      chainId: 900,
      logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
    },
    BONK: {
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'BONK',
      name: 'Bonk',
      decimals: 5,
      chainId: 900,
      logoURI: 'https://assets.coingecko.com/coins/images/28600/large/bonk.jpg',
    },
    JUP: {
      address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      symbol: 'JUP',
      name: 'Jupiter',
      decimals: 6,
      chainId: 900,
      logoURI: 'https://assets.coingecko.com/coins/images/10351/large/logo512.png',
    },
    RAY: {
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      symbol: 'RAY',
      name: 'Raydium',
      decimals: 6,
      chainId: 900,
      logoURI: 'https://assets.coingecko.com/coins/images/13928/large/raydium.png',
    },
    JTO: {
      address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
      symbol: 'JTO',
      name: 'Jito',
      decimals: 9,
      chainId: 900,
      logoURI: 'https://assets.coingecko.com/coins/images/32850/large/jito.png',
    },
    WIF: {
      address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      symbol: 'WIF',
      name: 'dogwifhat',
      decimals: 6,
      chainId: 900,
      logoURI: 'https://assets.coingecko.com/coins/images/33566/large/dogwifhat.jpg',
    },
    PYTH: {
      address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
      symbol: 'PYTH',
      name: 'Pyth Network',
      decimals: 6,
      chainId: 900,
      logoURI: 'https://assets.coingecko.com/coins/images/31924/large/pyth.png',
    },
  },
};

/**
 * 获取链上的常见代币
 */
export function getCommonTokens(chainId: number): TokenData[] {
  return Object.values(COMMON_TOKENS[chainId] || {});
}

export default {
  getTokenData,
  getTokensData,
  getCommonTokens,
  fetchPriceFromDexScreener,
  COMMON_TOKENS,
};

import { apiCache } from '../utils/apiCache';
// const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';
// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  logoURI?: string;
  chainId: number;
}

export interface SwapQuote {
  amountOut: string;
  priceImpact: number;
  dex: string;
  dexName?: string;
  path: string[];
  router: string;
  version?: string;
  gasEstimate?: number;
  fee?: number;
  data?: string;
  deadline?: number;
  minAmountOut?: string;
  amountOutBase?: string;
  allowanceTarget?: string;
  to?: string;
  value?: string;
}

export interface DEXAggregatorService {
  getTokenInfo: (address: string, chainId: number) => Promise<TokenInfo>;
  getSwapQuote: (tokenIn: string, tokenOut: string, amount: string, chainId: number) => Promise<SwapQuote>;
  getBestQuote: (tokenIn: string, tokenOut: string, amount: string, chainId: number) => Promise<SwapQuote>;
}

/**
 * 获取代币信息 - Delegates to centralized tokenDataService
 */
export async function getTokenInfo(address: string, chainId: number): Promise<TokenInfo> {
  // Dynamically import to avoid circular dependency issues if any remain (though clean now)
  const { getTokenData } = await import('./tokenDataService');

  try {
    const data = await getTokenData(address, chainId);
    return {
      symbol: data.symbol,
      name: data.name,
      decimals: data.decimals,
      address: data.address,
      chainId: data.chainId,
      logoURI: data.logoURI,
    };
  } catch (error) {
    console.error('Error fetching token info via tokenDataService:', error);
    return {
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 18,
      address,
      chainId,
    };
  }
}

// [Removed Legacy Fetch Functions]
// fetchFromDexScreener and fetchFromRPC have been removed.
// All token data is now fetched via tokenDataService -> tokenApi (Backend).

/**
 * RPC URL helper (Deprecated in frontend, use backend proxy)
 */
// function getRPCUrl(_chainId: number): string {
// return '';
// }

/**
 * 获取 0xAPI 的报价 - 使用后端 API 获取完整交易数据
 */
export async function getZeroExQuote(
  tokenIn: string,
  tokenOut: string,
  amount: string,
  chainId: number,
  userAddress?: string,
  slippageBps?: number,
): Promise<SwapQuote | null> {
  // 报价不应该缓存太久，因为价格会变化
  // 但我们可以使用速率限制来避免频繁请求
  const cacheKey = `quote_${chainId}_${tokenIn}_${tokenOut}_${amount.slice(0, 10)}`;

  // 动态导入 rateLimiter 避免循环依赖
  const { quoteRateLimiter } = await import('@/utils/apiRateLimiter');

  return quoteRateLimiter.request<SwapQuote>(
    cacheKey,
    async () => {
      // amount is human-readable from useSwap hook (e.g., "1.5")
      // Backend expects this format
      const amountIn = amount;

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const requestBody = {
        tokenIn,
        tokenOut,
        amountIn,
        chainId,
        slippageBps: slippageBps || 50,
        userAddress,
      };

      console.log('[getZeroExQuote] Requesting quote with:', requestBody);

      const response = await fetch(`${API_BASE_URL}/api/swap/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[getZeroExQuote] API error:', response.status, response.statusText, errorText);
        throw new Error(`Quote API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        console.error('[getZeroExQuote] API returned error:', data);
        throw new Error(data.error || data.message || 'Failed to get quote');
      }

      const quote = data.data;

      console.log('[getZeroExQuote] Received quote:', {
        dex: quote.dexName || quote.dex,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        priceImpact: quote.priceImpact,
        hasTo: !!quote.to,
        hasData: !!quote.data,
        hasValue: !!quote.value,
        to: quote.to,
        dataPreview: quote.data ? quote.data.slice(0, 66) + '...' : 'null',
      });

      // Backend returns amountOut as human-readable format (e.g., "1.5")
      // We'll use it directly for display
      const amountOut = quote.amountOut || '0';

      return {
        amountOut: amountOut,
        priceImpact: quote.priceImpact || 0,
        dex: quote.dex || '0x',
        dexName: quote.dexName || '0x Aggregator',
        path: quote.path || [tokenIn, tokenOut],
        router: quote.router || quote.to || '',
        data: quote.data || '',
        to: quote.to || quote.router || '',
        value: quote.value || '0',
        allowanceTarget: quote.allowanceTarget,
        gasEstimate: quote.gasEstimate || 150000,
        fee: quote.fee || 0,
        deadline: quote.deadline || Math.floor(Date.now() / 1000) + 600,
        minAmountOut: quote.minAmountOut || amountOut,
        // Store base units for transaction execution
        amountOutBase: quote.amountOutBase,
      };
    },
    {
      maxRequests: 30, // 每分钟最多 30 次报价请求（增加）
      windowMs: 60000,
      cacheTTL: 10000, // 报价缓存 10 秒（延长）
      useCache: true,
    }
  );
}

/**
 * 获取 Uniswap V3 报价
 */
export async function getUniswapV3Quote(
  _tokenIn: string,
  _tokenOut: string,
  _amount: string,
  chainId: number
): Promise<SwapQuote | null> {
  try {
    const routerMap: Record<number, string> = {
      1: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
      8453: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      42161: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    };

    const router = routerMap[chainId];
    if (!router) return null;

    // 通过 Uniswap Quoter 获取报价
    // 这需要 RPC 调用或后端实现
    return {
      amountOut: '0', // 需要真实计算
      priceImpact: 0,
      dex: 'uniswap-v3',
      dexName: 'Uniswap V3',
      path: [_tokenIn, _tokenOut],
      router,
      version: 'V3',
    };
  } catch (error) {
    console.error('Error fetching from Uniswap V3:', error);
    return null;
  }
}

/**
 * 获取 Curve 报价
 */
export async function getCurveQuote(
  _tokenIn: string,
  _tokenOut: string,
  _amount: string,
  chainId: number
): Promise<SwapQuote | null> {
  try {
    if (![1, 137].includes(chainId)) return null; // Curve 主要在 Ethereum 和 Polygon

    // Curve 的报价需要通过其 API 或智能合约调用
    // 这是一个占位符实现
    return null;
  } catch (error) {
    console.error('Error fetching from Curve:', error);
    return null;
  }
}

/**
 * 获取最优报价 - 聚合多个 DEX
 */
export async function getBestSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amount: string,
  chainId: number,
  userAddress?: string,
  slippageBps?: number
): Promise<{ best: SwapQuote; quotes: SwapQuote[] }> {
  // 15-second cache to reduce excessive API calls
  const cacheKey = `quote_${chainId}_${tokenIn}_${tokenOut}_${amount}_${slippageBps || 50}`;
  const cached = apiCache.get<{ best: SwapQuote; quotes: SwapQuote[] }>(cacheKey);
  if (cached) {
    console.log('[dexAggregatorService] Returning cached quote for', cacheKey.substring(0, 40));
    return cached;
  }

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const body = {
    tokenIn,
    tokenOut,
    amountIn: amount,
    chainId,
    slippageBps: slippageBps || 50,
    userAddress,
  };

  const res = await fetch(`${API_BASE_URL}/api/swap/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Quote API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Quote API returned failure');
  }

  const quotes: SwapQuote[] = json.quotes || (json.data ? [json.data] : []);
  if (!quotes.length) {
    throw new Error('No quotes returned');
  }

  const best = quotes.reduce((prev, curr) => {
    const prevVal = getComparableAmount(prev);
    const currVal = getComparableAmount(curr);
    return currVal > prevVal ? curr : prev;
  }, quotes[0]);

  const result = { best, quotes };

  // Cache for 15 seconds
  apiCache.set(cacheKey, result, 15000);

  return result;
}

function getComparableAmount(quote: SwapQuote): bigint {
  const baseAmount = quote.amountOutBase;
  if (baseAmount) {
    try {
      return BigInt(baseAmount);
    } catch (error) {
      console.warn('Failed to parse amountOutBase as BigInt:', baseAmount, error);
    }
  }

  const humanAmount = quote.amountOut || '0';
  try {
    if (/[eE\.]/.test(humanAmount)) {
      const numeric = Number(humanAmount);
      if (Number.isFinite(numeric)) {
        return BigInt(Math.floor(numeric * 1e18));
      }
      return 0n;
    }
    return BigInt(humanAmount);
  } catch (error) {
    console.warn('Failed to parse amountOut as BigInt:', humanAmount, error);
    const numericFallback = Number(humanAmount);
    if (Number.isFinite(numericFallback)) {
      return BigInt(Math.floor(numericFallback * 1e18));
    }
    return 0n;
  }
}

export default {
  getTokenInfo,
  getZeroExQuote,
  getUniswapV3Quote,
  getCurveQuote,
  getBestSwapQuote,
};

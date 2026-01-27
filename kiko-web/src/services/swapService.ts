/**
 * Swap Service - 处理代币交换的业务逻辑
 */

import type { SwapParams, SwapQuote, TradeExecutionResult, PriceData } from '@/types/swap';
import { priceRateLimiter, balanceRateLimiter } from '@/utils/apiRateLimiter';
import { getAuthToken } from '../utils/authToken';
import { parseUnits } from 'viem';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Validate address format for both EVM and Solana chains
 * @param address - Address to validate
 * @param chainId - Chain ID to determine validation type
 * @returns true if address format is valid
 */
function isValidAddress(address: string, chainId: number): boolean {
    // Solana chain (chainId 900)
    if (chainId === 900) {
        // Solana addresses are base58 encoded, typically 32-44 characters
        // Valid base58 characters: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }

    // EVM chains (Ethereum, BSC, Base, etc.)
    // Must be 0x followed by 40 hex characters
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 获取最优 Swap 报价
 * @param params - 交换参数
 * @returns 最优报价或 null
 */
export async function getSwapQuote(params: SwapParams): Promise<SwapQuote | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/swap/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                amountIn: params.amountIn,
                chainId: params.chainId,
                slippageBps: params.slippageBps || 50,
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success || !data.data) {
            throw new Error(data.message || 'Failed to get quote');
        }

        return data.data as SwapQuote;
    } catch (error) {
        console.error('[SwapService] Error fetching quote:', error);
        return null;
    }
}

/**
 * Execute Swap instantly using backend server-side signing (no user popup)
 * This is the preferred method for embedded wallets with instant trading enabled
 * @param params - Swap parameters
 * @returns Trade execution result with txHash
 */
export async function executeSwapInstant(params: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippageBps?: number;
    maxPriceImpact?: number;
}): Promise<TradeExecutionResult> {
    try {
        const authToken = await getAuthToken();
        if (!authToken) {
            return {
                success: false,
                error: 'Not authenticated. Please login to use instant trading.',
            };
        }

        const response = await fetch(`${API_BASE_URL}/api/swap/execute-instant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                amountIn: params.amountIn,
                chainId: params.chainId,
                slippageBps: params.slippageBps || 50,
                maxPriceImpact: params.maxPriceImpact,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            const errorMessage = data.message || data.error || `Request failed: ${response.statusText}`;
            console.error('[SwapService] Instant swap failed:', errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        }

        console.log('[SwapService] Instant swap successful:', data.data?.txHash);
        return {
            success: true,
            txHash: data.data?.txHash,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('[SwapService] Error executing instant swap:', error);
        return {
            success: false,
            error: message,
        };
    }
}

/**
 * 获取代币价格数据
 * @param tokenInAddress - 输入代币地址
 * @param tokenOutAddress - 输出代币地址
 * @param chainId - 链 ID
 * @returns 价格数据
 */
export async function getPriceData(
    tokenInAddress: string,
    tokenOutAddress: string,
    chainId: number
): Promise<PriceData | null> {
    // Normalize addresses to lowercase to avoid duplicates
    const normalizedTokenIn = tokenInAddress.toLowerCase();
    const normalizedTokenOut = tokenOutAddress.toLowerCase();

    // Early return if tokens are the same (prevents invalid API calls)
    if (normalizedTokenIn === normalizedTokenOut) {
        console.warn('[SwapService] getPriceData: tokenIn and tokenOut are the same, skipping request');
        return null;
    }

    // 使用速率限制器和缓存（使用规范化后的地址）
    const cacheKey = `price_${chainId}_${normalizedTokenIn}_${normalizedTokenOut}`;

    return priceRateLimiter.request<PriceData | null>(
        cacheKey,
        async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/swap/prices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tokenInAddress: normalizedTokenIn,
                        tokenOutAddress: normalizedTokenOut,
                        chainId,
                    }),
                    // Add timeout to prevent hanging (increased to 30s for slow networks)
                    signal: (() => {
                        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
                            return AbortSignal.timeout(30000);
                        }
                        // Fallback for browsers that don't support AbortSignal.timeout
                        const controller = new AbortController();
                        setTimeout(() => controller.abort(), 30000);
                        return controller.signal;
                    })(),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[SwapService] Price API error:', response.status, errorText);
                    throw new Error(`API error: ${response.statusText}`);
                }

                const data = await response.json();

                // Check if response is successful
                if (!data.success) {
                    console.error('[SwapService] Price API returned error:', data.error || data.message);
                    throw new Error(data.error || 'Failed to get prices');
                }

                // Validate data structure
                if (!data.data || typeof data.data !== 'object') {
                    console.error('[SwapService] Invalid price data structure:', data);
                    throw new Error('Invalid price data structure');
                }

                const priceData = data.data as PriceData;

                // Validate and sanitize price data to ensure all values are numbers
                const sanitizedPriceData: PriceData = {
                    tokenInPrice: typeof priceData.tokenInPrice === 'number' ? priceData.tokenInPrice : parseFloat(String(priceData.tokenInPrice || 0)) || 0,
                    tokenOutPrice: typeof priceData.tokenOutPrice === 'number' ? priceData.tokenOutPrice : parseFloat(String(priceData.tokenOutPrice || 0)) || 0,
                    nativeTokenPrice: typeof priceData.nativeTokenPrice === 'number' ? priceData.nativeTokenPrice : parseFloat(String(priceData.nativeTokenPrice || 0)) || 0,
                };

                // Log warning if any prices are 0 or had to be converted
                if (
                    sanitizedPriceData.tokenInPrice === 0 ||
                    sanitizedPriceData.tokenOutPrice === 0 ||
                    typeof priceData.tokenInPrice !== 'number' ||
                    typeof priceData.tokenOutPrice !== 'number' ||
                    typeof priceData.nativeTokenPrice !== 'number'
                ) {
                    console.warn('[SwapService] Price data issues:', {
                        original: priceData,
                        sanitized: sanitizedPriceData,
                    });
                }

                return sanitizedPriceData;
            } catch (error) {
                // Handle network errors and timeouts gracefully
                if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                    console.warn('[SwapService] Backend server not available, returning null');
                    return null;
                }
                if (error instanceof Error && error.name === 'TimeoutError') {
                    console.warn('[SwapService] Price API timeout, returning null');
                    return null;
                }
                if (error instanceof DOMException && error.name === 'AbortError') {
                    console.warn('[SwapService] Price API aborted (timeout), returning null');
                    return null;
                }
                // Return null for any error instead of throwing
                console.warn('[SwapService] Price API error:', error);
                return null;
            }
        },
        {
            maxRequests: 20, // 每分钟最多 20 次价格请求（增加）
            windowMs: 60000,
            cacheTTL: 60000, // 缓存 60 秒（延长）
            useCache: true,
        }
    );
}

/**
 * 检查用户授权状态
 * @param userAddress - 用户地址
 * @param tokenAddress - 代币地址
 * @param requiredAmount - 需要的授权金额
 * @param chainId - 链 ID
 * @returns 是否已授权
 */
export async function checkApproval(
    userAddress: string,
    tokenAddress: string,
    requiredAmount: string,
    chainId: number,
    spender?: string
): Promise<boolean> {
    try {
        if (!spender) {
            return false;
        }
        const response = await fetch(`${API_BASE_URL}/api/swap/approval-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userAddress,
                tokenAddress,
                requiredAmount,
                chainId,
                spender,
            }),
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.data?.isApproved || false;
    } catch (error) {
        console.error('[SwapService] Error checking approval:', error);
        return false;
    }
}

/**
 * 获取用户余额
 * @param userAddress - 用户地址
 * @param tokenAddress - 代币地址
 * @param chainId - 链 ID
 * @returns 余额
 */
export async function getUserBalance(
    userAddress: string,
    tokenAddress: string,
    chainId: number,
    fallbackDecimals?: number
): Promise<string | null> {
    // 使用速率限制器和缓存
    const cacheKey = `balance_${chainId}_${userAddress}_${tokenAddress}`;

    return balanceRateLimiter.request<string | null>(
        cacheKey,
        async () => {
            try {
                // Ensure we have an auth token; if missing, skip quietly to avoid 401
                const authToken = await getAuthToken();
                if (!authToken) return null;

                // Map chainId to chain name
                const chainIdToName: Record<number, string> = {
                    1: 'eth',
                    8453: 'base',
                    56: 'bsc',
                    42161: 'arbitrum',
                    10: 'optimism',
                    137: 'polygon',
                    900: 'solana', // Solana
                };
                const chain = chainIdToName[chainId] || 'eth';

                // Use the correct API endpoint: GET /api/wallets/:address/balance
                // Validate address format to prevent path injection
                if (!isValidAddress(userAddress, chainId)) {
                    throw new Error('Invalid wallet address format');
                }
                const sanitizedAddress = encodeURIComponent(userAddress);
                const response = await fetch(`${API_BASE_URL}/api/wallets/${sanitizedAddress}/balance?chain=${encodeURIComponent(chain)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    },
                    // Add timeout to prevent hanging (increased to 30s for slow networks)
                    signal: (() => {
                        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
                            return AbortSignal.timeout(30000);
                        }
                        // Fallback for browsers that don't support AbortSignal.timeout
                        const controller = new AbortController();
                        setTimeout(() => controller.abort(), 30000);
                        return controller.signal;
                    })(),
                });

                if (!response.ok) {
                    console.error('[SwapService] Balance API error:', response.status, response.statusText);
                    throw new Error(`Balance API error: ${response.statusText}`);
                }

                const data = await response.json();

                // If it's a native token, return ethBalance
                // Note: Backend API returns native token balance in 'ethBalance' field regardless of chain
                // Include wrapped native token addresses since swap UI uses these for native tokens
                const WRAPPED_NATIVE_TOKENS: Record<string, boolean> = {
                    '0x0000000000000000000000000000000000000000': true, // Zero address (native)
                    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': true, // Common native sentinel
                    '0x4200000000000000000000000000000000000006': true, // WETH on Base/Optimism
                    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': true, // WETH on Ethereum
                    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': true, // WBNB on BSC
                    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': true, // WETH on Arbitrum
                    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': true, // WMATIC on Polygon
                };
                const isNativeToken = !tokenAddress || WRAPPED_NATIVE_TOKENS[tokenAddress.toLowerCase()];
                if (isNativeToken && data.data?.ethBalance) {
                    return data.data.ethBalance; // Returns hex string like "0x..."
                }

                // For ERC-20 tokens, we need to check token balances
                // The API returns WalletBalance which has tokens array
                if (data.data?.tokens && Array.isArray(data.data.tokens)) {
                    const tokenBalance = data.data.tokens.find(
                        (t: any) => t.contractAddress?.toLowerCase() === tokenAddress.toLowerCase()
                    );

                    if (tokenBalance?.tokenBalance) {
                        // The API returns tokenBalance as a FORMATTED string (e.g., "1234.56")
                        // Convert to raw units (wei-like) for consistency with native balance handling

                        // Critical Precision Fix: defaults to API decimals if valid, else fallback decimals, else 18
                        const decimals = (typeof tokenBalance.decimals === 'number' && tokenBalance.decimals >= 0)
                            ? tokenBalance.decimals
                            : (fallbackDecimals ?? 18);

                        try {
                            // Use viem's parseUnits for precise conversion (handles scientific notation too if needed)
                            // This avoids floating point precision issues with parseFloat
                            const rawUnits = parseUnits(tokenBalance.tokenBalance, decimals);
                            if (rawUnits > 0n) {
                                return '0x' + rawUnits.toString(16);
                            }
                        } catch (e) {
                            console.warn('[SwapService] Failed to parse token balance:', tokenBalance.tokenBalance, e);
                        }
                    }
                } else {
                    // It's possible the token list is empty if user has no tokens
                    // console.warn('[SwapService] No tokens array in response data for ' + userAddress);
                }

                return '0';
            } catch (error) {
                // Handle network errors and timeouts gracefully
                if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                    console.warn('[SwapService] Backend server not available for balance, returning null');
                    return null;
                }
                if (error instanceof Error && error.name === 'TimeoutError') {
                    console.warn('[SwapService] Balance API timeout, returning null');
                    return null;
                }
                if (error instanceof DOMException && error.name === 'AbortError') {
                    console.warn('[SwapService] Balance API aborted (timeout), returning null');
                    return null;
                }
                // Return null for any error instead of throwing
                console.warn('[SwapService] Balance API error:', error);
                return null;
            }
        },
        {
            maxRequests: 30, // 每分钟最多 30 次余额请求（增加）
            windowMs: 60000,
            cacheTTL: 30000, // 缓存 30 秒（延长）
            useCache: true,
        }
    );
}

/**
 * Get full wallet portfolio including all tokens
 * @param userAddress - User wallet address
 * @param chainId - Chain ID
 * @returns Array of token balances with metadata
 */
export async function getWalletPortfolio(
    userAddress: string,
    chainId: number
): Promise<Array<{
    contractAddress: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: string; // Raw balance
    formatted: string; // Formatted balance string from API
    price?: number;
    value?: number;
}> | null> {
    const cacheKey = `portfolio_${chainId}_${userAddress}`;

    return balanceRateLimiter.request(
        cacheKey,
        async () => {
            try {
                const authToken = await getAuthToken();
                if (!authToken) return null;

                const chainIdToName: Record<number, string> = {
                    1: 'eth',
                    8453: 'base',
                    56: 'bsc',
                    42161: 'arbitrum',
                    10: 'optimism',
                    137: 'polygon',
                    900: 'solana', // Solana
                };
                const chain = chainIdToName[chainId] || 'eth';

                if (!isValidAddress(userAddress, chainId)) {
                    throw new Error('Invalid wallet address format');
                }
                const sanitizedAddress = encodeURIComponent(userAddress);

                const response = await fetch(`${API_BASE_URL}/api/wallets/${sanitizedAddress}/balance?chain=${encodeURIComponent(chain)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    },
                    signal: AbortSignal.timeout(30000),
                });

                if (!response.ok) {
                    console.error('[SwapService] Portfolio API error:', response.status);
                    return null;
                }

                const data = await response.json();

                if (data.data?.tokens && Array.isArray(data.data.tokens)) {
                    return data.data.tokens.map((t: any) => ({
                        contractAddress: t.contractAddress,
                        symbol: t.symbol,
                        name: t.name,
                        decimals: t.decimals,
                        balance: '0', // We might compute raw if needed, but formatted is prioritized
                        formatted: t.tokenBalance, // API returns formatted string e.g. "123.45"
                        price: t.price,
                        value: t.value
                    }));
                }

                return [];
            } catch (error) {
                console.error('[SwapService] Error fetching portfolio:', error);
                return null;
            }
        },
        {
            maxRequests: 10, // Lower rate limit for full portfolio
            windowMs: 60000,
            cacheTTL: 30000, // 30s cache
            useCache: true
        }
    );
}

/**
 * 计算最小输出金额（根据滑点）
 * @param amountOut - 预期输出金额
 * @param slippageBps - 滑点基点 (50 = 0.5%)
 * @returns 最小输出金额
 */
export function calculateMinAmountOut(amountOut: string, slippageBps: number): string {
    try {
        const amount = BigInt(amountOut);
        const slippageMultiplier = BigInt(10000 - slippageBps);
        return (amount * slippageMultiplier / BigInt(10000)).toString();
    } catch (error) {
        console.error('[SwapService] Error calculating min amount:', error);
        return amountOut;
    }
}

/**
 * 格式化大数字为可读格式
 * @param value - 数值字符串
 * @param decimals - 小数位数
 * @param displayDecimals - 显示的小数位数
 * @returns 格式化后的字符串
 */
export function formatAmount(
    value: string,
    decimals: number = 18,
    displayDecimals: number = 4
): string {
    try {
        const num = Number(value) / Math.pow(10, decimals);
        return num.toLocaleString('en-US', {
            maximumFractionDigits: displayDecimals,
            minimumFractionDigits: 0,
        });
    } catch {
        return '0';
    }
}

/**
 * 计算价格影响百分比
 * @param inputValue - 输入金额
 * @param outputValue - 输出金额
 * @param priceData - 价格数据
 * @returns 价格影响百分比
 */
export function calculatePriceImpact(
    inputValue: string,
    outputValue: string,
    priceData: PriceData
): number {
    try {
        const inputNum = Number(inputValue);
        const outputNum = Number(outputValue);

        // 验证输入
        if (!inputNum || !outputNum || inputNum <= 0 || outputNum <= 0) {
            return 0;
        }

        // 验证价格数据
        const tokenInPrice = typeof priceData.tokenInPrice === 'number' ? priceData.tokenInPrice : 0;
        const tokenOutPrice = typeof priceData.tokenOutPrice === 'number' ? priceData.tokenOutPrice : 0;

        if (!tokenInPrice || !tokenOutPrice || tokenInPrice <= 0 || tokenOutPrice <= 0) {
            return 0;
        }

        // 理论输出 = 输入金额 * 输入代币价格 / 输出代币价格
        const theoreticalOutput = inputNum * tokenInPrice / tokenOutPrice;

        // 验证理论输出
        if (!theoreticalOutput || theoreticalOutput <= 0 || !Number.isFinite(theoreticalOutput)) {
            return 0;
        }

        // 价格影响 = (理论输出 - 实际输出) / 理论输出 * 100
        const impact = ((theoreticalOutput - outputNum) / theoreticalOutput) * 100;

        // 验证结果并限制范围
        if (!Number.isFinite(impact)) {
            return 0;
        }

        // 价格影响应该在 0-100% 之间，超过说明计算有问题
        return Math.max(0, Math.min(100, impact));
    } catch (error) {
        console.error('[SwapService] Error calculating price impact:', error);
        return 0;
    }
}

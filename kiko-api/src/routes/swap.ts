/**
 * Swap API 路由 - Fastify 版本
 * 使用 0x API 获取价格和报价
 * 端点：/api/swap/quote, /api/swap/execute, /api/swap/status, /api/swap/history, /api/swap/prices
 */

import { FastifyInstance } from 'fastify';
import {
    getZeroExPrice,
    getZeroExQuote,
    getTokenPriceUSD,
    getZeroExTokenMetadata,
    toWei,
    type ZeroExQuote,
    getNativeTokenAddress,
    getDefaultTakerAddress,
    isNativeToken as isNativeTokenZeroEx,
} from '../services/zeroEx.js';
import { resolveTokenAddress, isNativeToken, normalizeTokenAddress, getKnownTokenDecimals } from '../services/tokens.js';
import {
    getSolanaQuote,
    getSolanaPrice,
    normalizeSolanaTokenAddress,
    type SolanaQuote,
    type SolanaPrice,
} from '../services/solanaSwap.js';
import { getBestQuote } from '../services/quoteService.js';
import { getSolanaTokenMetadata } from '../utils/solanaToken.js';
import { getTokenDetails as getGeckoTokenDetails } from '../services/geckoTerminal.js';
import { getTokenDetails as getDexTokenDetails } from '../services/dexscreener.js';
import { AppError, handleExternalApiError } from '../middleware/errorHandler.js';
import { validateAddress, validateAmount, validateChainId } from '../utils/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { getWalletBalance, getTokenBalances } from '../services/alchemy.js';
import * as coinbaseCdpService from '../services/coinbaseCdp.js';
import { getTransactionReceipt } from '../services/rpcManager.js';

// 类型定义
export interface SwapQuoteRequest {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippageBps?: number;
    userAddress?: string;
    aggregator?: 'jupiter' | 'raydium' | 'orca' | 'auto' | '0x' | 'zeroex' | 'kyber'; // aggregator selector
}

export interface SwapQuoteResponse {
    success: boolean;
    data?: {
        dex: string;
        dexName?: string;
        amountOut: string;
        amountOutBase?: string;
        gasEstimate: number;
        priceImpact: number;
        path: string[];
        router: string;
        deadline: number;
        to?: string;
        data?: string;
        value?: string;
        allowanceTarget?: string;
        tokenInDecimals?: number;
        tokenOutDecimals?: number;
        swapTransaction?: string;
    };
    quotes?: any[];
    error?: string;
}

export interface SwapExecuteRequest {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOutMin: string;
    chainId: number;
    userAddress: string;
}

export interface SwapExecuteResponse {
    success: boolean;
    data?: {
        txHash?: string;
        status?: string;
    };
    error?: string;
}

export interface TradeRecord {
    id: string;
    userAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut?: string;
    chainId: number;
    txHash?: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    createdAt: number;
    completedAt?: number;
    gasUsed?: string;
    error?: string;
}

// 内存存储（实际应该使用数据库）
// 使用带过期时间的缓存机制防止内存泄漏
interface CachedTradeRecord {
    record: TradeRecord;
    expiresAt: number;
}

interface CachedPendingTransaction {
    request: SwapExecuteRequest;
    expiresAt: number;
}

import { env } from '../config/env.js';

// 从配置读取常量
const MAX_TRADE_HISTORY = env.swapConfig.maxTradeHistory;
const MAX_PENDING_TRANSACTIONS = env.swapConfig.maxPendingTransactions;
const TRADE_RECORD_TTL = env.swapConfig.tradeRecordTtl;
const PENDING_TRANSACTION_TTL = env.swapConfig.pendingTransactionTtl;

// Swap retry configuration
const SWAP_MAX_RETRIES = 2; // Maximum number of retry attempts
const SWAP_CONFIRMATION_TIMEOUT_MS = 30000; // 30 seconds to wait for confirmation
const SWAP_CONFIRMATION_POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

const tradeHistory: Map<string, CachedTradeRecord> = new Map();
const pendingTransactions: Map<string, CachedPendingTransaction> = new Map();

/**
 * Wait for transaction confirmation and check status
 * Returns { success: true } if tx succeeded, { success: false, error: string } if failed
 */
async function waitForTransactionConfirmation(
    txHash: string,
    chainId: number
): Promise<{ success: boolean; error?: string; receipt?: any }> {
    const startTime = Date.now();

    while (Date.now() - startTime < SWAP_CONFIRMATION_TIMEOUT_MS) {
        try {
            const receipt = await getTransactionReceipt(chainId, txHash);

            if (receipt) {
                // Status is "0x1" for success, "0x0" for failure
                const status = receipt.status;
                const isSuccess = status === '0x1' || status === 1 || status === true;

                if (isSuccess) {
                    console.log(`[Swap Retry] Transaction ${txHash} confirmed SUCCESS`);
                    return { success: true, receipt };
                } else {
                    console.log(`[Swap Retry] Transaction ${txHash} confirmed FAILED (status: ${status})`);
                    return {
                        success: false,
                        error: 'Transaction failed on-chain (Call Failed)',
                        receipt
                    };
                }
            }

            // Receipt not available yet, wait and retry
            await new Promise(resolve => setTimeout(resolve, SWAP_CONFIRMATION_POLL_INTERVAL_MS));
        } catch (error: any) {
            // RPC error, wait and retry
            console.warn(`[Swap Retry] Error checking receipt: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, SWAP_CONFIRMATION_POLL_INTERVAL_MS));
        }
    }

    // Timeout - assume pending (not failed)
    console.warn(`[Swap Retry] Timeout waiting for transaction ${txHash}`);
    return { success: true }; // Don't retry if we timeout - tx might still succeed
}

// 清理过期记录的函数
function cleanupExpiredRecords() {
    const now = Date.now();

    // 清理过期的交易记录
    for (const [key, cached] of tradeHistory.entries()) {
        if (cached.expiresAt < now) {
            tradeHistory.delete(key);
        }
    }

    // 清理过期的待处理交易
    for (const [key, cached] of pendingTransactions.entries()) {
        if (cached.expiresAt < now) {
            pendingTransactions.delete(key);
        }
    }

    // 如果交易记录超过最大数量，删除最旧的
    if (tradeHistory.size > MAX_TRADE_HISTORY) {
        const sortedEntries = Array.from(tradeHistory.entries())
            .sort((a, b) => a[1].record.createdAt - b[1].record.createdAt);
        const toDelete = sortedEntries.slice(0, tradeHistory.size - MAX_TRADE_HISTORY);
        for (const [key] of toDelete) {
            tradeHistory.delete(key);
        }
    }

    // 如果待处理交易超过最大数量，删除最旧的
    if (pendingTransactions.size > MAX_PENDING_TRANSACTIONS) {
        const sortedEntries = Array.from(pendingTransactions.entries())
            .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        const toDelete = sortedEntries.slice(0, pendingTransactions.size - MAX_PENDING_TRANSACTIONS);
        for (const [key] of toDelete) {
            pendingTransactions.delete(key);
        }
    }
}

// 每5分钟清理一次过期记录
setInterval(cleanupExpiredRecords, 5 * 60 * 1000);

/**
 * Swap Routes for Fastify
 */
export async function swapRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/swap/quote
     * 获取交换报价 - 使用 0x API
     */
    fastify.post<{ Body: SwapQuoteRequest }>('/quote', async (request, reply) => {
        try {
            const { tokenIn, tokenOut, amountIn, chainId, slippageBps = 50, userAddress, aggregator } = request.body as any;

            // 验证输入
            if (!tokenIn || !tokenOut || !amountIn || !chainId) {
                throw new AppError(400, 'tokenIn, tokenOut, amountIn, and chainId are required', 'VALIDATION_ERROR');
            }

            // CRITICAL VALIDATION: Prevent same token swap
            if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
                throw new AppError(400, 'tokenIn and tokenOut must be different tokens', 'VALIDATION_ERROR');
            }

            // 验证金额和链ID
            validateAmount(amountIn);
            const validatedChainId = validateChainId(chainId);

            // Handle Solana (chainId 900) separately - skip EVM address validation
            if (validatedChainId === 900) {
                return handleSolanaQuote(request, reply);
            }

            // 验证地址格式（如果不是原生代币）- only for EVM chains
            if (!isNativeToken(tokenIn)) {
                validateAddress(tokenIn, 'tokenIn');
            }
            if (!isNativeToken(tokenOut)) {
                validateAddress(tokenOut, 'tokenOut');
            }

            // Normalize native token address to 0xEeee... format for 0x API permit2 endpoint
            // The 0x permit2 endpoint expects 0xEeee... for native ETH, not WETH
            const actualTokenIn = normalizeTokenAddress(tokenIn);
            const actualTokenOut = normalizeTokenAddress(tokenOut);

            // Validate token addresses match the chain to prevent cross-chain address confusion
            const chainTokenValidation: Record<number, { invalid: string[] }> = {
                56: { // BSC
                    invalid: [
                        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Base USDC - should not be used on BSC
                    ],
                },
                8453: { // Base
                    invalid: [
                        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // BSC USDC - should not be used on Base
                    ],
                },
            };

            const validation = chainTokenValidation[validatedChainId];
            if (validation) {
                const tokenInLower = tokenIn.toLowerCase();
                const tokenOutLower = tokenOut.toLowerCase();

                if (validation.invalid.includes(tokenInLower)) {
                    throw new AppError(
                        400,
                        `Invalid tokenIn address for chain ${validatedChainId}: ${tokenIn} is not supported on this chain. This may cause incorrect token transfers.`,
                        'INVALID_TOKEN_ADDRESS'
                    );
                }
                if (validation.invalid.includes(tokenOutLower)) {
                    throw new AppError(
                        400,
                        `Invalid tokenOut address for chain ${validatedChainId}: ${tokenOut} is not supported on this chain. This may cause incorrect token transfers.`,
                        'INVALID_TOKEN_ADDRESS'
                    );
                }
            }

            // Validate that input and output tokens are different
            if (actualTokenIn.toLowerCase() === actualTokenOut.toLowerCase()) {
                throw new AppError(
                    400,
                    'Cannot swap a token for itself. Please select different tokens.',
                    'SAME_TOKEN_ERROR'
                );
            }

            // Get token metadata to determine decimals
            // For native tokens (0xEeee...), use WETH address to get metadata
            const tokenInForMetadata = isNativeToken(tokenIn)
                ? getNativeTokenAddress(validatedChainId)
                : actualTokenIn;
            const tokenOutForMetadata = isNativeToken(tokenOut)
                ? getNativeTokenAddress(validatedChainId)
                : actualTokenOut;

            // getZeroExTokenMetadata now has RPC fallback built-in for unknown tokens
            console.log('[Swap Quote] Fetching metadata for:', {
                tokenInForMetadata: tokenInForMetadata?.slice(0, 12),
                tokenOutForMetadata: tokenOutForMetadata?.slice(0, 12),
                actualTokenIn: actualTokenIn.slice(0, 12),
                actualTokenOut: actualTokenOut.slice(0, 12),
                isTokenOutNative: isNativeToken(tokenOut),
            });
            const [tokenInMetadata, tokenOutMetadata] = await Promise.all([
                getZeroExTokenMetadata(tokenInForMetadata || actualTokenIn, validatedChainId),
                getZeroExTokenMetadata(tokenOutForMetadata || actualTokenOut, validatedChainId),
            ]);

            let tokenInDecimals = tokenInMetadata?.decimals || 18;
            let tokenOutDecimals = tokenOutMetadata?.decimals || 18;

            // Override decimals for known tokens (USDC, USDT, etc.) to prevent metadata errors
            const knownInDecimals = getKnownTokenDecimals(actualTokenIn, validatedChainId);
            if (knownInDecimals !== undefined) {
                console.log(`[Swap Quote] Overriding tokenIn decimals to known value: ${knownInDecimals}`);
                tokenInDecimals = knownInDecimals;
            }

            const knownOutDecimals = getKnownTokenDecimals(actualTokenOut, validatedChainId);
            if (knownOutDecimals !== undefined) {
                console.log(`[Swap Quote] Overriding tokenOut decimals to known value: ${knownOutDecimals}`);
                tokenOutDecimals = knownOutDecimals;
            }

            console.log('[Swap Quote] Token decimals:', {
                tokenIn: actualTokenIn.slice(0, 10),
                tokenOut: actualTokenOut.slice(0, 10),
                tokenInDecimals,
                tokenOutDecimals,
                tokenOutMetadataDecimals: tokenOutMetadata?.decimals,
            });

            // Convert amount to base units using correct decimals
            const sellAmount = toWei(amountIn, tokenInDecimals);

            // Validate sellAmount is greater than 0
            const sellAmountBigInt = BigInt(sellAmount || '0');
            if (sellAmountBigInt === 0n) {
                throw new AppError(
                    400,
                    `Invalid amount: ${amountIn}. Amount must be greater than 0.`,
                    'INVALID_AMOUNT'
                );
            }

            // Fetch USD reference prices for market comparison
            const [tokenInUsd, tokenOutUsd] = await Promise.all([
                getTokenPriceUSD(actualTokenIn, validatedChainId),
                getTokenPriceUSD(actualTokenOut, validatedChainId),
            ]);
            // refPrice = tokenInUsd / tokenOutUsd = how many tokenOut units per 1 tokenIn (based on USD)
            const refPrice = (tokenInUsd && tokenOutUsd && tokenInUsd > 0 && tokenOutUsd > 0)
                ? (tokenInUsd / tokenOutUsd)
                : null;
            // Get Best Quote (Compare 0x and Kyber)
            const { best, quotes } = await getBestQuote({
                tokenIn,
                tokenOut,
                actualTokenIn,
                actualTokenOut,
                amountInBase: sellAmount,
                amountInHuman: parseFloat(amountIn),
                tokenInDecimals,
                tokenOutDecimals,
                chainId: validatedChainId,
                slippageBps,
                userAddress: userAddress || undefined,
                refPrice,
            });

            if (!best) {
                throw new AppError(
                    400,
                    `No quotes available for ${tokenIn} -> ${tokenOut} on chain ${validatedChainId}`,
                    'QUOTE_ERROR'
                );
            }

            return reply.send({
                success: true,
                data: best,
                quotes,
            } as SwapQuoteResponse);
        } catch (error) {
            // Error handler middleware will handle the response
            throw error;
        }
    });

    /**
     * POST /api/swap/prices
     * 获取代币价格数据 - 使用 0x API 和备用源
     */
    fastify.post<{
        Body: {
            tokenInAddress: string;
            tokenOutAddress: string;
            chainId: number;
        }
    }>('/prices', async (request, reply) => {
        try {
            const { tokenInAddress, tokenOutAddress, chainId } = request.body;

            if (!tokenInAddress || !tokenOutAddress || !chainId) {
                return reply.status(400).send({
                    success: false,
                    error: 'tokenInAddress, tokenOutAddress, and chainId are required',
                });
            }

            // Normalize addresses to lowercase FIRST to avoid case-sensitivity issues
            const normalizedTokenIn = tokenInAddress.toLowerCase();
            const normalizedTokenOut = tokenOutAddress.toLowerCase();

            // Early return if tokens are the same (prevents invalid 0x API calls)
            if (normalizedTokenIn === normalizedTokenOut) {
                return reply.status(400).send({
                    success: false,
                    error: 'tokenInAddress and tokenOutAddress must be different',
                });
            }

            // Handle Solana (chainId 900) separately - use GeckoTerminal
            if (chainId === 900) {
                try {
                    const network = 'solana';

                    // Fetch prices from GeckoTerminal for Solana tokens
                    const [tokenInData, tokenOutData] = await Promise.all([
                        getGeckoTokenDetails(network, tokenInAddress),
                        getGeckoTokenDetails(network, tokenOutAddress),
                    ]);

                    const tokenInPrice = tokenInData?.price || 0;
                    const tokenOutPrice = tokenOutData?.price || 0;

                    // For Solana, native token price is SOL price
                    const nativeTokenPrice = tokenInAddress === 'So11111111111111111111111111111111111111112'
                        ? tokenInPrice
                        : tokenOutAddress === 'So11111111111111111111111111111111111111112'
                            ? tokenOutPrice
                            : tokenInPrice || tokenOutPrice || 0;

                    console.log('[Swap Prices] Solana prices:', {
                        tokenInPrice,
                        tokenOutPrice,
                        nativeTokenPrice,
                    });

                    return reply.send({
                        success: true,
                        data: {
                            tokenInPrice,
                            tokenOutPrice,
                            nativeTokenPrice,
                        },
                    });
                } catch (error) {
                    console.error('[Swap Prices] Error fetching Solana prices:', error);
                    return reply.status(500).send({
                        success: false,
                        error: `Failed to fetch Solana prices: ${(error as Error).message}`,
                    });
                }
            }

            // Validate token addresses match the chain (EVM chains only)
            // Base USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) should not be used on BSC
            // BSC USDC (0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d) should not be used on Base
            const chainTokenValidation: Record<number, { invalid: string[]; valid?: string[] }> = {
                56: { // BSC
                    invalid: [
                        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Base USDC
                    ],
                },
                8453: { // Base
                    invalid: [
                        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // BSC USDC
                    ],
                },
            };

            const validation = chainTokenValidation[chainId];
            if (validation) {
                const tokenInLower = tokenInAddress.toLowerCase();
                const tokenOutLower = tokenOutAddress.toLowerCase();

                if (validation.invalid.includes(tokenInLower)) {
                    return reply.status(400).send({
                        success: false,
                        error: `Invalid token address for chain ${chainId}: ${tokenInAddress} is not supported on this chain`,
                    });
                }
                if (validation.invalid.includes(tokenOutLower)) {
                    return reply.status(400).send({
                        success: false,
                        error: `Invalid token address for chain ${chainId}: ${tokenOutAddress} is not supported on this chain`,
                    });
                }
            }

            // Addresses already normalized above (lines 450-451)
            // const normalizedTokenIn = tokenInAddress.toLowerCase();
            // const normalizedTokenOut = tokenOutAddress.toLowerCase();

            // 首先尝试使用 0x API 获取价格
            const [tokenInPrice0x, tokenOutPrice0x, nativeTokenPrice0x] = await Promise.all([
                getTokenPriceUSD(normalizedTokenIn, chainId),
                getTokenPriceUSD(normalizedTokenOut, chainId),
                (async () => {
                    // 获取原生代币价格（ETH, BNB 等）
                    const nativeTokenAddresses: Record<number, string> = {
                        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH on Ethereum
                        8453: '0x4200000000000000000000000000000000000006', // WETH on Base
                        42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
                        56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB on BSC
                    };
                    const nativeAddress = nativeTokenAddresses[chainId];
                    if (nativeAddress) {
                        return await getTokenPriceUSD(nativeAddress, chainId);
                    }
                    return null;
                })(),
            ]);

            // 如果 0x API 返回了价格，使用它们
            let tokenInPrice = tokenInPrice0x;
            let tokenOutPrice = tokenOutPrice0x;
            let nativeTokenPrice = nativeTokenPrice0x;

            // 如果 0x API 没有返回价格，尝试备用源
            if (!tokenInPrice || !tokenOutPrice) {
                const chainIdToNetwork: Record<number, string> = {
                    1: 'eth',
                    8453: 'base',
                    56: 'bsc',
                    42161: 'arbitrum',
                    137: 'polygon',
                    10: 'optimism',
                    43114: 'avalanche',
                    250: 'fantom',
                };

                const network = chainIdToNetwork[chainId] || 'eth';
                const networkToDexChainId: Record<string, string> = {
                    'eth': 'ethereum',
                    'base': 'base',
                    'bsc': 'bsc',
                    'arbitrum': 'arbitrum',
                    'polygon': 'polygon',
                    'optimism': 'optimism',
                    'avalanche': 'avalanche',
                    'fantom': 'fantom',
                };

                const dexChainId = networkToDexChainId[network] || 'ethereum';

                // 尝试从 Gecko Terminal 或 DexScreener 获取价格
                if (!tokenInPrice) {
                    let token = await getGeckoTokenDetails(network, normalizedTokenIn);
                    if (!token) {
                        const dexToken = await getDexTokenDetails(dexChainId, normalizedTokenIn);
                        if (dexToken) {
                            token = {
                                address: dexToken.address,
                                name: dexToken.name,
                                symbol: dexToken.symbol,
                                network: dexToken.network,
                                price: dexToken.price,
                                priceChange24h: dexToken.priceChange24h,
                                volume24h: dexToken.volume24h,
                                liquidity: dexToken.liquidity,
                                fdv: dexToken.fdv,
                            };
                        }
                    }
                    tokenInPrice = token?.price || 0;
                }

                if (!tokenOutPrice) {
                    let token = await getGeckoTokenDetails(network, normalizedTokenOut);
                    if (!token) {
                        const dexToken = await getDexTokenDetails(dexChainId, normalizedTokenOut);
                        if (dexToken) {
                            token = {
                                address: dexToken.address,
                                name: dexToken.name,
                                symbol: dexToken.symbol,
                                network: dexToken.network,
                                price: dexToken.price,
                                priceChange24h: dexToken.priceChange24h,
                                volume24h: dexToken.volume24h,
                                liquidity: dexToken.liquidity,
                                fdv: dexToken.fdv,
                            };
                        }
                    }
                    tokenOutPrice = token?.price || 0;
                }

                // 获取原生代币价格
                if (!nativeTokenPrice) {
                    if (chainId === 1 || chainId === 8453 || chainId === 42161) {
                        const wethAddresses: Record<number, string> = {
                            1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                            8453: '0x4200000000000000000000000000000000000006',
                            42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
                        };
                        const wethAddress = wethAddresses[chainId];
                        if (wethAddress) {
                            let token = await getGeckoTokenDetails(network, wethAddress);
                            if (!token) {
                                const dexToken = await getDexTokenDetails(dexChainId, wethAddress);
                                if (dexToken) {
                                    token = {
                                        address: dexToken.address,
                                        name: dexToken.name,
                                        symbol: dexToken.symbol,
                                        network: dexToken.network,
                                        price: dexToken.price,
                                        priceChange24h: dexToken.priceChange24h,
                                        volume24h: dexToken.volume24h,
                                        liquidity: dexToken.liquidity,
                                        fdv: dexToken.fdv,
                                    };
                                }
                            }
                            nativeTokenPrice = token?.price || 0;
                        }
                    } else if (chainId === 56) {
                        const wbnbAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
                        let token = await getGeckoTokenDetails(network, wbnbAddress);
                        if (!token) {
                            const dexToken = await getDexTokenDetails(dexChainId, wbnbAddress);
                            if (dexToken) {
                                token = {
                                    address: dexToken.address,
                                    name: dexToken.name,
                                    symbol: dexToken.symbol,
                                    network: dexToken.network,
                                    price: dexToken.price,
                                    priceChange24h: dexToken.priceChange24h,
                                    volume24h: dexToken.volume24h,
                                    liquidity: dexToken.liquidity,
                                    fdv: dexToken.fdv,
                                };
                            }
                        }
                        nativeTokenPrice = token?.price || 0;
                    }
                }
            }

            // 如果价格仍为 0，记录警告
            if (tokenInPrice === 0 || tokenOutPrice === 0) {
                console.warn(`[Swap Prices] Warning: Some prices are 0`, {
                    tokenIn: { address: tokenInAddress, price: tokenInPrice },
                    tokenOut: { address: tokenOutAddress, price: tokenOutPrice },
                    chainId,
                });
            }

            return reply.send({
                success: true,
                data: {
                    tokenInPrice: tokenInPrice || 0,
                    tokenOutPrice: tokenOutPrice || 0,
                    nativeTokenPrice: nativeTokenPrice || tokenInPrice || tokenOutPrice || 0,
                },
            });
        } catch (error) {
            console.error('[Swap Prices] Error fetching prices:', error);
            return reply.status(500).send({
                success: false,
                error: `Failed to fetch prices: ${(error as Error).message}`,
            });
        }
    });

    /**
     * POST /api/swap/execute-instant
     * Execute swap using Privy server-side signing (no user popup)
     * Requires authentication and user must have an embedded wallet
     */
    fastify.post<{ Body: SwapQuoteRequest }>(
        '/execute-instant',
        { preHandler: requireAuth },
        async (request, reply) => {
            try {
                // Import Privy wallet service dynamically to avoid startup errors if not configured
                const { sendTransaction, isPrivyConfigured, getEmbeddedWalletAddress } = await import('../services/privyWallet.js');

                if (!isPrivyConfigured()) {
                    throw new AppError(503, 'Instant trading not configured. Set PRIVY_APP_SECRET.', 'NOT_CONFIGURED');
                }

                const { tokenIn: rawTokenIn, tokenOut: rawTokenOut, amountIn, chainId, slippageBps = 50 } = request.body;

                // Normalize token addresses: ensure lowercase 0x prefix for consistency
                // This fixes issues where frontend sends '0X...' (uppercase) which causes API failures
                const normalizeAddress = (addr: string): string => {
                    if (!addr) return addr;
                    // If it's a symbol (like 'ETH', 'BNB'), return as-is
                    if (!addr.startsWith('0x') && !addr.startsWith('0X')) return addr;
                    // Normalize to checksummed format: lowercase 0x + original case for rest
                    // For API consistency, we lowercase the entire address
                    return addr.toLowerCase();
                };

                const tokenIn = normalizeAddress(rawTokenIn);
                const tokenOut = normalizeAddress(rawTokenOut);

                // Validate inputs
                if (!tokenIn || !tokenOut || !amountIn || !chainId) {
                    throw new AppError(400, 'tokenIn, tokenOut, amountIn, and chainId are required', 'VALIDATION_ERROR');
                }

                // CRITICAL VALIDATION: Prevent same token swap
                if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
                    throw new AppError(400, 'tokenIn and tokenOut must be different tokens', 'VALIDATION_ERROR');
                }

                // Get user from auth middleware
                const user = (request as any).user;
                if (!user?.sub) {
                    throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
                }

                const userId = user.sub;

                // Get user's access token from Authorization header
                const authHeader = request.headers.authorization || '';
                const accessToken = authHeader.replace('Bearer ', '');

                if (!accessToken) {
                    throw new AppError(401, 'Missing access token', 'UNAUTHORIZED');
                }

                // Get user's embedded wallet address
                const walletAddress = await getEmbeddedWalletAddress(userId);
                if (!walletAddress) {
                    throw new AppError(400, 'User has no embedded wallet. Please create one first.', 'NO_WALLET');
                }

                console.log('[Swap Execute Instant] Starting swap:', {
                    userId: userId.slice(0, 10),
                    wallet: walletAddress.slice(0, 10),
                    tokenIn: tokenIn.slice(0, 10),
                    tokenOut: tokenOut.slice(0, 10),
                    amountIn,
                    chainId,
                });

                // Step 1: Get quote with full transaction data
                const validatedChainId = validateChainId(chainId);

                // Handle 'all' amount - query user balance and use full amount
                let resolvedAmountIn = amountIn;
                if (amountIn.toLowerCase() === 'all' || amountIn.toLowerCase() === 'max') {
                    console.log('[Swap Execute Instant] Resolving "all" amount for token:', tokenIn);

                    // Map chainId to chain name for alchemy
                    const chainNameMap: Record<number, string> = {
                        1: 'eth',
                        8453: 'base',
                        56: 'bsc',
                        42161: 'arbitrum',
                        137: 'polygon',
                        10: 'optimism',
                    };
                    const chainName = chainNameMap[validatedChainId] || 'eth';

                    // Check if tokenIn is native token
                    const isNativeTokenIn = isNativeToken(tokenIn);

                    if (isNativeTokenIn) {
                        // Get native balance (Now using Infura via alchemyService.getEthBalance)
                        const walletBalance = await getWalletBalance(walletAddress, chainName);
                        // For native tokens, we must leave some for gas, but "all" usually implies "max swappable"
                        // However, without complex gas estimation, "all" for native is risky.
                        // For now, we use the balance but the subsequent gas check might fail or we rely on the user understanding.
                        // Better to subtract a fixed gas buffer if generic.
                        // Let's rely on the straightforward logic for now, or just return the balance.
                        resolvedAmountIn = walletBalance.ethBalanceFormatted.toString();
                        console.log('[Swap Execute Instant] Native balance:', resolvedAmountIn);
                    } else {
                        // Get token balance
                        let tokenBalances: any[] = [];
                        const chainIdNum = parseInt(validatedChainId.toString(), 10);

                        if (coinbaseCdpService.isChainSupported(chainIdNum)) {
                            tokenBalances = await coinbaseCdpService.getEvmTokenBalances(walletAddress, chainIdNum);
                        } else {
                            // Fallback to alchemy (which now only works for Solana tokens, returns [] for EVM)
                            tokenBalances = await getTokenBalances(walletAddress, chainName);
                        }

                        // Find the token by symbol or address
                        const tokenSymbolUpper = tokenIn.toUpperCase();
                        const tokenAddressLower = tokenIn.toLowerCase();

                        const foundToken = tokenBalances.find(t =>
                            t.symbol?.toUpperCase() === tokenSymbolUpper ||
                            t.contractAddress?.toLowerCase() === tokenAddressLower
                        );

                        if (foundToken && foundToken.tokenBalance) {
                            // SAFETY FIX: Subtract a small epsilon from the balance to prevents TRANSFER_FROM_FAILED
                            // This accounts for potential RPC node drift or dust issues.
                            // We convert to BigInt, subtract 1000 base units, and convert back.
                            const decimals = foundToken.decimals || 18;
                            const rawBalance = toWei(foundToken.tokenBalance, decimals);
                            const balanceBigInt = BigInt(rawBalance);

                            // Only subtract if balance is large enough (> 10000 units)
                            if (balanceBigInt > 10000n) {
                                const safetyMargin = 1000n; // Subtract 1000 base units (e.g. 0.001000 USDC)
                                const safeBalance = balanceBigInt - safetyMargin;

                                // Convert back to formatted string
                                const divisor = 10n ** BigInt(decimals);
                                const whole = safeBalance / divisor;
                                const remainder = safeBalance % divisor;
                                const remainderStr = remainder.toString().padStart(decimals, '0');
                                resolvedAmountIn = `${whole}.${remainderStr}`;

                                console.log('[Swap Execute Instant] Applied safety margin for MAX swap:', {
                                    original: foundToken.tokenBalance,
                                    safe: resolvedAmountIn,
                                    margin: safetyMargin.toString()
                                });
                            } else {
                                resolvedAmountIn = foundToken.tokenBalance;
                            }

                            console.log('[Swap Execute Instant] Token balance for', tokenIn, ':', resolvedAmountIn);
                        } else {
                            throw new AppError(400, `Could not find balance for token: ${tokenIn}. Please specify a numeric amount.`, 'TOKEN_NOT_FOUND');
                        }
                    }
                }

                validateAmount(resolvedAmountIn);

                // Handle Solana separately using launchpad service
                if (validatedChainId === 900) {
                    // Import launchpad service
                    const { solanaLaunchpadSwapService } = await import('../services/solanaLaunchpadSwapService.js');
                    const { findTokenOnAnyChain } = await import('../services/ai/tokenDetector.js');

                    // Detect launchpad provider
                    const tokenInfo = await findTokenOnAnyChain(tokenOut);
                    const launchpadProvider = tokenInfo?.launchpad?.provider || null;

                    console.log('[Swap Execute Instant] Solana token launchpad:', launchpadProvider);

                    if (launchpadProvider === 'pumpfun' || launchpadProvider === 'bonkfun') {
                        const txHash = await solanaLaunchpadSwapService.fastSwap({
                            userId,
                            mint: tokenOut,
                            amount: resolvedAmountIn,
                            isBuy: true, // For Solana instant swap, we assume buy (SOL -> token)
                            provider: launchpadProvider === 'pumpfun' ? 'pumpfun' : 'bonkfun',
                            slippageBps,
                        });

                        return reply.send({
                            success: true,
                            data: {
                                txHash,
                                method: 'solana_launchpad',
                            },
                        });
                    }

                    // Non-launchpad Solana token - use Jupiter aggregator
                    console.log('[Swap Execute Instant] Standard Solana token, using Jupiter aggregator...');

                    const { executeSolanaSwap } = await import('../services/solanaExecutor.js');
                    const { getSolanaTokenMetadata } = await import('../utils/solanaToken.js');

                    // Get metadata to determine decimals (Jupiter quote needs atomic units)
                    const metadata = await getSolanaTokenMetadata(tokenOut);
                    const decimals = metadata?.decimals || 9;

                    // Convert amount to atomic units
                    const { toWei } = await import('../services/zeroEx.js');
                    const amountInAtomic = toWei(resolvedAmountIn, 9); // Input is always SOL (9 decimals) for Buy

                    const txHash = await executeSolanaSwap({
                        userId,
                        tokenInMint: 'So11111111111111111111111111111111111111112', // SOL
                        tokenOutMint: tokenOut,
                        amountIn: amountInAtomic,
                        slippageBps,
                    });

                    return reply.send({
                        success: true,
                        data: {
                            txHash,
                            method: 'jupiter_aggregator',
                        },
                    });
                }

                // Resolve token symbols to addresses using centralized service
                const resolvedTokenIn = resolveTokenAddress(tokenIn, validatedChainId);
                const resolvedTokenOut = resolveTokenAddress(tokenOut, validatedChainId);

                // Normalize addresses (handle native token formats)
                const actualTokenIn = isNativeToken(resolvedTokenIn)
                    ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
                    : resolvedTokenIn;
                const actualTokenOut = isNativeToken(resolvedTokenOut)
                    ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
                    : resolvedTokenOut;

                // Get token metadata for decimals (In AND Out needed for human readable calc)
                const tokenInForMetadata = isNativeToken(resolvedTokenIn)
                    ? getNativeTokenAddress(validatedChainId)
                    : actualTokenIn;
                const tokenOutForMetadata = isNativeToken(resolvedTokenOut)
                    ? getNativeTokenAddress(validatedChainId)
                    : actualTokenOut;

                const [tokenInMetadata, tokenOutMetadata] = await Promise.all([
                    getZeroExTokenMetadata(tokenInForMetadata || actualTokenIn, validatedChainId),
                    getZeroExTokenMetadata(tokenOutForMetadata || actualTokenOut, validatedChainId),
                ]);

                let tokenInDecimals = tokenInMetadata?.decimals || 18;
                let tokenOutDecimals = tokenOutMetadata?.decimals || 18;

                // Override decimals for known tokens (USDC, USDT, etc.) to prevent metadata errors
                const knownInDecimalsExec = getKnownTokenDecimals(actualTokenIn, validatedChainId);
                if (knownInDecimalsExec !== undefined) tokenInDecimals = knownInDecimalsExec;

                const knownOutDecimalsExec = getKnownTokenDecimals(actualTokenOut, validatedChainId);
                if (knownOutDecimalsExec !== undefined) tokenOutDecimals = knownOutDecimalsExec;

                // ========== CRITICAL: ON-CHAIN BALANCE VERIFICATION ==========
                // Verify that resolvedAmountIn does not exceed actual on-chain balance
                // This prevents TRANSFER_FROM_FAILED errors when cached/stale balance data is used
                if (!isNativeToken(actualTokenIn)) {
                    const rpcUrls: Record<number, string> = {
                        1: 'https://eth.llamarpc.com',
                        8453: 'https://mainnet.base.org',
                        56: 'https://bsc-dataseed.bnbchain.org',
                        42161: 'https://arb1.arbitrum.io/rpc',
                        137: 'https://polygon-rpc.com',
                        10: 'https://mainnet.optimism.io',
                    };

                    const rpcUrl = rpcUrls[validatedChainId];
                    if (rpcUrl) {
                        try {
                            // ERC20 balanceOf(address) selector: 0x70a08231
                            const ownerPadded = walletAddress.slice(2).toLowerCase().padStart(64, '0');
                            const balanceOfData = `0x70a08231${ownerPadded}`;

                            const balanceResponse = await fetch(rpcUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    jsonrpc: '2.0',
                                    method: 'eth_call',
                                    params: [{ to: actualTokenIn, data: balanceOfData }, 'latest'],
                                    id: 1
                                }),
                            });

                            const balanceData = await balanceResponse.json() as { result?: string };
                            const onChainBalanceWei = BigInt(balanceData.result || '0x0');

                            // Convert resolvedAmountIn to Wei for comparison
                            const requestedAmountWei = BigInt(toWei(resolvedAmountIn, tokenInDecimals));

                            console.log('[Swap Execute Instant] On-chain balance verification:', {
                                token: actualTokenIn.slice(0, 10),
                                onChainBalance: onChainBalanceWei.toString(),
                                requestedAmount: requestedAmountWei.toString(),
                                decimals: tokenInDecimals,
                            });

                            // If requested amount exceeds on-chain balance, cap it
                            if (requestedAmountWei > onChainBalanceWei) {
                                console.warn('[Swap Execute Instant] AMOUNT EXCEEDS BALANCE! Capping to on-chain balance.');

                                // Apply safety margin (subtract 1000 base units to avoid rounding issues)
                                const safeBalance = onChainBalanceWei > 1000n ? onChainBalanceWei - 1000n : onChainBalanceWei;

                                // Convert back to human readable
                                const divisor = 10n ** BigInt(tokenInDecimals);
                                const whole = safeBalance / divisor;
                                const remainder = safeBalance % divisor;
                                const remainderStr = remainder.toString().padStart(tokenInDecimals, '0');
                                resolvedAmountIn = `${whole}.${remainderStr}`;

                                console.log('[Swap Execute Instant] Capped amount to:', resolvedAmountIn);
                            }
                        } catch (rpcError) {
                            console.warn('[Swap Execute Instant] RPC balance check failed, proceeding with original amount:', rpcError);
                            // Continue with original amount if RPC fails - better to try and fail with clear error
                        }
                    }
                }
                // ========== END BALANCE VERIFICATION ==========

                // Convert amount to base units (use resolved amount which handles 'all')
                const sellAmount = toWei(resolvedAmountIn, tokenInDecimals);

                // Fetch USD reference prices for market comparison (needed for Price Impact)
                const [tokenInUsd, tokenOutUsd] = await Promise.all([
                    getTokenPriceUSD(actualTokenIn, validatedChainId),
                    getTokenPriceUSD(actualTokenOut, validatedChainId),
                ]);
                // refPrice = tokenInUsd / tokenOutUsd = how many tokenOut units per 1 tokenIn (based on USD)
                const refPrice = (tokenInUsd && tokenOutUsd && tokenInUsd > 0 && tokenOutUsd > 0)
                    ? (tokenInUsd / tokenOutUsd)
                    : null;

                // Get Best Quote (Compare 0x and Kyber)
                const { best: quote } = await getBestQuote({
                    tokenIn,
                    tokenOut,
                    actualTokenIn,
                    actualTokenOut,
                    amountInBase: sellAmount,
                    amountInHuman: parseFloat(resolvedAmountIn),
                    tokenInDecimals,
                    tokenOutDecimals,
                    chainId: validatedChainId,
                    slippageBps,
                    userAddress: walletAddress,
                    refPrice,
                });

                if (!quote || !quote.to || !quote.data) {
                    throw new AppError(500, 'Failed to get swap quote from any provider', 'QUOTE_ERROR');
                }

                console.log('[Swap Execute Instant] Got BEST quote:', {
                    dex: quote.dexName,
                    to: quote.to?.slice(0, 10),
                    dataLength: quote.data?.length,
                    value: quote.value,
                    buyAmount: quote.amountOutBase, // QuoteResult uses amountOutBase
                    allowanceTarget: quote.allowanceTarget,
                    priceImpact: quote.priceImpact,
                });

                // Price Impact Safety Check
                const { maxPriceImpact = 5 } = request.body as any; // Default 5%
                if (quote.priceImpact > maxPriceImpact) {
                    throw new AppError(
                        400,
                        `Price impact too high: ${quote.priceImpact.toFixed(2)}% (Max: ${maxPriceImpact}%). Try a smaller amount.`,
                        'PRICE_IMPACT_TOO_HIGH'
                    );
                }

                // Determine if this is a BUY (native → token) or SELL (token → native) operation
                const isNativeTokenIn = actualTokenIn.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
                const isNativeTokenOut = actualTokenOut.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
                const isBuyingToken = isNativeTokenIn && !isNativeTokenOut; // ETH → Token
                const isSellingToken = !isNativeTokenIn && isNativeTokenOut; // Token → ETH

                // Step 2a: If SELLING a token (not native), ensure router has approval
                if (!isNativeTokenIn && quote.allowanceTarget) {
                    console.log('[Swap Execute Instant] Selling ERC20, checking approval for router:', {
                        token: actualTokenIn.slice(0, 10),
                        spender: quote.allowanceTarget.slice(0, 10),
                    });

                    // Check existing allowance before approving
                    // ERC20 allowance function: allowance(address owner, address spender) returns (uint256)
                    // Function selector: 0xdd62ed3e
                    const ownerPadded = walletAddress.slice(2).padStart(64, '0');
                    const spenderPadded = quote.allowanceTarget.slice(2).padStart(64, '0');
                    const allowanceCallData = `0xdd62ed3e${ownerPadded}${spenderPadded}`;

                    // RPC URLs for supported chains
                    const rpcUrls: Record<number, string> = {
                        1: 'https://eth.llamarpc.com',
                        8453: 'https://mainnet.base.org',
                        56: 'https://bsc-dataseed.bnbchain.org',
                        42161: 'https://arb1.arbitrum.io/rpc',
                        137: 'https://polygon-rpc.com',
                        10: 'https://mainnet.optimism.io',
                    };

                    const rpcUrl = rpcUrls[validatedChainId];

                    try {
                        if (!rpcUrl) {
                            console.warn('[Swap Execute Instant] No RPC URL for chain, skipping allowance check and approving');
                            throw new Error('No RPC URL for allowance check');
                        }

                        // Call allowance function via RPC
                        const rpcResponse = await fetch(rpcUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'eth_call',
                                params: [{ to: actualTokenIn, data: allowanceCallData }, 'latest'],
                                id: 1
                            }),
                        });

                        const rpcData = await rpcResponse.json() as { result?: string; error?: unknown };
                        const allowanceResult = rpcData.result || '0x0';

                        // Parse the result (hex string to bigint)
                        const currentAllowance = BigInt(allowanceResult || '0x0');
                        const requiredAmount = BigInt(sellAmount);

                        console.log('[Swap Execute Instant] Allowance check:', {
                            currentAllowance: currentAllowance.toString(),
                            requiredAmount: requiredAmount.toString(),
                            needsApproval: currentAllowance < requiredAmount,
                        });

                        // Only approve if current allowance is insufficient
                        if (currentAllowance < requiredAmount) {
                            // ERC20 approve function selector: 0x095ea7b3
                            // Parameters: spender (address), amount (uint256)
                            // We approve max uint256 to avoid future approvals
                            const MAX_UINT256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
                            const approveData = `0x095ea7b3${spenderPadded}${MAX_UINT256}`;

                            const approveTxHash = await sendTransaction(userId, accessToken, {
                                to: actualTokenIn, // Approve the token we're selling
                                data: approveData,
                                value: '0',
                                chainId: validatedChainId,
                            });

                            console.log('[Swap Execute Instant] Approval sent:', approveTxHash);

                            // Wait for approval to be mined (Base has ~2s blocks)
                            await new Promise(resolve => setTimeout(resolve, 4000));
                        } else {
                            console.log('[Swap Execute Instant] Sufficient allowance, skipping approval');
                        }
                    } catch (allowanceError: any) {
                        console.error('[Swap Execute Instant] Allowance check/approval failed:', allowanceError.message);
                        throw new AppError(500, `Failed to check/approve token: ${allowanceError.message}`, 'APPROVAL_FAILED');
                    }
                }

                // Step 2b: Execute swap with retry logic
                // If transaction fails on-chain, get fresh quote and retry
                let txHash: string = '';
                let finalQuote = quote;
                let retryCount = 0;
                let lastError: string | undefined;

                while (retryCount <= SWAP_MAX_RETRIES) {
                    try {
                        // Get fresh quote if this is a retry
                        if (retryCount > 0) {
                            console.log(`[Swap Retry] Attempt ${retryCount + 1}/${SWAP_MAX_RETRIES + 1} - Getting fresh quote...`);

                            const { best: freshQuote } = await getBestQuote({
                                tokenIn,
                                tokenOut,
                                actualTokenIn,
                                actualTokenOut,
                                amountInBase: sellAmount,
                                amountInHuman: parseFloat(resolvedAmountIn),
                                tokenInDecimals,
                                tokenOutDecimals,
                                chainId: validatedChainId,
                                slippageBps,
                                userAddress: walletAddress,
                                refPrice,
                            });

                            if (!freshQuote || !freshQuote.to || !freshQuote.data) {
                                throw new Error('Failed to get fresh quote for retry');
                            }

                            finalQuote = freshQuote;
                            console.log(`[Swap Retry] Got fresh quote from ${freshQuote.dexName}`);
                        }

                        // Execute swap transaction using Privy server-side signing
                        txHash = await sendTransaction(userId, accessToken, {
                            to: finalQuote.to,
                            data: finalQuote.data,
                            value: finalQuote.value || '0',
                            chainId: validatedChainId,
                            gas: finalQuote.gasEstimate?.toString(),
                        });

                        console.log(`[Swap Execute Instant] Transaction sent (attempt ${retryCount + 1}):`, txHash);

                        // Wait for transaction confirmation
                        const confirmation = await waitForTransactionConfirmation(txHash, validatedChainId);

                        if (confirmation.success) {
                            // Transaction succeeded! Exit retry loop
                            console.log(`[Swap Execute Instant] Transaction confirmed successfully: ${txHash}`);
                            break;
                        } else {
                            // Transaction failed on-chain
                            lastError = confirmation.error || 'Transaction failed on-chain';
                            console.error(`[Swap Retry] Transaction failed: ${lastError}`);

                            if (retryCount < SWAP_MAX_RETRIES) {
                                retryCount++;
                                console.log(`[Swap Retry] Will retry with fresh quote...`);
                                // Small delay before retry
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                continue;
                            } else {
                                // Max retries reached
                                throw new AppError(
                                    500,
                                    `Swap failed after ${SWAP_MAX_RETRIES + 1} attempts: ${lastError}`,
                                    'SWAP_FAILED'
                                );
                            }
                        }
                    } catch (sendError: any) {
                        // Error during transaction send (not on-chain failure)
                        console.error(`[Swap Retry] Send error:`, sendError.message);

                        if (retryCount < SWAP_MAX_RETRIES && !sendError.code) {
                            retryCount++;
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }

                        throw sendError;
                    }
                }

                if (!txHash) {
                    throw new AppError(500, 'Failed to execute swap transaction', 'SWAP_FAILED');
                }

                // Step 3: If BUYING a token, auto-approve it for future sells (async, non-blocking)
                // This way when user sells later, they don't need to wait for approval
                if (isBuyingToken && finalQuote.allowanceTarget) {
                    // Fire and forget - don't block the response
                    (async () => {
                        try {
                            console.log('[Swap Execute Instant] Auto-approving purchased token:', {
                                token: actualTokenOut,
                                spender: finalQuote.allowanceTarget,
                            });

                            // Wait for swap to be confirmed first (Base has 2s blocks)
                            await new Promise(resolve => setTimeout(resolve, 5000));

                            // ERC20 approve function selector: 0x095ea7b3
                            // Parameters: spender (address), amount (uint256)
                            // We approve max uint256 to avoid future approvals
                            const MAX_UINT256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
                            const spenderPadded = finalQuote.allowanceTarget!.slice(2).padStart(64, '0');
                            const approveData = `0x095ea7b3${spenderPadded}${MAX_UINT256}`;

                            const approveTxHash = await sendTransaction(userId, accessToken, {
                                to: actualTokenOut, // Approve the token we just bought
                                data: approveData,
                                value: '0',
                                chainId: validatedChainId,
                            });

                            console.log('[Swap Execute Instant] Background approval sent:', approveTxHash);
                        } catch (approveError: any) {
                            // Don't fail the main operation - just log the error
                            console.error('[Swap Execute Instant] Background approval failed (non-critical):', approveError.message);
                        }
                    })();
                }

                // Record trade
                const tradeId = `instant_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                const tradeRecord: TradeRecord = {
                    id: tradeId,
                    userAddress: walletAddress,
                    tokenIn,
                    tokenOut,
                    amountIn,
                    amountOut: finalQuote.amountOutBase,
                    chainId: validatedChainId,
                    txHash,
                    status: 'SUCCESS',
                    createdAt: Date.now(),
                    completedAt: Date.now(),
                };

                const expiresAt = Date.now() + TRADE_RECORD_TTL;
                tradeHistory.set(tradeId, { record: tradeRecord, expiresAt });

                return reply.send({
                    success: true,
                    data: {
                        txHash,
                        tradeId,
                        status: 'SUCCESS',
                        amountOut: finalQuote.amountOutBase,
                        retryCount,
                    },
                });
            } catch (error) {
                console.error('[Swap Execute Instant] Error:', error);
                throw error;
            }
        });

    /**
     * POST /api/swap/execute
     * 执行交换（前端通过钱包执行，这里只是记录）
     */
    fastify.post<{ Body: SwapExecuteRequest }>('/execute', async (request, reply) => {
        try {
            const { tokenIn, tokenOut, amountIn, userAddress, chainId } = request.body;

            if (!tokenIn || !tokenOut || !amountIn || !userAddress || !chainId) {
                return reply.status(400).send({
                    success: false,
                    error: 'All fields are required',
                });
            }

            // CRITICAL VALIDATION: Prevent same token swap
            if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
                return reply.status(400).send({
                    success: false,
                    error: 'tokenIn and tokenOut must be different tokens'
                });
            }

            // Validate addresses
            validateAddress(userAddress, 'userAddress');
            if (tokenIn !== '0x0000000000000000000000000000000000000000') {
                validateAddress(tokenIn, 'tokenIn');
            }
            if (tokenOut !== '0x0000000000000000000000000000000000000000') {
                validateAddress(tokenOut, 'tokenOut');
            }
            validateAmount(amountIn);
            validateChainId(chainId);

            // 生成交易 ID
            const tradeId = `trade_${Date.now()}_${Math.random().toString(16).slice(2)}`;

            // 创建交易记录
            const tradeRecord: TradeRecord = {
                id: tradeId,
                userAddress,
                tokenIn,
                tokenOut,
                amountIn,
                chainId,
                status: 'PENDING',
                createdAt: Date.now(),
            };

            // 保存到存储（带过期时间）
            const expiresAt = Date.now() + TRADE_RECORD_TTL;
            tradeHistory.set(tradeId, {
                record: tradeRecord,
                expiresAt,
            });

            const pendingExpiresAt = Date.now() + PENDING_TRANSACTION_TTL;
            pendingTransactions.set(tradeId, {
                request: request.body,
                expiresAt: pendingExpiresAt,
            });

            // 清理过期记录
            cleanupExpiredRecords();

            // 注意：实际交易由前端通过钱包执行
            // 这里只是记录交易意图

            return reply.send({
                success: true,
                data: {
                    tradeId,
                    status: 'PENDING',
                },
            } as SwapExecuteResponse);
        } catch (error) {
            throw error;
        }
    });

    /**
     * GET /api/swap/status/:tradeId
     * 获取交易状态
     */
    fastify.get<{ Params: { tradeId: string } }>('/status/:tradeId', async (request, reply) => {
        try {
            const { tradeId } = request.params;

            const cached = tradeHistory.get(tradeId);

            // 检查是否过期
            if (!cached || cached.expiresAt < Date.now()) {
                if (cached) {
                    tradeHistory.delete(tradeId);
                }
                return reply.status(404).send({
                    success: false,
                    error: 'Trade not found',
                });
            }

            return reply.send({
                success: true,
                data: cached.record,
            });
        } catch (error) {
            throw error;
        }
    });

    /**
     * GET /api/swap/history
     * 获取交易历史
     */
    fastify.get<{
        Querystring: {
            userAddress?: string;
            limit?: string;
            offset?: string;
        }
    }>('/history', async (request, reply) => {
        try {
            const { userAddress, limit = '20', offset = '0' } = request.query;

            // 清理过期记录
            cleanupExpiredRecords();

            // 获取未过期的交易记录
            const now = Date.now();
            let trades = Array.from(tradeHistory.values())
                .filter(cached => cached.expiresAt >= now)
                .map(cached => cached.record);

            // 按用户地址过滤
            if (userAddress) {
                trades = trades.filter((t) => t.userAddress.toLowerCase() === userAddress.toLowerCase());
            }

            // 按创建时间排序（最新优先）
            trades.sort((a, b) => b.createdAt - a.createdAt);

            // 分页
            const limitNum = Math.min(parseInt(limit) || 20, 100);
            const offsetNum = parseInt(offset) || 0;

            const paginatedTrades = trades.slice(offsetNum, offsetNum + limitNum);

            return reply.send({
                success: true,
                data: {
                    trades: paginatedTrades,
                    total: trades.length,
                    limit: limitNum,
                    offset: offsetNum,
                },
            });
        } catch (error) {
            throw error;
        }
    });

    /**
     * POST /api/swap/approval-status
     * 检查用户对代币的授权状态
     */
    fastify.post<{
        Body: {
            userAddress: string;
            tokenAddress: string;
            requiredAmount: string;
            chainId: number;
        }
    }>('/approval-status', async (request, reply) => {
        try {
            const { userAddress, tokenAddress, requiredAmount, chainId } = request.body;

            if (!userAddress || !tokenAddress || !requiredAmount || !chainId) {
                return reply.status(400).send({
                    success: false,
                    error: 'userAddress, tokenAddress, requiredAmount, and chainId are required',
                });
            }

            // 验证地址格式
            validateAddress(userAddress, 'userAddress');
            validateAddress(tokenAddress, 'tokenAddress');
            validateAmount(requiredAmount);
            validateChainId(chainId);

            // TODO: 实际应该查询区块链合约的 allowance
            // 这里返回模拟数据
            const isApproved = Math.random() > 0.3; // 70% 已授权

            return reply.send({
                success: true,
                data: {
                    isApproved,
                    userAddress,
                    tokenAddress,
                    chainId,
                    message: isApproved
                        ? 'User has sufficient approval'
                        : 'User needs to approve token before swap',
                },
            });
        } catch (error) {
            throw error;
        }
    });
}

/**
 * Handle Solana swap quote request
 */
async function handleSolanaQuote(
    request: { body: SwapQuoteRequest },
    reply: any
) {
    try {
        const { tokenIn, tokenOut, amountIn, slippageBps = 50, aggregator = 'auto', userAddress } = request.body as any;

        // Normalize Solana token addresses
        const normalizedTokenIn = normalizeSolanaTokenAddress(tokenIn);
        const normalizedTokenOut = normalizeSolanaTokenAddress(tokenOut);

        // Validate that input and output tokens are different
        if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
            throw new AppError(
                400,
                'Cannot swap a token for itself. Please select different tokens.',
                'SAME_TOKEN_ERROR'
            );
        }

        // Get token metadata to determine decimals
        const [tokenInMetadata, tokenOutMetadata] = await Promise.all([
            getSolanaTokenMetadata(normalizedTokenIn),
            getSolanaTokenMetadata(normalizedTokenOut),
        ]);

        // CRITICAL: If metadata fetch fails, we MUST NOT use default decimals
        // Instead, we'll try to extract decimals from the quote response later
        let tokenInDecimals = tokenInMetadata?.decimals;
        let tokenOutDecimals = tokenOutMetadata?.decimals;

        // Log metadata fetch results
        console.log('[handleSolanaQuote] Token metadata:', {
            tokenIn: normalizedTokenIn,
            tokenInSymbol: tokenInMetadata?.symbol,
            tokenInDecimals,
            tokenOut: normalizedTokenOut,
            tokenOutSymbol: tokenOutMetadata?.symbol,
            tokenOutDecimals,
        });

        // If we don't have decimals yet, use Solana default (9) for amount conversion
        // We'll get the correct decimals from the quote response
        const tempTokenInDecimals = tokenInDecimals || 9;
        const tempTokenOutDecimals = tokenOutDecimals || 9;

        // Convert amount to base units (lamports for SOL, smallest unit for tokens)
        let amountInBase = toWei(amountIn, tempTokenInDecimals);

        // Get userAddress from request body first
        // CRITICAL: If user is trying to use max balance, verify against on-chain balance
        // This prevents "Insufficient funds" errors from Jupiter/Raydium
        if (userAddress && typeof userAddress === 'string' && userAddress.length > 0) {
            try {
                const { Connection, PublicKey } = await import('@solana/web3.js');
                const connection = new Connection(
                    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
                    'confirmed'
                );

                const userPubkey = new PublicKey(userAddress);
                let onChainBalance = 0n;
                let solBalance = 0n;

                // Always check SOL balance for transaction fees
                solBalance = BigInt(await connection.getBalance(userPubkey));

                // Check if it's native SOL or SPL token
                if (normalizedTokenIn === 'So11111111111111111111111111111111111111112') {
                    // Native SOL balance
                    onChainBalance = solBalance;
                } else {
                    // SPL token balance
                    try {
                        const { getAssociatedTokenAddress, getTokenAccountAmount } = await import('../utils/solanaToken.js');
                        const tokenMint = new PublicKey(normalizedTokenIn);
                        const ata = getAssociatedTokenAddress(tokenMint, userPubkey);
                        onChainBalance = await getTokenAccountAmount(connection, ata);
                    } catch (ataError) {
                        console.warn('[handleSolanaQuote] Could not fetch SPL token balance:', ataError);
                    }

                    // CRITICAL: Check if user has enough SOL for transaction fees
                    // Minimum required: 0.005 SOL (covers tx fee + potential new token account rent)
                    const minSolRequired = 5000000n; // 0.005 SOL in lamports
                    if (solBalance < minSolRequired) {
                        throw new AppError(
                            400,
                            `Insufficient SOL for transaction fees. You need at least 0.005 SOL in your wallet to swap SPL tokens. Current SOL balance: ${(Number(solBalance) / 1e9).toFixed(6)} SOL`,
                            'INSUFFICIENT_SOL_FOR_FEES'
                        );
                    }
                }

                const requestedAmount = BigInt(amountInBase);

                // If requested amount is very close to balance (within 5%), assume user wants max
                // Use balance minus 10 smallest units for 99.99%+ utilization
                const balanceDiff = onChainBalance - requestedAmount;
                const threshold = onChainBalance / 20n; // 5% threshold

                if (balanceDiff >= 0n && balanceDiff <= threshold) {
                    // User is trying to use max balance
                    // Use actual balance minus 10 smallest units (99.99%+ utilization)
                    // Jupiter Legacy API doesn't validate balance, so this should work!
                    const adjustedAmount = onChainBalance - 10n;
                    amountInBase = adjustedAmount.toString();

                    console.log('[handleSolanaQuote] Adjusted amount to on-chain balance:', {
                        requested: requestedAmount.toString(),
                        onChain: onChainBalance.toString(),
                        adjusted: amountInBase,
                        utilization: `${(Number(adjustedAmount) / Number(onChainBalance) * 100).toFixed(4)}%`
                    });
                }
            } catch (balanceError) {
                console.warn('[handleSolanaQuote] Error checking on-chain balance:', balanceError);
                // Continue with original amount if balance check fails
            }
        }

        // Validate amount is greater than 0
        const amountInBaseBigInt = BigInt(amountInBase || '0');
        if (amountInBaseBigInt === 0n) {
            throw new AppError(
                400,
                `Invalid amount: ${amountIn}. Amount must be greater than 0.`,
                'INVALID_AMOUNT'
            );
        }

        // Get Solana quote (with optional aggregator selection)
        console.log('[handleSolanaQuote] Request body userAddress:', userAddress);
        console.log('[handleSolanaQuote] userAddress type:', typeof userAddress);
        console.log('[handleSolanaQuote] userAddress length:', userAddress?.length);

        const quote = await getSolanaQuote(
            normalizedTokenIn,
            normalizedTokenOut,
            amountInBase,
            slippageBps,
            aggregator as 'jupiter' | 'raydium' | 'auto' | undefined,
            // Only pass userAddress if it's a valid non-empty string
            userAddress && typeof userAddress === 'string' && userAddress.length > 0 ? userAddress : undefined
        );

        if (!quote) {
            throw new AppError(
                400,
                `Unable to get quote for ${normalizedTokenIn} -> ${normalizedTokenOut} on Solana. This may be due to insufficient liquidity or the token pair not being supported.`,
                'QUOTE_ERROR'
            );
        }

        // CRITICAL FIX: If we don't have decimals from metadata, try to extract from quote
        // Jupiter Ultra API may include token info in the response
        if (!tokenInDecimals || !tokenOutDecimals) {
            console.warn('[handleSolanaQuote] Missing decimals, attempting to extract from quote or use chain data');

            // For common tokens, use known decimals
            const KNOWN_DECIMALS: Record<string, number> = {
                'So11111111111111111111111111111111111111112': 9, // SOL
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
            };

            if (!tokenInDecimals) {
                tokenInDecimals = KNOWN_DECIMALS[normalizedTokenIn] || tempTokenInDecimals;
                console.log(`[handleSolanaQuote] Using ${tokenInDecimals} decimals for tokenIn (fallback)`);
            }

            if (!tokenOutDecimals) {
                tokenOutDecimals = KNOWN_DECIMALS[normalizedTokenOut];

                // If still no decimals, try to infer from the quote amounts
                // This is a heuristic: if outAmount is much larger than expected, decimals might be lower
                if (!tokenOutDecimals) {
                    const outAmountBigInt = BigInt(quote.outAmount);
                    const inAmountBigInt = BigInt(quote.inAmount);

                    // Estimate decimals based on amount ratio
                    // This is not perfect but better than using wrong decimals
                    const ratio = Number(outAmountBigInt) / Number(inAmountBigInt);

                    // If ratio suggests the amounts are in similar magnitude, use same decimals
                    if (ratio > 0.1 && ratio < 10) {
                        tokenOutDecimals = tokenInDecimals || 9;
                    } else {
                        // Default to 6 for unknown tokens (common for SPL tokens)
                        tokenOutDecimals = 6;
                    }

                    console.warn(`[handleSolanaQuote] Estimated ${tokenOutDecimals} decimals for tokenOut based on quote ratio`);
                }
            }
        }

        // Parse price impact
        const priceImpact = parseFloat(quote.priceImpact || '0');

        // Convert output amount to human-readable format using CORRECT decimals
        const outAmountHuman = parseFloat(quote.outAmount) / Math.pow(10, tokenOutDecimals);

        console.log('[handleSolanaQuote] Final calculation:', {
            outAmountBase: quote.outAmount,
            tokenOutDecimals,
            outAmountHuman,
            calculation: `${quote.outAmount} / 10^${tokenOutDecimals} = ${outAmountHuman}`,
        });

        const data = {
            dex: quote.aggregator,
            dexName: quote.aggregator,
            amountOut: outAmountHuman.toString(),
            amountOutBase: quote.outAmount,
            gasEstimate: 0.000005, // Solana transaction fee is very low (~0.000005 SOL)
            priceImpact,
            path: [normalizedTokenIn, normalizedTokenOut],
            router: quote.aggregator,
            deadline: Math.floor(Date.now() / 1000) + 600,
            // Solana-specific fields
            swapTransaction: quote.swapTransaction,
            routePlan: quote.routePlan,
            chainId: 900,
        };

        if (reply.sent) {
            console.warn('[handleSolanaQuote] Reply already sent, skipping send');
            return;
        }

        return reply.send({
            success: true,
            data,
            quotes: [data],
        });
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw handleExternalApiError(error as Error, 'Solana Swap');
    }
}

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
import { getTransactionReceipt, callRpc } from '../services/rpcManager.js';
import prisma from '../db/prisma.js';
import { trackSwap } from '../services/userActivityService.js';
// REMOVED: import { runJudgeEngine } from '../services/judge/judgeEngine.js';
// Judge Engine should ONLY be used in Copy Trade, not in regular swaps

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
// ========== SWAP CONFIGURATION ==========
// 🚀 PERFORMANCE CRITICAL: Reduced from 30s to 5s
// Transaction broadcast is what matters - confirmation can happen async
// User gets instant feedback, card displays immediately
const SWAP_CONFIRMATION_TIMEOUT_MS = 5000; // 5 seconds (was 30s - too slow!)
const SWAP_CONFIRMATION_POLL_INTERVAL_MS = 1000; // Poll every 1 second (was 2s)
const SWAP_MAX_RETRIES = 2; // Maximum number of retry attempts

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

// Cleanup function removed as we use DB now

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

            // Resolve symbols to addresses for EVM (e.g., ETH, USDC)
            const resolvedTokenInInput = resolveTokenAddress(tokenIn, validatedChainId);
            const resolvedTokenOutInput = resolveTokenAddress(tokenOut, validatedChainId);

            // 验证地址格式（如果不是原生代币）- only for EVM chains
            if (!isNativeToken(resolvedTokenInInput)) {
                validateAddress(resolvedTokenInInput, 'tokenIn');
            }
            if (!isNativeToken(resolvedTokenOutInput)) {
                validateAddress(resolvedTokenOutInput, 'tokenOut');
            }

            // Normalize native token address to 0xEeee... format for 0x API permit2 endpoint
            // The 0x permit2 endpoint expects 0xEeee... for native ETH, not WETH
            const actualTokenIn = normalizeTokenAddress(resolvedTokenInInput);
            const actualTokenOut = normalizeTokenAddress(resolvedTokenOutInput);

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
                const tokenInLower = actualTokenIn.toLowerCase();
                const tokenOutLower = actualTokenOut.toLowerCase();

                if (validation.invalid.includes(tokenInLower)) {
                    throw new AppError(
                        400,
                        `Invalid tokenIn address for chain ${validatedChainId}: ${actualTokenIn} is not supported on this chain. This may cause incorrect token transfers.`,
                        'INVALID_TOKEN_ADDRESS'
                    );
                }
                if (validation.invalid.includes(tokenOutLower)) {
                    throw new AppError(
                        400,
                        `Invalid tokenOut address for chain ${validatedChainId}: ${actualTokenOut} is not supported on this chain. This may cause incorrect token transfers.`,
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
                tokenIn: actualTokenIn,
                tokenOut: actualTokenOut,
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
        {
            preHandler: requireAuth,
            // CRITICAL: Swap execution can take 60-90s (approval + swap confirmation)
            // Set timeout to 150s to prevent socket closure during transaction
            config: {
                // requestTimeout removed - not supported in FastifyContextConfig
            }
        },
        async (req: any, res: any) => {
            const request = req;
            const reply = res;
            try {
                // Import Privy wallet service dynamically to avoid startup errors if not configured
                const { sendTransaction, isPrivyConfigured, getEmbeddedWalletAddress } = await import('../services/privyWallet.js');

                if (!isPrivyConfigured()) {
                    throw new AppError(503, 'Instant trading not configured. Set PRIVY_APP_SECRET.', 'NOT_CONFIGURED');
                }

                const { tokenIn: rawTokenIn, tokenOut: rawTokenOut, amountIn, chainId, slippageBps = 50, messageId } = request.body;

                // Extract messageId from header if provided (for WebSocket updates)
                const transactionMessageId = messageId || request.headers['x-transaction-message-id'];

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
                const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

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
                    // For native tokens, leave a small gas buffer to prevent insufficient gas
                    const isL2 = validatedChainId === 8453 || validatedChainId === 42161 || validatedChainId === 10;
                    const gasBuffer = isL2 ? 0.0001 : 0.001;
                    const maxSpendable = Math.max(walletBalance.ethBalanceFormatted - gasBuffer, 0);
                    resolvedAmountIn = maxSpendable.toString();
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
                    // Helper function to resolve Solana token symbols to Mint addresses
                    const resolveSolanaTokenAddress = (symbolOrAddress: string): string => {
                        // If it's already a valid Solana address (base58, 32-44 chars), return it
                        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(symbolOrAddress)) {
                            return symbolOrAddress;
                        }

                        // Common Solana token addresses
                        const SOLANA_TOKENS: Record<string, string> = {
                            'SOL': 'So11111111111111111111111111111111111111112', // Wrapped SOL
                            'WSOL': 'So11111111111111111111111111111111111111112',
                            'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                            'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
                            'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // Raydium
                            'SRM': 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt', // Serum
                            'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk
                        };

                        const upperSymbol = symbolOrAddress.toUpperCase();
                        return SOLANA_TOKENS[upperSymbol] || symbolOrAddress;
                    };

                    // Resolve token symbols to addresses
                    const resolvedTokenIn = resolveSolanaTokenAddress(tokenIn);
                    const resolvedTokenOut = resolveSolanaTokenAddress(tokenOut);
                    const usdcMint = normalizeSolanaTokenAddress('USDC');
                    const usdtMint = normalizeSolanaTokenAddress('USDT');
                    const solMint = normalizeSolanaTokenAddress('SOL');

                    console.log('[Swap Execute Instant] Resolved Solana tokens:', {
                        tokenInOriginal: tokenIn,
                        tokenInResolved: resolvedTokenIn,
                        tokenOutOriginal: tokenOut,
                        tokenOutResolved: resolvedTokenOut,
                    });

                    // Import launchpad service
                    const { solanaLaunchpadSwapService } = await import('../services/solanaLaunchpadSwapService.js');
                    const { findTokenOnAnyChain } = await import('../services/ai/tokenDetector.js');
                    const { getSolanaTokenMetadata } = await import('../utils/solanaToken.js');

                    const tokenInMetadata = await getSolanaTokenMetadata(resolvedTokenIn);
                    const tokenInDecimals = tokenInMetadata?.decimals || 9;
                    const amountInAtomic = toWei(resolvedAmountIn, tokenInDecimals);

                    const isStableOut = resolvedTokenOut === usdcMint || resolvedTokenOut === usdtMint;
                    const isNativeOut = resolvedTokenOut === solMint;

                    // REMOVED: Judge Engine should ONLY run for Copy Trade, NOT for regular swaps
                    // Judge Engine with Grok costs money and should only be used when:
                    // 1. User is copy trading (following smart wallets)
                    // 2. User has explicitly enabled copy trade AI analysis
                    // For regular chat swaps (including Solana), we skip Judge entirely to save costs
                    console.log('[Swap Execute Instant] Solana swap - Judge engine skipped (only runs for copy trade)');

                    // Detect launchpad provider (use resolved address)
                    const tokenInfo = await findTokenOnAnyChain(resolvedTokenOut);
                    const launchpadProvider = tokenInfo?.launchpad?.provider || null;

                    console.log('[Swap Execute Instant] Solana token launchpad:', launchpadProvider);

                    if (launchpadProvider === 'pumpfun' || launchpadProvider === 'bonkfun') {
                        const txHash = await solanaLaunchpadSwapService.fastSwap({
                            userId,
                            mint: resolvedTokenOut,
                            amount: resolvedAmountIn,
                            isBuy: true, // For Solana instant swap, we assume buy (SOL -> token)
                            provider: launchpadProvider === 'pumpfun' ? 'pumpfun' : 'bonkfun',
                            slippageBps,
                            feeContext: 'swap',
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
                    // Get metadata for BOTH tokens to determine decimals (use resolved addresses)
                    const tokenOutMetadata = await getSolanaTokenMetadata(resolvedTokenOut);
                    const tokenOutDecimals = tokenOutMetadata?.decimals || 9;

                    console.log('[Swap Execute Instant] Token metadata:', {
                        tokenIn: resolvedTokenIn,
                        tokenInDecimals,
                        tokenOut: resolvedTokenOut,
                        tokenOutDecimals,
                    });

                    // Convert amount to atomic units using the INPUT token's decimals
                    const txHash = await executeSolanaSwap({
                        userId,
                        tokenInMint: resolvedTokenIn, // Use resolved address
                        tokenOutMint: resolvedTokenOut, // Use resolved address
                        amountIn: amountInAtomic,
                        slippageBps,
                        feeContext: 'swap',
                        accessToken,
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
                    try {
                        // ERC20 balanceOf(address) selector: 0x70a08231
                        const ownerPadded = walletAddress.slice(2).toLowerCase().padStart(64, '0');
                        const balanceOfData = `0x70a08231${ownerPadded}`;

                        const balanceResult = await callRpc<string>(validatedChainId, 'eth_call', [
                            { to: actualTokenIn, data: balanceOfData },
                            'latest',
                        ]);
                        const onChainBalanceWei = BigInt(balanceResult || '0x0');

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
                // ========== END BALANCE VERIFICATION ==========

                // Convert amount to base units (use resolved amount which handles 'all')
                let sellAmount = toWei(resolvedAmountIn, tokenInDecimals);

                // Platform fee handled inside MainSwapService/SwapExecutor

                // Fetch USD reference prices for market comparison (needed for Price Impact)
                const [tokenInUsd, tokenOutUsd] = await Promise.all([
                    getTokenPriceUSD(actualTokenIn, validatedChainId),
                    getTokenPriceUSD(actualTokenOut, validatedChainId),
                ]);
                // refPrice = tokenInUsd / tokenOutUsd = how many tokenOut units per 1 tokenIn (based on USD)
                const refPrice = (tokenInUsd && tokenOutUsd && tokenInUsd > 0 && tokenOutUsd > 0)
                    ? (tokenInUsd / tokenOutUsd)
                    : null;

                const isNativeTokenIn = actualTokenIn.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
                const isNativeTokenOut = actualTokenOut.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

                // REMOVED: Judge Engine should ONLY run for Copy Trade, NOT for regular swaps
                // Judge Engine with Grok costs money and should only be used when:
                // 1. User is copy trading (following smart wallets)
                // 2. User has explicitly enabled copy trade AI analysis
                // For regular chat swaps, we skip Judge entirely to save costs
                console.log('[Swap Execute Instant] Judge engine skipped - only runs for copy trade');

                // =================================================================
                // ⚡ UNIFIED SWAP EXECUTION via MainSwapService
                // =================================================================

                // Import MainSwapService - unified entry point for all swaps
                const { MainSwapService } = await import('../services/MainSwapService.js');

                // Use MainSwapService for consistent routing and logging
                const swapResult = await MainSwapService.executeSwap({
                    userId,
                    walletAddress,
                    accessToken,
                    tokenIn: actualTokenIn,
                    tokenOut: actualTokenOut,
                    amountIn: resolvedAmountIn, // Human readable
                    chainId: validatedChainId,
                    slippageBps,
                    mode: 'swap-card', // Indicates UI-triggered swap
                    messageId: transactionMessageId as string, // For WebSocket updates during retry
                    userSettings: {
                        swapMethod: 'wallet_sign',
                        mevProtection: false
                    }
                });

                if (!swapResult.success) {
                    throw new AppError(500, swapResult.error || 'Swap execution failed', 'SWAP_FAILED');
                }

                // Compatible response for downstream logic
                const txHash = swapResult.txHash!;
                // Record trade in DB
                const tradeRecord = await prisma.swapHistory.create({
                    data: {
                        user: { connect: { privyDid: userId } },

                        tokenInAddress: tokenIn,
                        tokenInSymbol: tokenInMetadata?.symbol || tokenIn.slice(0, 6).toUpperCase(),
                        tokenInAmount: resolvedAmountIn,
                        tokenInUsd: tokenInUsd ? parseFloat(amountIn) * tokenInUsd : 0,

                        tokenOutAddress: tokenOut,
                        tokenOutSymbol: tokenOutMetadata?.symbol || tokenOut.slice(0, 6).toUpperCase(),
                        tokenOutAmount: swapResult.amountOut || null,
                        tokenOutUsd: tokenOutUsd && swapResult.amountOut
                            ? (parseFloat(swapResult.amountOut) * tokenOutUsd)
                            : 0,

                        chainId: validatedChainId,
                        txHash,
                        status: 'success',
                        source: 'fast_swap',
                        slippageBps: slippageBps,
                        confirmedAt: new Date()
                    }
                });


                // Track User Activity
                const volumeUsd = tradeRecord.tokenInUsd || 0;
                trackSwap(tradeRecord.userId, volumeUsd);

                return reply.send({
                    success: true,
                    data: {
                        txHash,
                        tradeId: tradeRecord.id,
                        status: 'SUCCESS',
                        amountOut: swapResult.amountOut || null,
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
            // Create trade record in DB
            const tradeRecord = await prisma.swapHistory.create({
                data: {
                    user: { connect: { walletAddress: userAddress } },

                    tokenInAddress: tokenIn,
                    tokenInSymbol: 'UNKNOWN',
                    tokenInAmount: amountIn,

                    tokenOutAddress: tokenOut,
                    tokenOutSymbol: 'UNKNOWN',

                    chainId: chainId,
                    status: 'pending',
                    source: 'manual',
                }
            });

            const tradeId = tradeRecord.id;

            // We don't use memory map anymore.
            // tradeHistory.set(...)
            // pendingTransactions.set(...)

            // Cleanup removed

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

            // Fetch from DB
            const trade = await prisma.swapHistory.findUnique({
                where: { id: tradeId }
            });

            if (!trade) {
                return reply.status(404).send({
                    success: false,
                    error: 'Trade not found',
                });
            }

            // Map to response format
            return reply.send({
                success: true,
                data: {
                    id: trade.id,
                    userAddress: 'HIDDEN', // We might not have it easily without include
                    tokenIn: trade.tokenInAddress,
                    tokenOut: trade.tokenOutAddress,
                    amountIn: trade.tokenInAmount,
                    chainId: trade.chainId,
                    status: trade.status.toUpperCase(), // PENDING, SUCCESS
                    txHash: trade.txHash,
                    createdAt: trade.createdAt.getTime(),
                },
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

            // Fetch from DB
            const limitNum = Math.min(parseInt(limit as string) || 20, 100);
            const offsetNum = parseInt(offset as string) || 0;

            // Find user first if address provided
            let whereClause = {};
            if (userAddress) {
                const user = await prisma.user.findUnique({ where: { walletAddress: userAddress as string } });
                if (user) {
                    whereClause = { userId: user.id };
                } else {
                    // User not found by address, return empty
                    return reply.send({
                        success: true,
                        data: {
                            trades: [],
                            total: 0,
                            limit: limitNum,
                            offset: offsetNum,
                        },
                    });
                }
            }

            const [trades, total] = await prisma.$transaction([
                prisma.swapHistory.findMany({
                    where: whereClause,
                    orderBy: { createdAt: 'desc' },
                    take: limitNum,
                    skip: offsetNum
                }),
                prisma.swapHistory.count({ where: whereClause })
            ]);

            // Map to TradeRecord format
            const mappedTrades = trades.map(t => ({
                id: t.id,
                userAddress: userAddress || '', // We inferred it
                tokenIn: t.tokenInAddress,
                tokenOut: t.tokenOutAddress,
                amountIn: t.tokenInAmount,
                amountOut: t.tokenOutAmount || undefined,
                chainId: t.chainId,
                txHash: t.txHash || undefined,
                status: t.status.toUpperCase(),
                createdAt: t.createdAt.getTime(),
                completedAt: t.confirmedAt?.getTime(),
                error: t.failureReason || undefined
            }));

            return reply.send({
                success: true,
                data: {
                    trades: mappedTrades,
                    total: total,
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
            spender?: string;
        }
    }>('/approval-status', async (request, reply) => {
        try {
            const { userAddress, tokenAddress, requiredAmount, chainId, spender } = request.body;

            if (!userAddress || !tokenAddress || !requiredAmount || !chainId) {
                return reply.status(400).send({
                    success: false,
                    error: 'userAddress, tokenAddress, requiredAmount, and chainId are required',
                });
            }

            // Cleanup removed
            // 验证地址格式
            validateAddress(userAddress, 'userAddress');
            validateAddress(tokenAddress, 'tokenAddress');
            validateAmount(requiredAmount);
            validateChainId(chainId);

            // Real allowance check via RPC
            // Normalize native tokens: no approval needed
            if (isNativeToken(tokenAddress)) {
                return reply.send({
                    success: true,
                    data: {
                        isApproved: true,
                        userAddress,
                        tokenAddress,
                        chainId,
                        message: 'Native token does not require approval',
                    },
                });
            }

            // ERC20 allowance(owner, spender)
            // spender must be provided as allowanceTarget in quote; if not, we cannot check
            if (!spender) {
                return reply.status(400).send({
                    success: false,
                    error: 'spender is required for allowance check',
                });
            }
            validateAddress(spender, 'spender');

            // Resolve decimals for requiredAmount (human-readable)
            let decimals = getKnownTokenDecimals(tokenAddress, chainId);
            if (decimals === undefined) {
                const metadata = await getZeroExTokenMetadata(tokenAddress, chainId);
                decimals = metadata?.decimals ?? 18;
            }

            const ownerPadded = userAddress.slice(2).toLowerCase().padStart(64, '0');
            const spenderPadded = spender.slice(2).toLowerCase().padStart(64, '0');
            const allowanceData = `0xdd62ed3e${ownerPadded}${spenderPadded}`; // allowance(address,address)

            const allowanceResult = await callRpc<string>(chainId, 'eth_call', [
                { to: tokenAddress, data: allowanceData },
                'latest',
            ]);
            const allowanceWei = BigInt(allowanceResult || '0x0');
            const requiredWei = BigInt(toWei(requiredAmount, decimals));
            const isApproved = allowanceWei >= requiredWei;

            return reply.send({
                success: true,
                data: {
                    isApproved,
                    userAddress,
                    tokenAddress,
                    chainId,
                    message: 'Approval check results (Needs integration with chain provider)',
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

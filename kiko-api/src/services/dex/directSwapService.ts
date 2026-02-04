/**
 * Direct Swap Service - 直接与 Uniswap V3/V4 池子交互
 * 
 * [Logic]: 绕过 0x/Kyber 聚合器，直接与链上池子交互
 * [Ref]: 仅在 fastSwapMode 时使用
 * 
 * 功能：
 * - 自动检测最佳池子版本 (V3/V4)
 * - 获取代币流动性和市值
 * - 执行直接交易
 */

import { ethers } from 'ethers';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { findTokenPools, PoolInfo } from './poolInfo.js';
import { calculatePriceFromSqrtX96, findV4Pools, V4PoolKey } from './uniswapV4.js';
import { buildV4SwapTransaction, isV4SwapSupported } from './uniswapV4Swap.js';
import { calculateV3TVL } from './v3Math.js';
import { callRpc } from '../rpcManager.js';
import { sendTransaction } from '../privyWallet.js';
import { getZeroExPrice } from '../zeroEx.js';
import { getKyberQuote } from '../kyberAggregator.js';
import { getTokenDetails } from '../geckoTerminal.js';
import { getTokenMetadata } from '../rpcService.js';
import { get as getDbCache } from '../../cache/dbCache.js';
import { V2_ROUTER_ABI, V3_FEE_TIERS } from './types.js';
import { buildAerodromeSwapTransaction, getAerodromeQuote } from './aerodrome.js';

// 常用代币地址
const WETH_ADDRESSES: Record<number, string> = {
    8453: '0x4200000000000000000000000000000000000006', // Base
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',    // Ethereum
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',  // BSC (WBNB)
};

const USDC_ADDRESSES: Record<number, string> = {
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum
};

// V3 QuoterV2 addresses (on-chain quote)
const V3_QUOTER_V2: Record<number, string> = {
    1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
};

const v3QuoterInterface = new ethers.Interface([
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);

const v2RouterInterface = new ethers.Interface(V2_ROUTER_ABI);
const infinityQuoterInterface = new ethers.Interface([
    'function quoteExactInputSingle((tuple(address currency0,address currency1,address hooks,address poolManager,uint24 fee,bytes32 parameters),bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)'
]);
const infinityRouterInterface = new ethers.Interface([
    'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable'
]);

const V2_ROUTERS: Record<number, string> = {
    1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',   // Uniswap V2
    8453: '0x4752ba5Dbc23f44D87826276BF6Fd6b1C372aD24', // Uniswap V2 on Base
    56: '0x10ED43C718714eb63d5aA57B78B54704E256024E'    // PancakeSwap V2
};

// PancakeSwap V3 (BSC)
const PANCAKE_V3_ROUTER = '0x1b81D678ffb9C0263b24A97847620C99d213eB14';
const PANCAKE_V3_QUOTER = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';
const PANCAKE_V3_FEE_TIERS = [100, 500, 2500, 10000] as const;

// Pancake Infinity (BSC)
const PANCAKE_INFINITY_ROUTER = '0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB';
const PANCAKE_INFINITY_CL_POOL_MANAGER = '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b';
const PANCAKE_INFINITY_BIN_POOL_MANAGER = '0xC697d2898e0D09264376196696c51D7aBbbAA4a9';
const PANCAKE_INFINITY_CL_QUOTER = '0xd0737C9762912dD34c3271197E362Aa736Df0926';
const PANCAKE_INFINITY_BIN_QUOTER = '0xC631f4B0Fc2Dd68AD45f74B2942628db117dD359';

const INFINITY_CL_FEE_TIERS = [100, 500, 2500, 10000] as const;
const INFINITY_CL_TICK_SPACING_BY_FEE: Record<number, number> = {
    100: 1,
    500: 10,
    2500: 50,
    10000: 200
};
const INFINITY_BIN_STEPS = [1, 5, 10, 20, 25, 50, 100] as const;
const INFINITY_HOOKS_ZERO = '0x0000000000000000000000000000000000000000';

const REFERENCE_DEVIATION_BPS = Number(process.env.DIRECT_SWAP_REF_DEVIATION_BPS || '1500');
const V4_SPOT_CACHE_TTL_MS = Number(process.env.V4_SPOT_CACHE_TTL_MS || '15000');
const REFERENCE_QUOTE_TTL_MS = Number(process.env.DIRECT_SWAP_REF_CACHE_TTL_MS || '10000');
const REFERENCE_QUOTE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_REF_TIMEOUT_MS || '2000');
const V4_FAST_PATH = (process.env.DIRECT_SWAP_V4_FAST_PATH || 'true') === 'true';

const v4SpotCache = new Map<string, { value: bigint; timestamp: number }>();
const referenceQuoteCache = new Map<string, { value: bigint; timestamp: number }>();
const infinityPairCache = new Map<string, { poolKeys: InfinityPoolKey[]; timestamp: number }>();

type DexFamily = 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
type StrategyKind = 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity';

interface DexStrategy {
    kind: StrategyKind;
    dex?: DexFamily;
}

const CHAIN_STRATEGIES: Record<number, DexStrategy[]> = {
    8453: [
        { kind: 'v4', dex: 'uniswap' },
        { kind: 'v3', dex: 'uniswap' },
        { kind: 'aerodrome', dex: 'aerodrome' },
        { kind: 'v2', dex: 'uniswap' }
    ],
    56: [
        { kind: 'v3', dex: 'pancake' },
        { kind: 'infinity', dex: 'pancake-infinity' },
        { kind: 'v2', dex: 'pancake' }
    ],
    1: [
        { kind: 'v3', dex: 'uniswap' },
        { kind: 'v2', dex: 'uniswap' },
        { kind: 'v4', dex: 'uniswap' }
    ]
};

function pickBestPool(pools: PoolInfo[], version: PoolInfo['version'], dex?: DexFamily): PoolInfo | null {
    const candidates = pools.filter(p => p.version === version && (!dex || p.dex === dex));
    if (!candidates.length) return null;
    if (version === 'v2') {
        return candidates.sort((a, b) => {
            const aReserve = BigInt(a.reserve0 || '0') + BigInt(a.reserve1 || '0');
            const bReserve = BigInt(b.reserve0 || '0') + BigInt(b.reserve1 || '0');
            return bReserve > aReserve ? 1 : -1;
        })[0];
    }
    return candidates.sort((a, b) => {
        const aLiq = BigInt(a.liquidity || '0');
        const bLiq = BigInt(b.liquidity || '0');
        return bLiq > aLiq ? 1 : -1;
    })[0];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
        promise.then(val => {
            clearTimeout(timer);
            resolve(val);
        }).catch(err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

// ETH 价格 (临时硬编码，生产环境应从预言机获取)
const ETH_PRICE_USD = 2400;

/**
 * 直接交易结果
 */
export interface DirectSwapResult {
    success: boolean;
    txHash?: string;
    amountOut?: string;
    error?: string;
    provider: 'uniswap-v2' | 'pancake-v2' | 'uniswap-v3' | 'pancake-v3' | 'uniswap-v4' | 'pancake-infinity' | 'aerodrome' | 'failed';
    poolInfo?: {
        version: string;
        fee: number;
        liquidity: string;
    };
}

/**
 * 代币流动性信息
 */
export interface TokenLiquidity {
    totalTvlUsd: number;
    pools: {
        version: string;
        fee: number;
        tvlUsd: number;
        address: string;
    }[];
}

/**
 * 获取代币的流动性信息
 * [Logic]: 查询所有 V2/V3/V4 池子并计算 TVL
 */
export async function getTokenLiquidity(
    tokenAddress: string,
    chainId: number
): Promise<TokenLiquidity> {
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) {
        return { totalTvlUsd: 0, pools: [] };
    }

    try {
        const pools = await findTokenPools(tokenAddress, weth, chainId);
        const result: TokenLiquidity = { totalTvlUsd: 0, pools: [] };

        for (const pool of pools) {
            let tvlUsd = 0;

            // 计算 TVL
            if (pool.liquidity && pool.sqrtPriceX96) {
                const isToken0 = pool.token0.toLowerCase() === tokenAddress.toLowerCase();
                const decimals0 = pool.token0Decimals || 18;
                const decimals1 = pool.token1Decimals || 18;

                // WETH 价格
                const price0USD = isToken0 ? 0 : ETH_PRICE_USD;
                const price1USD = isToken0 ? ETH_PRICE_USD : 0;

                tvlUsd = calculateV3TVL(
                    BigInt(pool.sqrtPriceX96),
                    BigInt(pool.liquidity),
                    decimals0,
                    decimals1,
                    price0USD,
                    price1USD
                );
            }

            result.pools.push({
                version: pool.version || 'v3',
                fee: pool.fee || 0,
                tvlUsd,
                address: pool.poolAddress
            });
            result.totalTvlUsd += tvlUsd;
        }

        return result;
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to get token liquidity', {
            token: tokenAddress,
            error: error.message
        });
        return { totalTvlUsd: 0, pools: [] };
    }
}

/**
 * 查找最佳池子
 * [Logic]: 优先选择流动性最高的池子
 */
async function findBestPool(
    tokenIn: string,
    tokenOut: string,
    chainId: number
): Promise<PoolInfo | null> {
    // [Logic]: ETH 地址转换为 WETH，因为池子只认识 WETH
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];

    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase() ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase() ? weth : tokenOut;

    if (!normalizedIn || !normalizedOut) {
        return null;
    }

    const pools = await findTokenPools(normalizedIn, normalizedOut, chainId);

    if (pools.length === 0) {
        return null;
    }

    // 按流动性排序，优先选择 V4
    const sorted = pools.sort((a, b) => {
        // V4 优先
        if (a.version === 'v4' && b.version !== 'v4') return -1;
        if (a.version !== 'v4' && b.version === 'v4') return 1;

        // 按流动性排序
        const liqA = BigInt(a.liquidity || '0');
        const liqB = BigInt(b.liquidity || '0');
        return liqB > liqA ? 1 : -1;
    });

    return sorted[0];
}

/**
 * 执行直接交易
 * [Logic]: 根据池子版本选择 V3 或 V4 执行
 */
export async function executeDirectSwap(params: {
    userId: string;
    accessToken: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippageBps: number;
}): Promise<DirectSwapResult> {
    const { userId, accessToken, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps } = params;

    // [Logic]: 规范化 token 地址 - 处理 "ETH" / "WETH" 字符串
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    function normalizeToken(token: string, chainId: number): string {
        const upper = token.toUpperCase();
        if (upper === 'ETH') return ETH_ADDRESS;
        if (upper === 'WETH') return WETH_ADDRESSES[chainId] || token;
        return token;
    }
    const normalizedTokenIn = normalizeToken(tokenIn, chainId);
    const normalizedTokenOut = normalizeToken(tokenOut, chainId);

    logger.info(LogCode.EXE_TX_BROADCAST, '[DirectSwap] Starting direct swap', {
        tokenIn: normalizedTokenIn.slice(0, 12),
        tokenOut: normalizedTokenOut.slice(0, 12),
        amount: amountIn,
        chainId
    });

    const swapStart = Date.now();
    const finish = (result: DirectSwapResult) => {
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Finished', {
            provider: result.provider,
            success: result.success,
            durationMs: Date.now() - swapStart
        });
        return result;
    };

    try {
        const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

        // 1. 查找所有池子 (V2/V3/V4) - ETH 使用 WETH 地址匹配池子
        const weth = WETH_ADDRESSES[chainId];
        const poolTokenIn = normalizedTokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase() && weth
            ? weth
            : normalizedTokenIn;
        const poolTokenOut = normalizedTokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase() && weth
            ? weth
            : normalizedTokenOut;

        const amountInWei = ethers.parseEther(amountIn);

        if (V4_FAST_PATH && isV4SwapSupported(chainId)) {
            const fastStart = Date.now();
            const [v4Best, referenceQuote] = await Promise.all([
                getV4BestPoolQuote(poolTokenIn, poolTokenOut, amountInWei, chainId),
                getReferenceExpectedOutput(normalizedTokenIn, normalizedTokenOut, amountInWei, chainId, params.slippageBps, params.walletAddress)
            ]);

            logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V4 fast path quote check', {
                v4Quote: v4Best.amountOut.toString().slice(0, 15),
                referenceQuote: referenceQuote.toString().slice(0, 15),
                durationMs: Date.now() - fastStart
            });

            if (v4Best.pool && v4Best.amountOut > 0n && referenceQuote > 0n) {
                const deviationBps = Math.min(Math.max(REFERENCE_DEVIATION_BPS, 0), 5000);
                const minReasonable = referenceQuote * BigInt(10000 - deviationBps) / 10000n;
                if (v4Best.amountOut >= minReasonable) {
                    const normalizedParams = {
                        ...params,
                        tokenIn: normalizedTokenIn,
                        tokenOut: normalizedTokenOut
                    };
                    logger.info(LogCode.SYS_INFO, '[DirectSwap] V4 fast path accepted', {
                        minReasonable: minReasonable.toString().slice(0, 15)
                    });
                    return finish(await executeV4Swap(normalizedParams, v4Best.pool));
                }
            }

            logger.info(LogCode.SYS_INFO, '[DirectSwap] V4 fast path fallback', {
                reason: v4Best.amountOut <= 0n ? 'v4_quote_unavailable'
                    : referenceQuote <= 0n ? 'reference_quote_unavailable'
                        : 'v4_quote_not_reasonable'
            });
        }

        const poolStart = Date.now();
        const pools = await findTokenPools(poolTokenIn, poolTokenOut, chainId);
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Pool discovery complete', {
            poolCount: pools.length,
            durationMs: Date.now() - poolStart
        });

        if (pools.length === 0) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] No pool found for token pair', {
                tokenIn: tokenIn.slice(0, 12),
                tokenOut: tokenOut.slice(0, 12),
                chainId
            });
            return finish({
                success: false,
                error: 'No pool found for token pair',
                provider: 'failed'
            });
        }

        const normalizedParams = {
            ...params,
            tokenIn: normalizedTokenIn,
            tokenOut: normalizedTokenOut
        };

        const referenceQuote = await getReferenceExpectedOutput(
            normalizedTokenIn,
            normalizedTokenOut,
            amountInWei,
            chainId,
            params.slippageBps,
            params.walletAddress
        );

        if (referenceQuote <= 0n) {
            return finish({ success: false, error: 'No valid reference price (0x/Kyber/Gecko)', provider: 'failed' });
        }

        const deviationBps = Math.min(Math.max(REFERENCE_DEVIATION_BPS, 0), 5000);
        const minReasonable = referenceQuote * BigInt(10000 - deviationBps) / 10000n;
        const strategies = CHAIN_STRATEGIES[chainId] || CHAIN_STRATEGIES[1];

        for (const strategy of strategies) {
            if (strategy.kind === 'infinity') {
                if (chainId !== 56) continue;
                const infinityQuote = await getInfinityBestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId);
                if (infinityQuote && infinityQuote.amountOut >= minReasonable) {
                    return finish(await executeInfinitySwap(normalizedParams, infinityQuote));
                }
                continue;
            }

            if (strategy.kind === 'v4') {
                if (!isV4SwapSupported(chainId)) continue;
                const v4Best = await getV4BestPoolQuote(poolTokenIn, poolTokenOut, amountInWei, chainId);
                if (v4Best.pool && v4Best.amountOut >= minReasonable) {
                    return finish(await executeV4Swap(normalizedParams, v4Best.pool));
                }
                continue;
            }

            if (strategy.kind === 'v3') {
                if (!strategy.dex || (strategy.dex !== 'uniswap' && strategy.dex !== 'pancake')) continue;
                const v3Pool = pickBestPool(pools, 'v3', strategy.dex);
                if (!v3Pool) continue;
                const v3Quote = await getV3BestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId, strategy.dex);
                if (v3Quote >= minReasonable) {
                    return finish(await executeV3Swap(normalizedParams, v3Pool, strategy.dex));
                }
                continue;
            }

            if (strategy.kind === 'aerodrome') {
                if (chainId !== 8453) continue;
                const aeroQuote = await getAerodromeExpectedOutput(
                    normalizedTokenIn,
                    normalizedTokenOut,
                    amountInWei,
                    chainId,
                    params.slippageBps,
                    params.walletAddress
                );
                if (aeroQuote >= minReasonable) {
                    return finish(await executeAerodromeSwap(normalizedParams));
                }
                continue;
            }

            if (strategy.kind === 'v2') {
                const v2Pool = pickBestPool(pools, 'v2', strategy.dex);
                if (!v2Pool) continue;
                const v2Quote = await getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId);
                if (v2Quote >= minReasonable) {
                    return finish(await executeV2Swap(normalizedParams, v2Quote));
                }
                continue;
            }
        }

        return finish({ success: false, error: 'No suitable pool found', provider: 'failed' });
    } catch (error: any) {
        logger.error(LogCode.EXE_TX_REVERTED, '[DirectSwap] Direct swap failed', {
            error: error.message,
            stack: error.stack?.slice(0, 200),
            tokenIn: tokenIn.slice(0, 12),
            tokenOut: tokenOut.slice(0, 12)
        });
        return finish({
            success: false,
            error: error.message,
            provider: 'failed'
        });
    }
}

/**
 * 执行 Aerodrome 交易 (Base)
 */
async function executeAerodromeSwap(
    params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
        slippageBps: number;
    }
): Promise<DirectSwapResult> {
    try {
        const amountInWei = ethers.parseEther(params.amountIn);
        const quoteBuild = await buildAerodromeSwapTransaction({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: amountInWei,
            recipient: params.walletAddress,
            slippageBps: params.slippageBps
        }, params.chainId);

        if (!quoteBuild) {
            return { success: false, error: 'Aerodrome quote not available', provider: 'failed' };
        }

        const { swapTx } = quoteBuild;

        // Gas estimate with buffer
        let gasLimit: string;
        try {
            const estimate = await callRpc<string>(params.chainId, 'eth_estimateGas', [{
                from: params.walletAddress,
                to: swapTx.to,
                data: swapTx.data,
                value: swapTx.value ? ethers.toBeHex(BigInt(swapTx.value)) : '0x0'
            }]);
            const estimatedGas = BigInt(estimate);
            gasLimit = (estimatedGas * 2n).toString();
        } catch {
            gasLimit = '400000';
        }

        const txHash = await sendTransaction(params.userId, params.accessToken, {
            to: swapTx.to,
            data: swapTx.data,
            value: swapTx.value || '0',
            chainId: params.chainId,
            gas: gasLimit
        });

        return {
            success: true,
            txHash,
            provider: 'aerodrome'
        };
    } catch (error: any) {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] Aerodrome swap failed', {
            error: error.message?.slice(0, 120)
        });
        return { success: false, error: error.message, provider: 'failed' };
    }
}

async function getV2ExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<bigint> {
    const router = V2_ROUTERS[chainId];
    if (!router) return 0n;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return 0n;

    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;

    try {
        const callData = v2RouterInterface.encodeFunctionData('getAmountsOut', [amountInWei, [normalizedIn, normalizedOut]]);
        const result = await callRpc<string>(chainId, 'eth_call', [{
            to: router,
            data: callData
        }, 'latest']);
        if (!result || result === '0x') return 0n;
        const decoded = v2RouterInterface.decodeFunctionResult('getAmountsOut', result);
        const amounts = decoded[0] as bigint[];
        return amounts[amounts.length - 1] || 0n;
    } catch {
        return 0n;
    }
}

async function getV3BestQuoteOut(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    dex: 'uniswap' | 'pancake'
): Promise<bigint> {
    const quoter = dex === 'pancake' ? PANCAKE_V3_QUOTER : V3_QUOTER_V2[chainId];
    if (!quoter) return 0n;

    let bestOut = 0n;
    const feeTiers = dex === 'pancake' ? PANCAKE_V3_FEE_TIERS : V3_FEE_TIERS;
    for (const fee of feeTiers) {
        try {
            const quoteParams = {
                tokenIn,
                tokenOut,
                amountIn: amountInWei,
                fee: fee,
                sqrtPriceLimitX96: 0
            };
            const callData = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);
            const result = await callRpc<string>(chainId, 'eth_call', [{
                to: quoter,
                data: callData
            }, 'latest']);
            if (!result || result === '0x') continue;
            const decoded = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
            const amountOut = decoded[0] as bigint;
            if (amountOut > bestOut) bestOut = amountOut;
        } catch {
            continue;
        }
    }
    return bestOut;
}

const INFINITY_COMMANDS = {
    INFI_SWAP: 0x10,
    WRAP_ETH: 0x0b,
    UNWRAP_WETH: 0x0c
};

const INFINITY_ACTIONS = {
    CL_SWAP_EXACT_IN_SINGLE: 0x06,
    BIN_SWAP_EXACT_IN_SINGLE: 0x1c,
    SETTLE: 0x0b,
    SETTLE_ALL: 0x0c,
    TAKE: 0x0e,
    TAKE_ALL: 0x0f
};

const INFINITY_ACTION_CONSTANTS = {
    OPEN_DELTA: 0n,
    CONTRACT_BALANCE: 1n << 255n,
    MSG_SENDER: '0x0000000000000000000000000000000000000001'
};

const MAX_UINT128 = (1n << 128n) - 1n;
const MAX_UINT256 = (1n << 256n) - 1n;

type InfinityPoolKind = 'cl' | 'bin';

interface InfinityPoolKey {
    currency0: string;
    currency1: string;
    hooks: string;
    poolManager: string;
    fee: number;
    parameters: string;
}

interface InfinityBestQuote {
    amountOut: bigint;
    poolKey: InfinityPoolKey;
    zeroForOne: boolean;
    kind: InfinityPoolKind;
    fee: number;
    tickSpacing?: number;
    binStep?: number;
}

function sortCurrencies(tokenIn: string, tokenOut: string): { currency0: string; currency1: string; zeroForOne: boolean } {
    const a = ethers.getAddress(tokenIn);
    const b = ethers.getAddress(tokenOut);
    const aNum = BigInt(a.toLowerCase());
    const bNum = BigInt(b.toLowerCase());
    if (aNum < bNum) {
        return { currency0: a, currency1: b, zeroForOne: a.toLowerCase() === tokenIn.toLowerCase() };
    }
    return { currency0: b, currency1: a, zeroForOne: b.toLowerCase() === tokenIn.toLowerCase() };
}

function encodeInfinityParameters(rawValue: number): string {
    const value = BigInt(rawValue) << 16n;
    return ethers.zeroPadValue(ethers.toBeHex(value), 32);
}

function buildInfinityPoolKey(
    tokenIn: string,
    tokenOut: string,
    poolManager: string,
    fee: number,
    parameters: string
): { poolKey: InfinityPoolKey; zeroForOne: boolean } {
    const { currency0, currency1, zeroForOne } = sortCurrencies(tokenIn, tokenOut);
    return {
        poolKey: {
            currency0,
            currency1,
            hooks: INFINITY_HOOKS_ZERO,
            poolManager,
            fee,
            parameters
        },
        zeroForOne
    };
}

function buildInfinityPairKey(chainId: number, tokenA: string, tokenB: string): string {
    const a = ethers.getAddress(tokenA).toLowerCase();
    const b = ethers.getAddress(tokenB).toLowerCase();
    const [t0, t1] = a < b ? [a, b] : [b, a];
    return `infi:pair:${chainId}:${t0}:${t1}`;
}

async function loadInfinityPoolKeys(
    chainId: number,
    tokenIn: string,
    tokenOut: string
): Promise<InfinityPoolKey[]> {
    const pairKey = buildInfinityPairKey(chainId, tokenIn, tokenOut);
    const cached = infinityPairCache.get(pairKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.poolKeys;
    }

    const poolIdsRaw = await getDbCache(pairKey);
    if (!poolIdsRaw) return [];
    let poolIds: string[] = [];
    try {
        poolIds = JSON.parse(poolIdsRaw);
    } catch {
        return [];
    }
    if (!poolIds.length) return [];

    const poolKeys: InfinityPoolKey[] = [];
    for (const poolId of poolIds) {
        const poolKeyRaw = await getDbCache(`infi:poolkey:${chainId}:${poolId}`);
        if (!poolKeyRaw) continue;
        try {
            const parsed = JSON.parse(poolKeyRaw) as InfinityPoolKey;
            if (parsed.currency0 && parsed.currency1) {
                poolKeys.push({
                    currency0: parsed.currency0.toLowerCase(),
                    currency1: parsed.currency1.toLowerCase(),
                    hooks: parsed.hooks.toLowerCase(),
                    poolManager: parsed.poolManager.toLowerCase(),
                    fee: parsed.fee,
                    parameters: parsed.parameters
                });
            }
        } catch {
            continue;
        }
    }

    if (poolKeys.length) {
        infinityPairCache.set(pairKey, { poolKeys, timestamp: Date.now() });
    }
    return poolKeys;
}

function parseInfinityParameterValue(parameters: string): number {
    try {
        const raw = BigInt(parameters);
        const value = Number((raw >> 16n) & 0xffffn);
        return value;
    } catch {
        return 0;
    }
}

async function quoteInfinityExactInputSingle(
    quoter: string,
    params: {
        poolKey: InfinityPoolKey;
        zeroForOne: boolean;
        amountIn: bigint;
    },
    chainId: number
): Promise<bigint> {
    if (params.amountIn <= 0n || params.amountIn > MAX_UINT128) return 0n;
    try {
        const callData = infinityQuoterInterface.encodeFunctionData('quoteExactInputSingle', [{
            poolKey: params.poolKey,
            zeroForOne: params.zeroForOne,
            exactAmount: params.amountIn,
            hookData: '0x'
        }]);
        const result = await callRpc<string>(chainId, 'eth_call', [{
            to: quoter,
            data: callData
        }, 'latest']);
        if (!result || result === '0x') return 0n;
        const decoded = infinityQuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
        const amountOut = decoded[0] as bigint;
        return amountOut;
    } catch {
        return 0n;
    }
}

async function getInfinityBestQuoteOut(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<InfinityBestQuote | null> {
    if (chainId !== 56) return null;
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return null;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;

    let best: InfinityBestQuote | null = null;

    const cachedPoolKeys = await loadInfinityPoolKeys(chainId, normalizedIn, normalizedOut);
    if (cachedPoolKeys.length) {
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Infinity cache hit', {
            chainId,
            tokenIn: normalizedIn.slice(0, 10),
            tokenOut: normalizedOut.slice(0, 10),
            poolKeyCount: cachedPoolKeys.length
        });
        for (const poolKey of cachedPoolKeys) {
            const zeroForOne = poolKey.currency0.toLowerCase() === normalizedIn.toLowerCase();
            const isCl = poolKey.poolManager.toLowerCase() === PANCAKE_INFINITY_CL_POOL_MANAGER.toLowerCase();
            const quoter = isCl ? PANCAKE_INFINITY_CL_QUOTER : PANCAKE_INFINITY_BIN_QUOTER;
            const amountOut = await quoteInfinityExactInputSingle(
                quoter,
                { poolKey, zeroForOne, amountIn: amountInWei },
                chainId
            );
            if (amountOut > (best?.amountOut || 0n)) {
                best = {
                    amountOut,
                    poolKey,
                    zeroForOne,
                    kind: isCl ? 'cl' : 'bin',
                    fee: poolKey.fee,
                    tickSpacing: isCl ? parseInfinityParameterValue(poolKey.parameters) : undefined,
                    binStep: isCl ? undefined : parseInfinityParameterValue(poolKey.parameters)
                };
            }
        }
        if (best) return best;
    }

    for (const fee of INFINITY_CL_FEE_TIERS) {
        const tickSpacing = INFINITY_CL_TICK_SPACING_BY_FEE[fee];
        if (!tickSpacing) continue;
        const parameters = encodeInfinityParameters(tickSpacing);
        const { poolKey, zeroForOne } = buildInfinityPoolKey(
            normalizedIn,
            normalizedOut,
            PANCAKE_INFINITY_CL_POOL_MANAGER,
            fee,
            parameters
        );
        const amountOut = await quoteInfinityExactInputSingle(
            PANCAKE_INFINITY_CL_QUOTER,
            { poolKey, zeroForOne, amountIn: amountInWei },
            chainId
        );
        if (amountOut > (best?.amountOut || 0n)) {
            best = { amountOut, poolKey, zeroForOne, kind: 'cl', fee, tickSpacing };
        }
    }

    for (const fee of INFINITY_CL_FEE_TIERS) {
        for (const binStep of INFINITY_BIN_STEPS) {
            const parameters = encodeInfinityParameters(binStep);
            const { poolKey, zeroForOne } = buildInfinityPoolKey(
                normalizedIn,
                normalizedOut,
                PANCAKE_INFINITY_BIN_POOL_MANAGER,
                fee,
                parameters
            );
            const amountOut = await quoteInfinityExactInputSingle(
                PANCAKE_INFINITY_BIN_QUOTER,
                { poolKey, zeroForOne, amountIn: amountInWei },
                chainId
            );
            if (amountOut > (best?.amountOut || 0n)) {
                best = { amountOut, poolKey, zeroForOne, kind: 'bin', fee, binStep };
            }
        }
    }

    return best;
}

async function getV4BestSpotOut(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<bigint> {
    const cacheKey = `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}:${amountInWei.toString()}`;
    const cached = v4SpotCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < V4_SPOT_CACHE_TTL_MS) {
        return cached.value;
    }

    try {
        const best = await getV4BestPoolQuote(tokenIn, tokenOut, amountInWei, chainId);
        v4SpotCache.set(cacheKey, { value: best.amountOut, timestamp: Date.now() });
        return best.amountOut;
    } catch {
        return 0n;
    }
}

async function getV4BestPoolQuote(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<{ pool: PoolInfo | null; amountOut: bigint }> {
    const pools = await findV4Pools(tokenIn, tokenOut, chainId);
    if (!pools.length) return { pool: null, amountOut: 0n };

    const poolKey = pools[0].poolKey;
    const [meta0, meta1] = await Promise.all([
        getTokenMetadata(chainId, poolKey.currency0),
        getTokenMetadata(chainId, poolKey.currency1)
    ]);
    const decimals0 = meta0.decimals || 18;
    const decimals1 = meta1.decimals || 18;

    let bestOut = 0n;
    let bestPool: PoolInfo | null = null;

    for (const pool of pools) {
        const zeroForOne = pool.poolKey.currency0.toLowerCase() === tokenIn.toLowerCase();
        const spotPrice = calculatePriceFromSqrtX96(
            BigInt(pool.sqrtPriceX96),
            decimals0,
            decimals1
        );

        if (!Number.isFinite(spotPrice) || spotPrice <= 0) continue;

        const amountInHuman = Number(amountInWei) / Math.pow(10, zeroForOne ? decimals0 : decimals1);
        const spotOutHuman = zeroForOne
            ? amountInHuman * spotPrice
            : amountInHuman / spotPrice;
        const outDecimals = zeroForOne ? decimals1 : decimals0;
        const outWei = BigInt(Math.max(0, Math.floor(spotOutHuman * Math.pow(10, outDecimals))));

        if (outWei > bestOut) {
            bestOut = outWei;
            bestPool = {
                poolAddress: pool.poolId,
                token0: pool.poolKey.currency0,
                token1: pool.poolKey.currency1,
                liquidity: pool.liquidity,
                sqrtPriceX96: pool.sqrtPriceX96,
                fee: pool.lpFee,
                price: spotPrice,
                version: 'v4',
                dex: 'uniswap'
            };
        }
    }

    return { pool: bestPool, amountOut: bestOut };
}

async function getAerodromeExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    slippageBps: number,
    recipient: string
): Promise<bigint> {
    try {
        const quote = await getAerodromeQuote({
            tokenIn,
            tokenOut,
            amountIn: amountInWei,
            recipient,
            slippageBps
        }, chainId);
        return quote?.amountOut ? BigInt(quote.amountOut) : 0n;
    } catch {
        return 0n;
    }
}

async function getReferenceExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    slippageBps: number,
    recipient: string
): Promise<bigint> {
    const cacheKey = `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}:${amountInWei.toString()}`;
    const cached = referenceQuoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < REFERENCE_QUOTE_TTL_MS) {
        return cached.value;
    }

    const refStart = Date.now();

    let ref0x = 0n;
    let refKyber = 0n;
    try {
        const [zeroExRes, kyberRes] = await Promise.all([
            withTimeout(get0xExpectedOutput(tokenIn, tokenOut, amountInWei, chainId), REFERENCE_QUOTE_TIMEOUT_MS),
            withTimeout(
                getKyberQuote(tokenIn, tokenOut, amountInWei.toString(), chainId, slippageBps, recipient, 'copyTrade')
                    .then(res => res?.amountOut ? BigInt(res.amountOut) : 0n),
                REFERENCE_QUOTE_TIMEOUT_MS
            )
        ]);
        ref0x = zeroExRes;
        refKyber = kyberRes;
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Reference quote timeout', {
            error: err?.message?.slice(0, 80)
        });
    }

    const bestRef = ref0x > refKyber ? ref0x : refKyber;
    if (bestRef > 0n) {
        referenceQuoteCache.set(cacheKey, { value: bestRef, timestamp: Date.now() });
        logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Reference quote ready', {
            ref0x: ref0x.toString().slice(0, 15),
            refKyber: refKyber.toString().slice(0, 15),
            durationMs: Date.now() - refStart
        });
        return bestRef;
    }

    try {
        const chainName = chainId === 8453 ? 'base'
            : chainId === 1 ? 'eth'
                : chainId === 56 ? 'bsc'
                    : chainId === 137 ? 'polygon'
                        : chainId === 42161 ? 'arbitrum'
                            : chainId === 10 ? 'optimism'
                                : '';
        if (chainName) {
            const [inDetails, outDetails] = await withTimeout(
                Promise.all([
                    getTokenDetails(chainName, tokenIn, 'high'),
                    getTokenDetails(chainName, tokenOut, 'high')
                ]),
                REFERENCE_QUOTE_TIMEOUT_MS
            );
            if (inDetails?.price && outDetails?.price && inDetails.price > 0 && outDetails.price > 0) {
                const [inMeta, outMeta] = await Promise.all([
                    getTokenMetadata(chainId, tokenIn),
                    getTokenMetadata(chainId, tokenOut)
                ]);
                const inAmountHuman = Number(amountInWei) / Math.pow(10, inMeta.decimals || 18);
                const outAmountHuman = inAmountHuman * (inDetails.price / outDetails.price);
                const outWei = BigInt(Math.max(0, Math.floor(outAmountHuman * Math.pow(10, outMeta.decimals || 18))));
                referenceQuoteCache.set(cacheKey, { value: outWei, timestamp: Date.now() });
                logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Reference quote from Gecko', {
                    outWei: outWei.toString().slice(0, 15),
                    durationMs: Date.now() - refStart
                });
                return outWei;
            }
        }
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Gecko reference failed', {
            error: err?.message?.slice(0, 80)
        });
    }

    logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] No reference quote available', {
        durationMs: Date.now() - refStart
    });
    return 0n;
}

async function executeV2Swap(
    params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
        slippageBps: number;
    },
    expectedOut: bigint
): Promise<DirectSwapResult> {
    const router = V2_ROUTERS[params.chainId];
    if (!router) return { success: false, error: 'V2 router not available', provider: 'failed' };

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[params.chainId];
    if (!weth) return { success: false, error: 'WETH not configured', provider: 'failed' };

    const amountInWei = ethers.parseEther(params.amountIn);
    const isNativeIn = params.tokenIn.toLowerCase() === ETH_ADDRESS;
    const isNativeOut = params.tokenOut.toLowerCase() === ETH_ADDRESS;

    const normalizedIn = isNativeIn ? weth : params.tokenIn;
    const normalizedOut = isNativeOut ? weth : params.tokenOut;

    const minAmountOut = expectedOut > 0n
        ? expectedOut * BigInt(10000 - params.slippageBps) / BigInt(10000)
        : 0n;

    const deadline = Math.floor(Date.now() / 1000) + 300;
    const data = isNativeIn
        ? v2RouterInterface.encodeFunctionData('swapExactETHForTokens', [
            minAmountOut,
            [normalizedIn, normalizedOut],
            params.walletAddress,
            deadline
        ])
        : isNativeOut
            ? v2RouterInterface.encodeFunctionData('swapExactTokensForETH', [
                amountInWei,
                minAmountOut,
                [normalizedIn, normalizedOut],
                params.walletAddress,
                deadline
            ])
            : v2RouterInterface.encodeFunctionData('swapExactTokensForTokens', [
                amountInWei,
                minAmountOut,
                [normalizedIn, normalizedOut],
                params.walletAddress,
                deadline
            ]);

    let gasLimit: string;
    try {
        const estimate = await callRpc<string>(params.chainId, 'eth_estimateGas', [{
            from: params.walletAddress,
            to: router,
            data: data,
            value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
        }]);
        gasLimit = (BigInt(estimate) * 2n).toString();
    } catch {
        gasLimit = '350000';
    }

    const txHash = await sendTransaction(params.userId, params.accessToken, {
        to: router,
        data: data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId: params.chainId,
        gas: gasLimit
    });

    return {
        success: true,
        txHash,
        provider: params.chainId === 56 ? 'pancake-v2' : 'uniswap-v2',
        poolInfo: {
            version: 'v2',
            fee: 0,
            liquidity: '0'
        }
    };
}

/**
 * 执行 V4 交易
 */
async function executeV4Swap(
    params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
        slippageBps: number;
    },
    pool: PoolInfo
): Promise<DirectSwapResult> {
    const { userId, accessToken, tokenIn, tokenOut, amountIn, chainId, slippageBps } = params;

    // [Logic]: 此时 tokenIn/tokenOut 已经是规范化后的 ETH 地址（0xeeee...）
    // 需要判断是否是 ETH 并转换为 WETH 用于池子查询
    // [Ref]: Clanker V4 池子使用 WETH 地址，不是 address(0)
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const isNativeIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
    const isNativeOut = tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase();

    // V4 池子使用 WETH 地址查询
    const normalizedIn = isNativeIn ? WETH_ADDRESSES[chainId] : tokenIn;
    const normalizedOut = isNativeOut ? WETH_ADDRESSES[chainId] : tokenOut;

    // 获取 V4 池子详细信息
    const v4Pools = await findV4Pools(normalizedIn!, normalizedOut!, chainId);
    if (v4Pools.length === 0) {
        return { success: false, error: 'V4 pool not found', provider: 'failed' };
    }

    const v4Pool = v4Pools[0];
    const poolKey = v4Pool.poolKey;

    // 确定方向 - 使用规范化后的 WETH 地址比较
    const zeroForOne = poolKey.currency0.toLowerCase() === normalizedIn!.toLowerCase();



    // 计算金额 (wei)
    const amountInWei = ethers.parseEther(amountIn);

    // [Safety]: 使用 V4 Pool 的 spot price 做报价偏离校验，避免极端误报价
    let spotOutWei = 0n;
    try {
        const [meta0, meta1] = await Promise.all([
            getTokenMetadata(chainId, poolKey.currency0),
            getTokenMetadata(chainId, poolKey.currency1)
        ]);

        const spotPrice = calculatePriceFromSqrtX96(
            BigInt(v4Pool.sqrtPriceX96),
            meta0.decimals,
            meta1.decimals
        ); // token1 per token0

        if (Number.isFinite(spotPrice) && spotPrice > 0) {
            const amountInHuman = Number(amountInWei) / Math.pow(10, zeroForOne ? meta0.decimals : meta1.decimals);
            const spotOutHuman = zeroForOne
                ? amountInHuman * spotPrice
                : amountInHuman / spotPrice;
            const outDecimals = zeroForOne ? meta1.decimals : meta0.decimals;
            spotOutWei = BigInt(Math.max(0, Math.floor(spotOutHuman * Math.pow(10, outDecimals))));
        }
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] V4 spot price check failed', {
            error: err?.message?.slice(0, 120)
        });
    }

    if (spotOutWei <= 0n) {
        return { success: false, error: 'V4 spot price unavailable', provider: 'failed' };
    }

    const minAmountOut = spotOutWei * BigInt(10000 - slippageBps) / BigInt(10000);

    logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V4 minAmountOut calculated', {
        spotOut: spotOutWei.toString().slice(0, 15),
        minAmountOut: minAmountOut.toString().slice(0, 15),
        slippageBps
    });

    // 构建交易
    const deadline = Math.floor(Date.now() / 1000) + 300;


    const tx = buildV4SwapTransaction(
        chainId,
        poolKey,
        zeroForOne,
        amountInWei,
        minAmountOut,
        params.walletAddress,
        deadline,
        isNativeIn,  // 传递 isNativeIn 给 SETTLE_ALL
        isNativeOut  // 传递 isNativeOut 给 TAKE_ALL
    );

    // [Safety]: 预模拟交易，避免明显回滚
    try {
        await callRpc<string>(chainId, 'eth_call', [{
            from: params.walletAddress,
            to: tx.to,
            data: tx.data,
            value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
        }, 'latest']);
    } catch (err: any) {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V4 pre-simulation failed', {
            error: err?.message?.slice(0, 160)
        });
        return { success: false, error: 'V4 pre-simulation failed', provider: 'failed' };
    }

    // [Logic]: 动态估算 V4 swap gas（包含复杂 ERC20 transfer），并增加 buffer
    // [Risk]: 部分代币 transfer 更耗 gas，固定 350k 容易 OOG
    let gasLimit: string;
    try {
        const estimate = await callRpc<string>(chainId, 'eth_estimateGas', [{
            from: params.walletAddress,
            to: tx.to,
            data: tx.data,
            value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
        }]);

        const estimatedGas = BigInt(estimate);
        const buffered = estimatedGas * 2n; // 2x buffer for heavy transfer tokens
        gasLimit = buffered.toString();

        logger.info(LogCode.API_FETCH_SUCCESS, '[DirectSwap] V4 gas estimated', {
            estimatedGas: estimatedGas.toString(),
            gasLimit
        });
    } catch (err: any) {
        const V4_GAS_FALLBACK = 900000; // fallback for heavy tokens
        gasLimit = V4_GAS_FALLBACK.toString();
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] V4 gas estimate failed, using fallback', {
            error: err?.message?.slice(0, 120),
            gasLimit
        });
    }

    // 发送交易
    // [Logic]: 如果输入是 ETH，需要发送 ETH value；否则 value=0
    const txHash = await sendTransaction(userId, accessToken, {
        to: tx.to,
        data: tx.data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId,
        gas: gasLimit
    });

    logger.info(LogCode.EXE_TX_CONFIRMED, '[DirectSwap] V4 swap executed', {
        txHash,
        poolId: v4Pool.poolId.slice(0, 20)
    });

    return {
        success: true,
        txHash,
        provider: 'uniswap-v4',
        poolInfo: {
            version: 'v4',
            fee: v4Pool.lpFee,
            liquidity: v4Pool.liquidity
        }
    };
}

/**
 * 执行 Pancake Infinity 交易 (BSC)
 */
async function executeInfinitySwap(
    params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
        slippageBps: number;
    },
    quote: InfinityBestQuote
): Promise<DirectSwapResult> {
    const { userId, accessToken, walletAddress, chainId, slippageBps } = params;
    if (chainId !== 56) {
        return { success: false, error: 'Infinity only supported on BSC', provider: 'failed' };
    }

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) {
        return { success: false, error: 'WBNB not configured', provider: 'failed' };
    }

    const amountInWei = ethers.parseEther(params.amountIn);
    const isNativeIn = params.tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
    const isNativeOut = params.tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase();

    const normalizedIn = isNativeIn ? weth : params.tokenIn;
    const normalizedOut = isNativeOut ? weth : params.tokenOut;

    if (isNativeOut) {
        logger.warn(LogCode.SYS_INFO, '[DirectSwap] Infinity native-out not supported, using WBNB output', {
            tokenOut: params.tokenOut.slice(0, 10)
        });
    }

    const minAmountOut = quote.amountOut * BigInt(10000 - slippageBps) / 10000n;
    const deadline = Math.floor(Date.now() / 1000) + 300;

    const swapParams = quote.kind === 'cl'
        ? ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint24,bytes32),bool,uint128,uint128,bytes)'],
            [[
                [
                    quote.poolKey.currency0,
                    quote.poolKey.currency1,
                    quote.poolKey.hooks,
                    quote.poolKey.poolManager,
                    quote.poolKey.fee,
                    quote.poolKey.parameters
                ],
                quote.zeroForOne,
                amountInWei,
                minAmountOut,
                '0x'
            ]]
        )
        : ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint24,bytes32),bool,uint128,uint128,bytes)'],
            [[
                [
                    quote.poolKey.currency0,
                    quote.poolKey.currency1,
                    quote.poolKey.hooks,
                    quote.poolKey.poolManager,
                    quote.poolKey.fee,
                    quote.poolKey.parameters
                ],
                quote.zeroForOne,
                amountInWei,
                minAmountOut,
                '0x'
            ]]
        );

    const actions: number[] = [];
    const paramsArray: string[] = [];

    actions.push(
        quote.kind === 'cl'
            ? INFINITY_ACTIONS.CL_SWAP_EXACT_IN_SINGLE
            : INFINITY_ACTIONS.BIN_SWAP_EXACT_IN_SINGLE
    );
    paramsArray.push(swapParams);

    // finalizeSwap with MSG_SENDER (SETTLE_ALL + TAKE_ALL)
    actions.push(INFINITY_ACTIONS.SETTLE_ALL);
    paramsArray.push(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [normalizedIn, MAX_UINT256]
        )
    );
    actions.push(INFINITY_ACTIONS.TAKE_ALL);
    paramsArray.push(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [normalizedOut, 0]
        )
    );

    const actionsBytes = ethers.hexlify(Uint8Array.from(actions));
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(['bytes', 'bytes[]'], [actionsBytes, paramsArray]);

    let commands = ethers.solidityPacked(['uint8'], [INFINITY_COMMANDS.INFI_SWAP]);
    let inputs = [payload];

    if (isNativeIn) {
        const wrapParams = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [PANCAKE_INFINITY_ROUTER, INFINITY_ACTION_CONSTANTS.CONTRACT_BALANCE]
        );
        commands = ethers.solidityPacked(['uint8', 'bytes'], [INFINITY_COMMANDS.WRAP_ETH, commands]);
        inputs = [wrapParams, ...inputs];
    }

    const data = infinityRouterInterface.encodeFunctionData('execute', [commands, inputs, deadline]);

    try {
        await callRpc<string>(chainId, 'eth_call', [{
            from: walletAddress,
            to: PANCAKE_INFINITY_ROUTER,
            data,
            value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
        }, 'latest']);
    } catch (err: any) {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] Infinity pre-simulation failed', {
            error: err?.message?.slice(0, 160)
        });
        return { success: false, error: 'Infinity pre-simulation failed', provider: 'failed' };
    }

    let gasLimit: string;
    try {
        const estimate = await callRpc<string>(chainId, 'eth_estimateGas', [{
            from: walletAddress,
            to: PANCAKE_INFINITY_ROUTER,
            data,
            value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
        }]);
        gasLimit = (BigInt(estimate) * 2n).toString();
    } catch {
        gasLimit = '900000';
    }

    const txHash = await sendTransaction(userId, accessToken, {
        to: PANCAKE_INFINITY_ROUTER,
        data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId,
        gas: gasLimit
    });

    return {
        success: true,
        txHash,
        provider: 'pancake-infinity',
        poolInfo: {
            version: quote.kind === 'cl' ? 'infinity-cl' : 'infinity-bin',
            fee: quote.fee,
            liquidity: '0'
        }
    };
}

/**
 * 执行 V3 交易
 */
async function executeV3Swap(
    params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
        slippageBps: number;
    },
    pool: PoolInfo,
    dex: 'uniswap' | 'pancake'
): Promise<DirectSwapResult> {
    const { userId, accessToken, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps } = params;

    // V3 SwapRouter02 地址
    const SWAP_ROUTER_02: Record<number, string> = {
        8453: '0x2626664c2603336E57B271c5C0b26F421741e481', // Base
        1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',    // Ethereum
        56: '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2'    // Uniswap V3 SwapRouter02 on BSC
    };

    const routerAddress = dex === 'pancake' ? PANCAKE_V3_ROUTER : SWAP_ROUTER_02[chainId];
    if (!routerAddress) {
        return { success: false, error: 'V3 router not available', provider: 'failed' };
    }

    // 计算金额
    const amountInWei = ethers.parseEther(amountIn);

    // [Logic]: ETH 地址转换为 WETH，因为 V3 Router 需要 WETH 地址
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase()
        ? WETH_ADDRESSES[chainId]
        : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase()
        ? WETH_ADDRESSES[chainId]
        : tokenOut;

    // [Logic]: 优先使用 V3 QuoterV2 获取链上报价，0x 作为备用
    let quoterOut = 0n;
    let bestFee = pool.fee || 3000;
    const quoterAddress = dex === 'pancake' ? PANCAKE_V3_QUOTER : V3_QUOTER_V2[chainId];
    const feeTiers = dex === 'pancake' ? PANCAKE_V3_FEE_TIERS : V3_FEE_TIERS;
    if (quoterAddress) {
        try {
            for (const fee of feeTiers) {
                try {
                    const quoteParams = {
                        tokenIn: normalizedIn,
                        tokenOut: normalizedOut,
                        amountIn: amountInWei,
                        fee: fee,
                        sqrtPriceLimitX96: 0
                    };
                    const callData = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);
                    const result = await callRpc<string>(chainId, 'eth_call', [{
                        to: quoterAddress,
                        data: callData
                    }, 'latest']);
                    if (!result || result === '0x') continue;
                    const decoded = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
                    const amountOut = decoded[0] as bigint;
                    if (amountOut > quoterOut) {
                        quoterOut = amountOut;
                        bestFee = fee;
                    }
                } catch {
                    continue;
                }
            }
        } catch (err: any) {
            logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] V3 quoter failed', {
                error: err?.message?.slice(0, 120)
            });
        }
    }

    // 0x Price API 备用
    const expectedOut0x = await get0xExpectedOutput(normalizedIn!, normalizedOut!, amountInWei, chainId);

    // 偏离检测：0x 报价高于 quoter 太多则拒绝
    const MAX_V3_QUOTE_DEVIATION_BPS = 2000; // 20%
    if (quoterOut > 0n && expectedOut0x > 0n) {
        const maxAllowed = quoterOut * BigInt(10000 + MAX_V3_QUOTE_DEVIATION_BPS) / BigInt(10000);
        if (expectedOut0x > maxAllowed) {
            logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x quote deviates from quoter; using quoter', {
                quoterOut: quoterOut.toString().slice(0, 15),
                expectedOut0x: expectedOut0x.toString().slice(0, 15)
            });
        }
    }

    // 选择更保守的报价用于 minOut
    let baseOut = 0n;
    if (quoterOut > 0n && expectedOut0x > 0n) {
        baseOut = quoterOut < expectedOut0x ? quoterOut : expectedOut0x;
    } else {
        baseOut = quoterOut > 0n ? quoterOut : expectedOut0x;
    }

    const minAmountOut = baseOut > 0n
        ? baseOut * BigInt(10000 - slippageBps) / BigInt(10000)
        : BigInt(0); // [Risk]: 无价格时无滑点保护

    logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V3 minAmountOut calculated', {
        expectedOut: expectedOut0x.toString().slice(0, 15),
        quoterOut: quoterOut.toString().slice(0, 15),
        bestFee,
        minAmountOut: minAmountOut.toString().slice(0, 15),
        slippageBps
    });

    // 构建 exactInputSingle 调用
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const routerInterface = new ethers.Interface(
        dex === 'pancake'
            ? [
                'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
            ]
            : [
                'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
            ]
    );

    const swapParams = dex === 'pancake'
        ? {
            tokenIn: normalizedIn,
            tokenOut: normalizedOut,
            fee: bestFee,
            recipient: walletAddress,
            deadline,
            amountIn: amountInWei,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        }
        : {
            tokenIn: normalizedIn,
            tokenOut: normalizedOut,
            fee: bestFee,
            recipient: walletAddress,
            amountIn: amountInWei,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        };

    const data = routerInterface.encodeFunctionData('exactInputSingle', [swapParams]);

    // 发送交易
    // [Logic]: 只有原始输入是 ETH（0xeeee...）时才发送 value，WETH 不需要发送 value
    const isNativeIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();

    // [Logic]: V3 swap gas 估算，加 50% buffer
    // [Ref]: 基于 EvmExecutor 实现，V3 单池 swap 约需 150k-200k gas
    const V3_GAS_ESTIMATE = 200000;
    const gasLimit = Math.floor(V3_GAS_ESTIMATE * 1.5).toString();

    const txHash = await sendTransaction(userId, accessToken, {
        to: routerAddress,
        data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId,
        gas: gasLimit
    });

    logger.info(LogCode.EXE_TX_CONFIRMED, '[DirectSwap] V3 swap executed', {
        txHash,
        pool: pool.poolAddress.slice(0, 20)
    });

    return {
        success: true,
        txHash,
        provider: dex === 'pancake' ? 'pancake-v3' : 'uniswap-v3',
        poolInfo: {
            version: 'v3',
            fee: pool.fee || 3000,
            liquidity: pool.liquidity || '0'
        }
    };
}

/**
 * 检查是否支持直接交易
 */
export function isDirectSwapSupported(chainId: number): boolean {
    // 目前支持 Base、Ethereum、BSC
    return chainId === 8453 || chainId === 1 || chainId === 56;
}

/**
 * 使用 0x Price API 获取预期输出金额
 * [Logic]: 用于计算 minAmountOut，提供滑点保护
 * [Ref]: 0x API docs - /swap/allowance-holder/price
 */
async function get0xExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<bigint> {
    try {
        const price = await getZeroExPrice(tokenIn, tokenOut, amountInWei.toString(), chainId);
        if (price?.buyAmount) {
            logger.debug(LogCode.API_FETCH_SUCCESS, '[DirectSwap] 0x price fetched', {
                expectedOut: price.buyAmount.slice(0, 15)
            });
            return BigInt(price.buyAmount);
        }
    } catch (e: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x price fetch failed, no slippage protection', {
            error: e.message?.slice(0, 100)
        });
    }

    // [Risk]: 返回 0 表示无滑点保护 - 交易仍可继续但有风险
    return BigInt(0);
}

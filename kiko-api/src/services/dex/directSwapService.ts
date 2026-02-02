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
import { findV4Pools, V4PoolKey } from './uniswapV4.js';
import { buildV4SwapTransaction, isV4SwapSupported } from './uniswapV4Swap.js';
import { calculateV3TVL } from './v3Math.js';
import { callRpc } from '../rpcManager.js';
import { sendTransaction } from '../privyWallet.js';
import { getZeroExPrice } from '../zeroEx.js';

// 常用代币地址
const WETH_ADDRESSES: Record<number, string> = {
    8453: '0x4200000000000000000000000000000000000006', // Base
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',    // Ethereum
};

const USDC_ADDRESSES: Record<number, string> = {
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum
};

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
    provider: 'uniswap-v3' | 'uniswap-v4' | 'failed';
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

    try {
        // 1. 查找最佳池子
        const bestPool = await findBestPool(normalizedTokenIn, normalizedTokenOut, chainId);

        if (!bestPool) {
            logger.warn(LogCode.SYS_INFO, '[DirectSwap] No pool found for token pair', {
                tokenIn: tokenIn.slice(0, 12),
                tokenOut: tokenOut.slice(0, 12),
                chainId
            });
            return {
                success: false,
                error: 'No pool found for token pair',
                provider: 'failed'
            };
        }

        logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Found best pool', {
            version: bestPool.version,
            fee: bestPool.fee,
            liquidity: bestPool.liquidity?.toString().slice(0, 15)
        });

        // 2. 根据池子版本执行交易
        // [Logic]: 使用规范化后的地址
        const normalizedParams = {
            ...params,
            tokenIn: normalizedTokenIn,
            tokenOut: normalizedTokenOut
        };

        if (bestPool.version === 'v4' && isV4SwapSupported(chainId)) {
            // V4 交易
            return await executeV4Swap(normalizedParams, bestPool);
        } else {
            // V3 交易 (通过 SwapRouter)
            return await executeV3Swap(normalizedParams, bestPool);
        }

    } catch (error: any) {
        logger.error(LogCode.EXE_TX_REVERTED, '[DirectSwap] Swap failed', {
            error: error.message,
            stack: error.stack?.slice(0, 200),
            tokenIn: tokenIn.slice(0, 12),
            tokenOut: tokenOut.slice(0, 12)
        });
        return {
            success: false,
            error: error.message,
            provider: 'failed'
        };
    }
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
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const isNativeIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
    const isNativeOut = tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase();

    // V4 池子使用 WETH 地址
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

    // [Logic]: 使用 0x Price API 获取预期输出，计算 minAmountOut
    // [Ref]: slippageBps 例如 100 = 1% 滑点
    const expectedOut = await get0xExpectedOutput(normalizedIn!, normalizedOut!, amountInWei, chainId);
    const minAmountOut = expectedOut > 0n
        ? expectedOut * BigInt(10000 - slippageBps) / BigInt(10000)
        : BigInt(0); // [Risk]: 无价格时无滑点保护

    logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V4 minAmountOut calculated', {
        expectedOut: expectedOut.toString().slice(0, 15),
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
        deadline
    );

    // [Logic]: V4 swap gas 估算，加 50% buffer
    // [Ref]: 基于 EvmExecutor 实现，V4 swap 约需 300k-400k gas
    const V4_GAS_ESTIMATE = 350000;
    const gasLimit = Math.floor(V4_GAS_ESTIMATE * 1.5).toString();

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
    pool: PoolInfo
): Promise<DirectSwapResult> {
    const { userId, accessToken, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps } = params;

    // V3 SwapRouter02 地址
    const SWAP_ROUTER_02: Record<number, string> = {
        8453: '0x2626664c2603336E57B271c5C0b26F421741e481', // Base
        1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',    // Ethereum
    };

    const routerAddress = SWAP_ROUTER_02[chainId];
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

    // [Logic]: 使用 0x Price API 获取预期输出，计算 minAmountOut
    // [Ref]: slippageBps 例如 100 = 1% 滑点
    const expectedOut = await get0xExpectedOutput(normalizedIn!, normalizedOut!, amountInWei, chainId);
    const minAmountOut = expectedOut > 0n
        ? expectedOut * BigInt(10000 - slippageBps) / BigInt(10000)
        : BigInt(0); // [Risk]: 无价格时无滑点保护

    logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V3 minAmountOut calculated', {
        expectedOut: expectedOut.toString().slice(0, 15),
        minAmountOut: minAmountOut.toString().slice(0, 15),
        slippageBps
    });

    // 构建 exactInputSingle 调用
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const routerInterface = new ethers.Interface([
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
    ]);

    const swapParams = {
        tokenIn: normalizedIn,
        tokenOut: normalizedOut,
        fee: pool.fee || 3000,
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
        provider: 'uniswap-v3',
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
    // 目前支持 Base 和 Ethereum
    return chainId === 8453 || chainId === 1;
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

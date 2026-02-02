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
    const pools = await findTokenPools(tokenIn, tokenOut, chainId);

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

    logger.info(LogCode.EXE_TX_BROADCAST, '[DirectSwap] Starting direct swap', {
        tokenIn: tokenIn.slice(0, 12),
        tokenOut: tokenOut.slice(0, 12),
        amount: amountIn,
        chainId
    });

    try {
        // 1. 查找最佳池子
        const bestPool = await findBestPool(tokenIn, tokenOut, chainId);

        if (!bestPool) {
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
        if (bestPool.version === 'v4' && isV4SwapSupported(chainId)) {
            // V4 交易
            return await executeV4Swap(params, bestPool);
        } else {
            // V3 交易 (通过 SwapRouter)
            return await executeV3Swap(params, bestPool);
        }

    } catch (error: any) {
        logger.error(LogCode.EXE_TX_REVERTED, '[DirectSwap] Swap failed', {
            error: error.message
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

    // 获取 V4 池子详细信息
    const v4Pools = await findV4Pools(tokenIn, tokenOut, chainId);
    if (v4Pools.length === 0) {
        return { success: false, error: 'V4 pool not found', provider: 'failed' };
    }

    const v4Pool = v4Pools[0];
    const poolKey = v4Pool.poolKey;

    // 确定方向
    const zeroForOne = poolKey.currency0.toLowerCase() === tokenIn.toLowerCase();

    // 计算金额 (wei)
    const amountInWei = ethers.parseEther(amountIn);
    const minAmountOut = BigInt(0); // TODO: 根据价格和滑点计算

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

    // 发送交易
    const txHash = await sendTransaction(userId, accessToken, {
        to: tx.to,
        data: tx.data,
        value: zeroForOne ? amountInWei.toString() : '0',
        chainId
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
    const minAmountOut = BigInt(0); // TODO: 根据价格和滑点计算

    // 构建 exactInputSingle 调用
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const routerInterface = new ethers.Interface([
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
    ]);

    const swapParams = {
        tokenIn,
        tokenOut,
        fee: pool.fee || 3000,
        recipient: walletAddress,
        amountIn: amountInWei,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0
    };

    const data = routerInterface.encodeFunctionData('exactInputSingle', [swapParams]);

    // 发送交易
    const isNativeIn = tokenIn.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
        tokenIn.toLowerCase() === WETH_ADDRESSES[chainId]?.toLowerCase();

    const txHash = await sendTransaction(userId, accessToken, {
        to: routerAddress,
        data,
        value: isNativeIn ? amountInWei.toString() : '0',
        chainId
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

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
import { getTokenMetadata } from '../rpcService.js';
import { V2_ROUTER_ABI, V3_FEE_TIERS } from './types.js';
import { buildAerodromeSwapTransaction } from './aerodrome.js';

// 常用代币地址
const WETH_ADDRESSES: Record<number, string> = {
    8453: '0x4200000000000000000000000000000000000006', // Base
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',    // Ethereum
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

const V2_ROUTERS: Record<number, string> = {
    1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',   // Uniswap V2
    8453: '0x4752ba5Dbc23f44D87826276BF6Fd6b1C372aD24' // Uniswap V2 on Base
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
    provider: 'uniswap-v2' | 'uniswap-v3' | 'uniswap-v4' | 'aerodrome' | 'failed';
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
        // 0. Aerodrome (Base) - 优先处理 Virtual 等主要流动性在 Aerodrome 的代币
        const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const isNativeIn = normalizedTokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
        if (chainId === 8453 && isNativeIn) {
            const aeroResult = await executeAerodromeSwap({
                ...params,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut
            });
            if (aeroResult.success) {
                return aeroResult;
            }
        }

        // 1. 查找所有池子 (V2/V3/V4) - ETH 使用 WETH 地址匹配池子
        const weth = WETH_ADDRESSES[chainId];
        const poolTokenIn = normalizedTokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase() && weth
            ? weth
            : normalizedTokenIn;
        const poolTokenOut = normalizedTokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase() && weth
            ? weth
            : normalizedTokenOut;

        const pools = await findTokenPools(poolTokenIn, poolTokenOut, chainId);

        if (pools.length === 0) {
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

        const normalizedParams = {
            ...params,
            tokenIn: normalizedTokenIn,
            tokenOut: normalizedTokenOut
        };

        // 2. 计算 V2/V3 报价并选择最佳
        const v2Pool = pools.find(p => p.version === 'v2') || null;
        const v3Pool = pools.find(p => p.version === 'v3') || null;
        const v4Pool = pools.find(p => p.version === 'v4') || null;

        const amountInWei = ethers.parseEther(amountIn);
        const v2Quote = v2Pool ? await getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId) : 0n;
        const v3Quote = v3Pool ? await getV3BestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId) : 0n;

        logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Best quote comparison', {
            v2Quote: v2Quote.toString().slice(0, 15),
            v3Quote: v3Quote.toString().slice(0, 15)
        });

        if (v2Quote > 0n && v2Quote >= v3Quote) {
            return await executeV2Swap(normalizedParams, v2Quote);
        }

        if (v3Pool) {
            return await executeV3Swap(normalizedParams, v3Pool);
        }

        if (v4Pool) {
            return await executeV4Swap(normalizedParams, v4Pool);
        }

        return { success: false, error: 'No suitable pool found', provider: 'failed' };
    } catch (error: any) {
        logger.error(LogCode.EXE_TX_REVERTED, '[DirectSwap] Direct swap failed', {
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
    chainId: number
): Promise<bigint> {
    const quoter = V3_QUOTER_V2[chainId];
    if (!quoter) return 0n;

    let bestOut = 0n;
    for (const fee of V3_FEE_TIERS) {
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
        provider: 'uniswap-v2',
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

    // [Logic]: 使用 0x Price API 获取预期输出，计算 minAmountOut
    // [Ref]: 0x API 需要使用 ETH 地址格式 (0xeeee...)，不能用 address(0)
    // [Risk]: 如果 0x 不支持这个代币对，minAmountOut 会是 0
    const tokenInFor0x = isNativeIn ? ETH_ADDRESS : tokenIn;
    const tokenOutFor0x = isNativeOut ? ETH_ADDRESS : tokenOut;
    const expectedOut = await get0xExpectedOutput(tokenInFor0x, tokenOutFor0x, amountInWei, chainId);

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

    const MAX_V4_PRICE_DEVIATION_BPS = 2000; // 20%
    if (expectedOut > 0n && spotOutWei > 0n) {
        const minAcceptable = spotOutWei * BigInt(10000 - MAX_V4_PRICE_DEVIATION_BPS) / BigInt(10000);
        if (expectedOut < minAcceptable) {
            throw new Error(`V4 quote deviates too much from spot price: expectedOut < ${(10000 - MAX_V4_PRICE_DEVIATION_BPS) / 100}% spot`);
        }
    }

    let minAmountOut = BigInt(0);
    if (expectedOut > 0n) {
        minAmountOut = expectedOut * BigInt(10000 - slippageBps) / BigInt(10000);
    } else if (spotOutWei > 0n) {
        const fallbackSlippageBps = Math.min(slippageBps + 500, 5000); // extra 5% cap
        minAmountOut = spotOutWei * BigInt(10000 - fallbackSlippageBps) / BigInt(10000);
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x price unavailable, using spot fallback', {
            spotOut: spotOutWei.toString().slice(0, 15),
            minAmountOut: minAmountOut.toString().slice(0, 15),
            fallbackSlippageBps
        });
    }

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
        deadline,
        isNativeIn,  // 传递 isNativeIn 给 SETTLE_ALL
        isNativeOut  // 传递 isNativeOut 给 TAKE_ALL
    );

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

    // [Logic]: 优先使用 V3 QuoterV2 获取链上报价，0x 作为备用
    let quoterOut = 0n;
    let bestFee = pool.fee || 3000;
    const quoterAddress = V3_QUOTER_V2[chainId];
    if (quoterAddress) {
        try {
            for (const fee of V3_FEE_TIERS) {
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
    const routerInterface = new ethers.Interface([
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
    ]);

    const swapParams = {
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

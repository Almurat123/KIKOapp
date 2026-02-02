/**
 * DEX Pool Information Service
 * Reads on-chain liquidity data directly from DEX pools
 * Replaces DEX Screener API dependency
 */

import { ethers } from 'ethers';
import { callRpc } from '../rpcManager.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { findV4Pools, isV4Supported, V4PoolInfo, calculatePriceFromSqrtX96 as v4CalcPrice } from './uniswapV4.js';

// V2 Pool ABI
const V2_POOL_ABI = [
    'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function totalSupply() view returns (uint256)',
    'function kLast() view returns (uint256)'
];

// V3 Pool ABI
const V3_POOL_ABI = [
    'function liquidity() view returns (uint128)',
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function fee() view returns (uint24)',
    'function tickSpacing() view returns (int24)'
];

// Factory ABIs for pool address computation
const V2_FACTORY_ABI = [
    'function getPair(address tokenA, address tokenB) view returns (address pair)'
];

const V3_FACTORY_ABI = [
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
];

const AERODROME_FACTORY_ABI = [
    'function getPool(address tokenA, address tokenB, bool stable) view returns (address pool)'
];

// ERC20 for decimals
const ERC20_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
];

export interface PoolInfo {
    poolAddress: string;
    token0: string;
    token1: string;
    token0Symbol?: string;
    token1Symbol?: string;
    token0Decimals?: number;
    token1Decimals?: number;
    reserve0?: string;  // Raw reserve amount
    reserve1?: string;  // Raw reserve amount
    liquidity?: string;  // V3/V4 liquidity (raw L value)
    sqrtPriceX96?: string;  // V3/V4 price
    fee?: number;  // Fee tier
    tvlUsd?: number;  // Calculated TVL in USD
    price?: number;  // token1/token0 price
    version?: 'v2' | 'v3' | 'v4' | 'aerodrome';  // Pool version
}

const v2PoolInterface = new ethers.Interface(V2_POOL_ABI);
const v3PoolInterface = new ethers.Interface(V3_POOL_ABI);
const v2FactoryInterface = new ethers.Interface(V2_FACTORY_ABI);
const v3FactoryInterface = new ethers.Interface(V3_FACTORY_ABI);
const aerodromeFactoryInterface = new ethers.Interface(AERODROME_FACTORY_ABI);
const erc20Interface = new ethers.Interface(ERC20_ABI);

/**
 * Get V2 pool information
 */
export async function getV2PoolInfo(
    poolAddress: string,
    chainId: number
): Promise<PoolInfo | null> {
    try {
        // Get reserves
        const reservesData = v2PoolInterface.encodeFunctionData('getReserves');
        const reservesResult = await callRpc<string>(chainId, 'eth_call', [{
            to: poolAddress,
            data: reservesData
        }, 'latest']);

        if (!reservesResult || reservesResult === '0x') {
            return null;
        }

        const decoded = v2PoolInterface.decodeFunctionResult('getReserves', reservesResult);
        const reserve0 = decoded[0] as bigint;
        const reserve1 = decoded[1] as bigint;

        // Get token addresses
        const token0Data = v2PoolInterface.encodeFunctionData('token0');
        const token1Data = v2PoolInterface.encodeFunctionData('token1');

        const [token0Result, token1Result] = await Promise.all([
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: token0Data }, 'latest']),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: token1Data }, 'latest'])
        ]);

        const token0 = ethers.getAddress('0x' + token0Result!.slice(-40));
        const token1 = ethers.getAddress('0x' + token1Result!.slice(-40));

        // Get token metadata
        const [token0Meta, token1Meta] = await Promise.all([
            getTokenMetadata(token0, chainId),
            getTokenMetadata(token1, chainId)
        ]);

        // Calculate price
        const price = token0Meta.decimals && token1Meta.decimals
            ? Number(reserve1) / Number(reserve0) * Math.pow(10, token0Meta.decimals - token1Meta.decimals)
            : 0;

        return {
            poolAddress,
            token0,
            token1,
            token0Symbol: token0Meta.symbol,
            token1Symbol: token1Meta.symbol,
            token0Decimals: token0Meta.decimals,
            token1Decimals: token1Meta.decimals,
            reserve0: reserve0.toString(),
            reserve1: reserve1.toString(),
            price,
            version: 'v2'
        };
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Failed to get V2 pool info', {
            pool: poolAddress,
            error: err.message?.substring(0, 100)
        });
        return null;
    }
}

/**
 * Get V3 pool information
 */
export async function getV3PoolInfo(
    poolAddress: string,
    chainId: number
): Promise<PoolInfo | null> {
    try {
        // Get liquidity and slot0
        const liquidityData = v3PoolInterface.encodeFunctionData('liquidity');
        const slot0Data = v3PoolInterface.encodeFunctionData('slot0');
        const feeData = v3PoolInterface.encodeFunctionData('fee');

        const [liquidityResult, slot0Result, feeResult] = await Promise.all([
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: liquidityData }, 'latest']),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: slot0Data }, 'latest']),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: feeData }, 'latest'])
        ]);

        if (!liquidityResult || !slot0Result) {
            return null;
        }

        const liquidity = v3PoolInterface.decodeFunctionResult('liquidity', liquidityResult)[0] as bigint;
        const slot0 = v3PoolInterface.decodeFunctionResult('slot0', slot0Result);
        const sqrtPriceX96 = slot0[0] as bigint;
        const fee = feeResult ? Number(v3PoolInterface.decodeFunctionResult('fee', feeResult)[0]) : 0;

        // Get token addresses
        const token0Data = v3PoolInterface.encodeFunctionData('token0');
        const token1Data = v3PoolInterface.encodeFunctionData('token1');

        const [token0Result, token1Result] = await Promise.all([
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: token0Data }, 'latest']),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: token1Data }, 'latest'])
        ]);

        const token0 = ethers.getAddress('0x' + token0Result!.slice(-40));
        const token1 = ethers.getAddress('0x' + token1Result!.slice(-40));

        // Get token metadata
        const [token0Meta, token1Meta] = await Promise.all([
            getTokenMetadata(token0, chainId),
            getTokenMetadata(token1, chainId)
        ]);

        // Calculate price from sqrtPriceX96
        const price = calculatePriceFromSqrtX96(sqrtPriceX96, token0Meta.decimals || 18, token1Meta.decimals || 18);

        return {
            poolAddress,
            token0,
            token1,
            token0Symbol: token0Meta.symbol,
            token1Symbol: token1Meta.symbol,
            token0Decimals: token0Meta.decimals,
            token1Decimals: token1Meta.decimals,
            liquidity: liquidity.toString(),
            sqrtPriceX96: sqrtPriceX96.toString(),
            fee,
            price,
            version: 'v3'
        };
    } catch (err: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Failed to get V3 pool info', {
            pool: poolAddress,
            error: err.message?.substring(0, 100)
        });
        return null;
    }
}

/**
 * Get token metadata (symbol, decimals)
 */
async function getTokenMetadata(
    tokenAddress: string,
    chainId: number
): Promise<{ symbol?: string; decimals?: number }> {
    try {
        const symbolData = erc20Interface.encodeFunctionData('symbol');
        const decimalsData = erc20Interface.encodeFunctionData('decimals');

        const [symbolResult, decimalsResult] = await Promise.all([
            callRpc<string>(chainId, 'eth_call', [{ to: tokenAddress, data: symbolData }, 'latest']).catch(() => null),
            callRpc<string>(chainId, 'eth_call', [{ to: tokenAddress, data: decimalsData }, 'latest']).catch(() => null)
        ]);

        const symbol = symbolResult ? erc20Interface.decodeFunctionResult('symbol', symbolResult)[0] : undefined;
        const decimals = decimalsResult ? Number(erc20Interface.decodeFunctionResult('decimals', decimalsResult)[0]) : undefined;

        return { symbol, decimals };
    } catch {
        return {};
    }
}

/**
 * Calculate price from sqrtPriceX96
 */
function calculatePriceFromSqrtX96(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
    const Q96 = BigInt(2) ** BigInt(96);
    const price = Number(sqrtPriceX96) / Number(Q96);
    const priceSquared = price * price;
    const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
    return priceSquared * decimalAdjustment;
}

/**
 * Find all pools for a token pair across multiple DEXes
 */
export async function findTokenPools(
    tokenA: string,
    tokenB: string,
    chainId: number
): Promise<PoolInfo[]> {
    const pools: PoolInfo[] = [];

    // Normalize addresses to ensure proper checksum
    const normalizedTokenA = ethers.getAddress(tokenA.toLowerCase());
    const normalizedTokenB = ethers.getAddress(tokenB.toLowerCase());

    // V3 fee tiers to check (100 = 0.01%, 500 = 0.05%, 3000 = 0.3%, 10000 = 1%)
    const v3Fees = [100, 500, 3000, 10000];

    // Factory addresses by chain
    const factories: Record<number, { v2?: string; v3?: string; aerodrome?: string }> = {
        1: {
            v2: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',  // Uniswap V2
            v3: '0x1F98431c8aD98523631AE4a59f267346ea31F984'   // Uniswap V3
        },
        8453: {
            v2: '0x8909Dc15e40173FF4699343b6eB8132c65e18eC6',  // Uniswap V2 on Base
            v3: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',  // Uniswap V3 on Base
            aerodrome: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da' // Aerodrome
        },
        56: {
            v2: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',  // PancakeSwap V2
            v3: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'   // PancakeSwap V3
        }
    };

    const factory = factories[chainId];
    if (!factory) {
        return pools;
    }

    // Check V2 pool
    if (factory.v2) {
        try {
            const pairData = v2FactoryInterface.encodeFunctionData('getPair', [normalizedTokenA, normalizedTokenB]);
            const pairResult = await callRpc<string>(chainId, 'eth_call', [{
                to: factory.v2,
                data: pairData
            }, 'latest']);

            if (pairResult && pairResult !== '0x' + '0'.repeat(64)) {
                const pairAddress = ethers.getAddress('0x' + pairResult.slice(-40));
                const poolInfo = await getV2PoolInfo(pairAddress, chainId);
                if (poolInfo && BigInt(poolInfo.reserve0 || '0') > 0) {
                    pools.push(poolInfo);
                }
            }
        } catch { }
    }

    // Check V3 pools (multiple fee tiers) - 并行查询
    if (factory.v3) {
        const v3Results = await Promise.all(
            v3Fees.map(async (fee) => {
                try {
                    const poolData = v3FactoryInterface.encodeFunctionData('getPool', [normalizedTokenA, normalizedTokenB, fee]);
                    const poolResult = await callRpc<string>(chainId, 'eth_call', [{
                        to: factory.v3,
                        data: poolData
                    }, 'latest']);

                    if (poolResult && poolResult !== '0x' + '0'.repeat(64)) {
                        const poolAddress = ethers.getAddress('0x' + poolResult.slice(-40));
                        const poolInfo = await getV3PoolInfo(poolAddress, chainId);
                        if (poolInfo && BigInt(poolInfo.liquidity || '0') > 0) {
                            return poolInfo;
                        }
                    }
                } catch { }
                return null;
            })
        );
        pools.push(...v3Results.filter((p): p is PoolInfo => p !== null));
    }

    // Check Aerodrome pools (stable/volatile)
    if (factory.aerodrome) {
        const aeroResults = await Promise.all(
            [false, true].map(async (stable) => {
                try {
                    const poolData = aerodromeFactoryInterface.encodeFunctionData('getPool', [
                        normalizedTokenA,
                        normalizedTokenB,
                        stable
                    ]);
                    const poolResult = await callRpc<string>(chainId, 'eth_call', [{
                        to: factory.aerodrome,
                        data: poolData
                    }, 'latest']);

                    if (poolResult && poolResult !== '0x' + '0'.repeat(64)) {
                        const poolAddress = ethers.getAddress('0x' + poolResult.slice(-40));
                        const poolInfo = await getV2PoolInfo(poolAddress, chainId);
                        if (poolInfo && BigInt(poolInfo.reserve0 || '0') > 0) {
                            return {
                                ...poolInfo,
                                version: 'aerodrome'
                            } as PoolInfo;
                        }
                    }
                } catch { }
                return null;
            })
        );
        pools.push(...aeroResults.filter((p): p is PoolInfo => p !== null));
    }

    // Check V4 pools (纯链上 - 计算 PoolId)
    if (isV4Supported(chainId)) {
        try {
            const v4Pools = await findV4Pools(tokenA, tokenB, chainId);
            for (const v4Pool of v4Pools) {
                pools.push({
                    poolAddress: v4Pool.poolId,
                    token0: v4Pool.poolKey.currency0,
                    token1: v4Pool.poolKey.currency1,
                    liquidity: v4Pool.liquidity,
                    sqrtPriceX96: v4Pool.sqrtPriceX96,
                    fee: v4Pool.lpFee,
                    price: v4CalcPrice(
                        BigInt(v4Pool.sqrtPriceX96),
                        18,
                        18
                    ),
                    version: 'v4'
                });
            }
        } catch (err) {
            logger.debug(LogCode.API_FETCH_FAILED, 'V4 pool lookup failed', {
                error: (err as Error).message?.substring(0, 100)
            });
        }
    }

    return pools;
}

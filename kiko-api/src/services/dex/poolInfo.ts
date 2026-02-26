/**
 * DEX Pool Information Service
 * Reads on-chain liquidity data directly from DEX pools
 * Replaces DEX Screener API dependency
 */

import { ethers } from 'ethers';
import { callRpc as callRpcRaw } from '../rpcManager.js';
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
    dex?: 'uniswap' | 'pancake' | 'aerodrome';   // DEX family
}

const v2PoolInterface = new ethers.Interface(V2_POOL_ABI);
const v3PoolInterface = new ethers.Interface(V3_POOL_ABI);
const v2FactoryInterface = new ethers.Interface(V2_FACTORY_ABI);
const v3FactoryInterface = new ethers.Interface(V3_FACTORY_ABI);
const aerodromeFactoryInterface = new ethers.Interface(AERODROME_FACTORY_ABI);
const erc20Interface = new ethers.Interface(ERC20_ABI);

type PoolLookupOptions = {
    fastScan?: boolean;
};

async function callRpc<T = any>(
    chainId: number,
    method: string,
    params: any[],
    options?: PoolLookupOptions
): Promise<T> {
    return await callRpcRaw<T>(chainId, method, params, {
        strategy: 'fast',
        importance: 'critical',
        exhaustiveFailover: true
    });
}

/**
 * Get V2 pool information
 */
async function getV2PoolInfoInternal(
    poolAddress: string,
    chainId: number,
    options?: { fastScan?: boolean; includeMetadata?: boolean }
): Promise<PoolInfo | null> {
    try {
        const includeMetadata = options?.includeMetadata !== false;
        // 一次并行拉取: getReserves + token0 + token1
        const reservesData = v2PoolInterface.encodeFunctionData('getReserves');
        const token0Data = v2PoolInterface.encodeFunctionData('token0');
        const token1Data = v2PoolInterface.encodeFunctionData('token1');

        const [reservesResult, token0Result, token1Result] = await Promise.all([
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: reservesData }, 'latest'], options),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: token0Data }, 'latest'], options),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: token1Data }, 'latest'], options)
        ]);

        if (!reservesResult || reservesResult === '0x' || !token0Result || !token1Result) {
            return null;
        }

        const decoded = v2PoolInterface.decodeFunctionResult('getReserves', reservesResult);
        const reserve0 = decoded[0] as bigint;
        const reserve1 = decoded[1] as bigint;

        const token0 = ethers.getAddress('0x' + token0Result!.slice(-40));
        const token1 = ethers.getAddress('0x' + token1Result!.slice(-40));

        let token0Meta: { symbol?: string; decimals?: number } = {};
        let token1Meta: { symbol?: string; decimals?: number } = {};
        if (includeMetadata) {
            [token0Meta, token1Meta] = await Promise.all([
                getTokenMetadata(token0, chainId),
                getTokenMetadata(token1, chainId)
            ]);
        }

        const price = includeMetadata && token0Meta.decimals && token1Meta.decimals
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
            price: includeMetadata ? price : undefined,
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

export async function getV2PoolInfo(
    poolAddress: string,
    chainId: number
): Promise<PoolInfo | null> {
    return await getV2PoolInfoInternal(poolAddress, chainId, { includeMetadata: true, fastScan: false });
}

async function getV2PoolInfoLite(
    poolAddress: string,
    chainId: number
): Promise<PoolInfo | null> {
    return await getV2PoolInfoInternal(poolAddress, chainId, { includeMetadata: false, fastScan: true });
}

/**
 * Get V3 pool information
 */
async function getV3PoolInfoInternal(
    poolAddress: string,
    chainId: number,
    options?: { fastScan?: boolean; includeMetadata?: boolean }
): Promise<PoolInfo | null> {
    try {
        const includeMetadata = options?.includeMetadata !== false;
        // 一次并行拉取所有静态字段: liquidity, slot0, fee, token0, token1
        const liquidityData = v3PoolInterface.encodeFunctionData('liquidity');
        const slot0Data = v3PoolInterface.encodeFunctionData('slot0');
        const feeData = v3PoolInterface.encodeFunctionData('fee');
        const token0Data = v3PoolInterface.encodeFunctionData('token0');
        const token1Data = v3PoolInterface.encodeFunctionData('token1');

        const [liquidityResult, slot0Result, feeResult, token0Result, token1Result] = await Promise.all([
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: liquidityData }, 'latest'], options),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: slot0Data }, 'latest'], options),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: feeData }, 'latest'], options),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: token0Data }, 'latest'], options),
            callRpc<string>(chainId, 'eth_call', [{ to: poolAddress, data: token1Data }, 'latest'], options)
        ]);

        if (!liquidityResult || !slot0Result || !token0Result || !token1Result) {
            return null;
        }

        const liquidity = v3PoolInterface.decodeFunctionResult('liquidity', liquidityResult)[0] as bigint;
        const slot0 = v3PoolInterface.decodeFunctionResult('slot0', slot0Result);
        const sqrtPriceX96 = slot0[0] as bigint;
        const fee = feeResult ? Number(v3PoolInterface.decodeFunctionResult('fee', feeResult)[0]) : 0;

        const token0 = ethers.getAddress('0x' + token0Result!.slice(-40));
        const token1 = ethers.getAddress('0x' + token1Result!.slice(-40));

        let token0Meta: { symbol?: string; decimals?: number } = {};
        let token1Meta: { symbol?: string; decimals?: number } = {};
        if (includeMetadata) {
            [token0Meta, token1Meta] = await Promise.all([
                getTokenMetadata(token0, chainId),
                getTokenMetadata(token1, chainId)
            ]);
        }

        const price = includeMetadata
            ? v4CalcPrice(sqrtPriceX96, token0Meta.decimals || 18, token1Meta.decimals || 18)
            : 0;

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
            price: includeMetadata ? price : undefined,
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

export async function getV3PoolInfo(
    poolAddress: string,
    chainId: number
): Promise<PoolInfo | null> {
    return await getV3PoolInfoInternal(poolAddress, chainId, { includeMetadata: true, fastScan: false });
}

async function getV3PoolInfoLite(
    poolAddress: string,
    chainId: number
): Promise<PoolInfo | null> {
    return await getV3PoolInfoInternal(poolAddress, chainId, { includeMetadata: false, fastScan: true });
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

const POOL_DISCOVERY_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_POOL_DISCOVERY_CACHE_TTL_MS || '30000'); // 30s
const poolDiscoveryCache = new Map<string, { pools: PoolInfo[]; ts: number }>();
const poolDiscoveryInflight = new Map<string, Promise<PoolInfo[]>>();

/**
 * Calculate price from sqrtPriceX96
 */
/**
 * Find all pools for a token pair across multiple DEXes.
 * Results are cached and in-flight requests are deduplicated for the same pair (buy-path optimization).
 */
export async function findTokenPools(
    tokenA: string,
    tokenB: string,
    chainId: number,
    options?: PoolLookupOptions
): Promise<PoolInfo[]> {
    const key = `${chainId}:${tokenA.toLowerCase()}:${tokenB.toLowerCase()}:${options?.fastScan === true ? 'fast' : 'full'}`;
    const cached = poolDiscoveryCache.get(key);
    if (cached && Date.now() - cached.ts < POOL_DISCOVERY_CACHE_TTL_MS) {
        return cached.pools;
    }
    const inflight = poolDiscoveryInflight.get(key);
    if (inflight) return await inflight;

    const promise = doFindTokenPools(tokenA, tokenB, chainId, options);
    poolDiscoveryInflight.set(key, promise);
    try {
        const pools = await promise;
        poolDiscoveryCache.set(key, { pools, ts: Date.now() });
        return pools;
    } finally {
        poolDiscoveryInflight.delete(key);
    }
}

async function doFindTokenPools(
    tokenA: string,
    tokenB: string,
    chainId: number,
    options?: PoolLookupOptions
): Promise<PoolInfo[]> {
    // Normalize addresses to ensure proper checksum
    const normalizedTokenA = ethers.getAddress(tokenA.toLowerCase());
    const normalizedTokenB = ethers.getAddress(tokenB.toLowerCase());
    const fastScan = options?.fastScan === true;

    // Factory addresses by chain + DEX family
    const factories: Record<number, {
        v2?: { address: string; dex: 'uniswap' | 'pancake' };
        v3?: { address: string; dex: 'uniswap' | 'pancake'; feeTiers: number[] }[];
        aerodrome?: { address: string; dex: 'aerodrome' };
    }> = {
        1: {
            v2: { address: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', dex: 'uniswap' },  // Uniswap V2
            v3: [{ address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', dex: 'uniswap', feeTiers: [100, 500, 3000, 10000] }]
        },
        8453: {
            v2: { address: '0x8909Dc15e40173FF4699343b6eB8132c65e18eC6', dex: 'uniswap' },  // Uniswap V2 on Base
            v3: [{ address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', dex: 'uniswap', feeTiers: [100, 500, 3000, 10000] }],
            aerodrome: { address: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da', dex: 'aerodrome' } // Aerodrome
        },
        56: {
            v2: { address: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', dex: 'pancake' },  // PancakeSwap V2
            v3: [
                { address: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865', dex: 'pancake', feeTiers: [100, 500, 2500, 10000] }
            ]
        }
    };

    const factory = factories[chainId];
    if (!factory) {
        return [];
    }

    // 所有 DEX 类型全部并行发起，不再等 V2 完成才查 V3
    const ZERO_ADDR = '0x' + '0'.repeat(64);

    const v2Promise: Promise<PoolInfo | null> = (async () => {
        if (!factory.v2) return null;
        try {
            const pairData = v2FactoryInterface.encodeFunctionData('getPair', [normalizedTokenA, normalizedTokenB]);
            const pairResult = await callRpc<string>(chainId, 'eth_call', [{
                to: factory.v2!.address,
                data: pairData
            }, 'latest'], { fastScan });
            if (!pairResult || pairResult === ZERO_ADDR) return null;
            const pairAddress = ethers.getAddress('0x' + pairResult.slice(-40));
            const poolInfo = fastScan
                ? await getV2PoolInfoLite(pairAddress, chainId)
                : await getV2PoolInfo(pairAddress, chainId);
            if (poolInfo && BigInt(poolInfo.reserve0 || '0') > 0) {
                poolInfo.dex = factory.v2!.dex;
                return poolInfo;
            }
        } catch { }
        return null;
    })();

    const v3Promise: Promise<PoolInfo[]> = (async () => {
        if (!factory.v3?.length) return [];
        const results = await Promise.all(
            factory.v3.flatMap((v3Factory) =>
                v3Factory.feeTiers.map(async (fee) => {
                    try {
                        const poolData = v3FactoryInterface.encodeFunctionData('getPool', [normalizedTokenA, normalizedTokenB, fee]);
                        const poolResult = await callRpc<string>(chainId, 'eth_call', [{
                            to: v3Factory.address,
                            data: poolData
                        }, 'latest'], { fastScan });
                        if (!poolResult || poolResult === ZERO_ADDR) return null;
                        const poolAddress = ethers.getAddress('0x' + poolResult.slice(-40));
                        const poolInfo = fastScan
                            ? await getV3PoolInfoLite(poolAddress, chainId)
                            : await getV3PoolInfo(poolAddress, chainId);
                        if (poolInfo && BigInt(poolInfo.liquidity || '0') > 0) {
                            poolInfo.dex = v3Factory.dex;
                            return poolInfo;
                        }
                    } catch { }
                    return null;
                })
            )
        );
        return results.filter((p): p is PoolInfo => p !== null);
    })();

    const aerodromePromise: Promise<PoolInfo[]> = (async () => {
        if (!factory.aerodrome) return [];
        const aerodromeFactory = factory.aerodrome;
        const results = await Promise.all(
            [false, true].map(async (stable) => {
                try {
                    const poolData = aerodromeFactoryInterface.encodeFunctionData('getPool', [
                        normalizedTokenA,
                        normalizedTokenB,
                        stable
                    ]);
                    const poolResult = await callRpc<string>(chainId, 'eth_call', [{
                        to: aerodromeFactory.address,
                        data: poolData
                    }, 'latest'], { fastScan });
                    if (!poolResult || poolResult === ZERO_ADDR) return null;
                    const poolAddress = ethers.getAddress('0x' + poolResult.slice(-40));
                    const poolInfo = fastScan
                        ? await getV2PoolInfoLite(poolAddress, chainId)
                        : await getV2PoolInfo(poolAddress, chainId);
                    if (poolInfo && BigInt(poolInfo.reserve0 || '0') > 0) {
                        poolInfo.dex = aerodromeFactory.dex;
                        return { ...poolInfo, version: 'aerodrome' } as PoolInfo;
                    }
                } catch { }
                return null;
            })
        );
        return results.filter((p): p is PoolInfo => p !== null);
    })();

    const v4Promise: Promise<PoolInfo[]> = (async () => {
        if (!isV4Supported(chainId)) return [];
        try {
            const v4Pools = await findV4Pools(tokenA, tokenB, chainId);
            return v4Pools.map((v4Pool) => ({
                poolAddress: v4Pool.poolId,
                token0: v4Pool.poolKey.currency0,
                token1: v4Pool.poolKey.currency1,
                liquidity: v4Pool.liquidity,
                sqrtPriceX96: v4Pool.sqrtPriceX96,
                fee: v4Pool.lpFee,
                price: v4CalcPrice(BigInt(v4Pool.sqrtPriceX96), 18, 18),
                version: 'v4' as const,
                dex: 'uniswap' as const
            }));
        } catch (err) {
            logger.debug(LogCode.API_FETCH_FAILED, 'V4 pool lookup failed', {
                error: (err as Error).message?.substring(0, 100)
            });
            return [];
        }
    })();

    // 等待所有并行任务完成
    const [v2Pool, v3Pools, aeroPools, v4Pools] = await Promise.all([
        v2Promise,
        v3Promise,
        aerodromePromise,
        v4Promise
    ]);

    const pools: PoolInfo[] = [];
    if (v2Pool) pools.push(v2Pool);
    pools.push(...v3Pools, ...aeroPools, ...v4Pools);
    return pools;
}

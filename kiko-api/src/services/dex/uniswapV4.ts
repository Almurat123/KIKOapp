/**
 * Uniswap V4 Pool Information Service - 纯链上实现
 * 
 * V4 架构:
 * - PoolId = keccak256(abi.encode(PoolKey))
 * - PoolKey = {currency0, currency1, fee, tickSpacing, hooks}
 * - 通过计算 PoolId 直接查询 StateView
 * 
 * [Ref]: https://docs.uniswap.org/contracts/v4/reference/core/types/PoolId
 * [Logic]: 遍历常见配置计算 PoolId，查询 StateView 验证池子存在
 */

import { ethers } from 'ethers';
import { callRpc as callRpcRaw } from '../rpcManager.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { CLANKER_HOOKS_BY_CHAIN, getKnownV4HooksByChain, resolveV4HookProfile } from './v4Hooks.js';

// StateView ABI
const V4_STATE_VIEW_ABI = [
    'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
    'function getLiquidity(bytes32 poolId) view returns (uint128)'
];

// StateView 地址 (官方部署地址)
// [Ref]: https://docs.uniswap.org/contracts/v4/deployments
export const V4_STATE_VIEW: Record<number, string> = {
    1:     '0x7ffe42c4a5deea5b0fec41c94c136cf115597227', // Ethereum (updated)
    8453:  '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71', // Base
    56:    '0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4', // BSC (Uniswap V4)
    42161: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990', // Arbitrum
    10:    '0xc18a3169788f4f75a170290584eca6395c75ecdb', // Optimism
};

const stateViewInterface = new ethers.Interface(V4_STATE_VIEW_ABI);

const CLANKER_HOOKS_BASE = CLANKER_HOOKS_BY_CHAIN[8453] || [];
// [Ref]: Clanker 使用 DYNAMIC_FEE_FLAG (0x800000) 作为 fee
const DYNAMIC_FEE_FLAG = 0x800000;

const CLANKER_HOOKS_DYNAMIC_BASE = [
    '0xd60d6b218116cfd801e28f78d011a203d2b068cc', // ClankerHookDynamicFeeV2 v4.1.0
    '0x34a45c6b61876d739400bd71228cbcbd4f53e8cc', // ClankerHookDynamicFee v4.0.0
    '0x7debe6943acefe85c4ee81aadd736466e07528cc', // Clanker hook variant (dynamic fee)
];
const CLANKER_HOOKS_STATIC_BASE = [
    '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc', // ClankerHookStaticFeeV2 v4.1.0
    '0xdd5eeaff7bd481ad55db083062b13a3cdf0a68cc', // ClankerHookStaticFee v4.0.0
];
const CLANKER_FEE_TICK_SPACING = [
    { fee: DYNAMIC_FEE_FLAG, tickSpacing: 200 },
    { fee: 500, tickSpacing: 10 },
    { fee: 3000, tickSpacing: 60 },
    { fee: 10000, tickSpacing: 200 },
    // Wider net for Clanker variants seen in the wild
    { fee: 2500, tickSpacing: 50 },
    { fee: 1000, tickSpacing: 20 },
];

const KNOWN_HOOKS_BASE = getKnownV4HooksByChain(8453);
const KNOWN_DYNAMIC_FEE_HOOKS_BASE = KNOWN_HOOKS_BASE;
const DYNAMIC_FEE_TICK_SPACING_BASE = [40, 60, 200, 300, 1000];

// V4 配置

interface V4PoolConfig {
    fee: number;
    tickSpacing: number;
    hooks: string[];
}

// 常见 V4 配置 - 精简版 (只保留最常用)
const V4_CONFIGS: Record<number, V4PoolConfig[]> = {
    8453: [ // Base
        // Clanker hooks (dynamic + static) - try multiple fee/tick combos
        ...CLANKER_FEE_TICK_SPACING.map(cfg => ({ ...cfg, hooks: CLANKER_HOOKS_DYNAMIC_BASE })),
        ...CLANKER_FEE_TICK_SPACING.map(cfg => ({ ...cfg, hooks: CLANKER_HOOKS_STATIC_BASE })),

        // Common static fee tiers (hookless + known hooks from registry)
        // Fee=0 pools are observed on Base in some flaunch-style hooks.
        { fee: 0, tickSpacing: 60, hooks: ['0x0000000000000000000000000000000000000000', ...KNOWN_HOOKS_BASE] },
        { fee: 100, tickSpacing: 1, hooks: ['0x0000000000000000000000000000000000000000', ...KNOWN_HOOKS_BASE] },
        { fee: 500, tickSpacing: 10, hooks: ['0x0000000000000000000000000000000000000000', ...KNOWN_HOOKS_BASE] },
        { fee: 3000, tickSpacing: 60, hooks: ['0x0000000000000000000000000000000000000000', ...KNOWN_HOOKS_BASE] },
        { fee: 10000, tickSpacing: 200, hooks: ['0x0000000000000000000000000000000000000000', ...KNOWN_HOOKS_BASE] },
        { fee: 50000, tickSpacing: 1000, hooks: ['0x0000000000000000000000000000000000000000', ...KNOWN_HOOKS_BASE] },
        // Dynamic fee hooks (covers newer hook families using DYNAMIC_FEE_FLAG)
        ...DYNAMIC_FEE_TICK_SPACING_BASE.map((tickSpacing) => ({
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing,
            hooks: KNOWN_DYNAMIC_FEE_HOOKS_BASE
        })),
    ],
    1: [ // Ethereum
        { fee: 100, tickSpacing: 1, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 500, tickSpacing: 10, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 3000, tickSpacing: 60, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 10000, tickSpacing: 200, hooks: ['0x0000000000000000000000000000000000000000'] },
    ],
    56: [ // BSC - Uniswap V4 (deployed separately from PancakeSwap)
        { fee: 100, tickSpacing: 1, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 500, tickSpacing: 10, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 3000, tickSpacing: 60, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 10000, tickSpacing: 200, hooks: ['0x0000000000000000000000000000000000000000'] },
    ],
};

const V4_POOL_CACHE_TTL = 30000; // 30s cache
const v4PoolCache = new Map<string, { pools: V4PoolInfo[]; timestamp: number }>();
const v4PoolInflight = new Map<string, Promise<V4PoolInfo[]>>();

const BASE_V4_ZERO_LIQ_HOOK_FAMILIES = new Set(['clanker', 'doppler', 'flaunch', 'zora', 'custom']);
const V4_FAST_DISCOVERY_WINDOW_MS = Number(process.env.V4_FAST_DISCOVERY_WINDOW_MS || '650');
const V4_FAST_DISCOVERY_BATCH_SIZE = Number(process.env.V4_FAST_DISCOVERY_BATCH_SIZE || '18');

function baseFastPriorityScore(poolKey: V4PoolKey): number {
    if (poolKey.fee === DYNAMIC_FEE_FLAG && poolKey.tickSpacing === 200) return 0;
    if (poolKey.fee === DYNAMIC_FEE_FLAG) return 1;
    if (poolKey.fee === 10000 && poolKey.tickSpacing === 200) return 2;
    if (poolKey.fee === 3000 && poolKey.tickSpacing === 60) return 3;
    if (poolKey.fee === 500 && poolKey.tickSpacing === 10) return 4;
    if (poolKey.fee === 0 && poolKey.tickSpacing === 60) return 5;
    return 9;
}

async function callRpc<T = any>(
    chainId: number,
    method: string,
    params: any,
    options?: { strategy?: 'fast' | 'cheap' }
): Promise<T> {
    return callRpcRaw<T>(chainId, method, params, {
        strategy: options?.strategy || 'fast',
        importance: 'critical',
        exhaustiveFailover: true
    });
}

export interface V4PoolKey {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
}

export interface V4PoolInfo {
    poolId: string;
    poolKey: V4PoolKey;
    sqrtPriceX96: string;
    tick: number;
    liquidity: string;
    protocolFee: number;
    lpFee: number;
}

/**
 * Try to resolve a PoolKey by matching a known poolId against common configs.
 * This is useful when payloads include poolId + hook + token pair but not fee/tickSpacing.
 */
export function matchV4PoolKeyById(
    chainId: number,
    poolId: string,
    tokenA: string,
    tokenB: string,
    hookHint?: string | null
): V4PoolKey | null {
    const configs = V4_CONFIGS[chainId];
    if (!configs) return null;
    if (!poolId || !tokenA || !tokenB) return null;

    const normalizedPoolId = poolId.toLowerCase();
    const hookNormalized = hookHint ? hookHint.toLowerCase() : null;

    const [currency0, currency1] =
        BigInt(tokenA) < BigInt(tokenB)
            ? [tokenA, tokenB]
            : [tokenB, tokenA];

    for (const config of configs) {
        const hooksToTry = hookNormalized ? [hookNormalized] : config.hooks;
        for (const hooks of hooksToTry) {
            const poolKey: V4PoolKey = {
                currency0,
                currency1,
                fee: config.fee,
                tickSpacing: config.tickSpacing,
                hooks
            };
            const candidate = computePoolId(poolKey).toLowerCase();
            if (candidate === normalizedPoolId) return poolKey;
        }
    }

    return null;
}

/**
 * 计算 PoolId
 * [Logic]: PoolId = keccak256(abi.encode(PoolKey))
 * [Ref]: https://docs.uniswap.org/contracts/v4/reference/core/types/PoolId
 */
export function computePoolId(poolKey: V4PoolKey): string {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abiCoder.encode(
        ['address', 'address', 'uint24', 'int24', 'address'],
        [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    );
    return ethers.keccak256(encoded);
}

/**
 * 查询 V4 池子信息
 * [Risk]: PoolId 必须有效，否则返回 null
 */
export async function getV4PoolInfo(
    poolKey: V4PoolKey,
    chainId: number,
    options?: { strategy?: 'fast' | 'cheap' }
): Promise<V4PoolInfo | null> {
    const stateView = V4_STATE_VIEW[chainId];
    if (!stateView) return null;

    const poolId = computePoolId(poolKey);

    try {
        // 并行查询 Slot0 + Liquidity (同一个 stateView，同一个 poolId)
        const slot0Data = stateViewInterface.encodeFunctionData('getSlot0', [poolId]);
        const liquidityData = stateViewInterface.encodeFunctionData('getLiquidity', [poolId]);

        const [slot0Result, liquidityResult] = await Promise.all([
            callRpc<string>(chainId, 'eth_call', [{
                to: stateView,
                data: slot0Data
            }, 'latest'], options),
            callRpc<string>(chainId, 'eth_call', [{
                to: stateView,
                data: liquidityData
            }, 'latest'], options)
        ]);

        if (!slot0Result || slot0Result === '0x' || slot0Result.length < 66) {
            return null;
        }

        const slot0 = stateViewInterface.decodeFunctionResult('getSlot0', slot0Result);
        const sqrtPriceX96 = slot0[0] as bigint;

        // sqrtPriceX96 = 0 表示池子未初始化
        if (sqrtPriceX96 === BigInt(0)) {
            return null;
        }

        const tick = Number(slot0[1]);
        const protocolFee = Number(slot0[2]);
        const lpFee = Number(slot0[3]);

        const liquidity = liquidityResult && liquidityResult !== '0x'
            ? BigInt(liquidityResult)
            : BigInt(0);

        return {
            poolId,
            poolKey,
            sqrtPriceX96: sqrtPriceX96.toString(),
            tick,
            liquidity: liquidity.toString(),
            protocolFee,
            lpFee
        };
    } catch (err: any) {
        return null;
    }
}

/**
 * 查找 V4 池子 (纯链上)
 * [Logic]: 遍历常见配置计算 PoolId 并验证
 */
export async function findV4Pools(
    tokenA: string,
    tokenB: string,
    chainId: number,
    options?: { strategy?: 'fast' | 'cheap' }
): Promise<V4PoolInfo[]> {
    const configs = V4_CONFIGS[chainId];
    if (!configs) return [];

    const cacheKey = `${chainId}:${tokenA.toLowerCase()}:${tokenB.toLowerCase()}`;
    const cached = v4PoolCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < V4_POOL_CACHE_TTL) {
        return cached.pools;
    }

    const inflight = v4PoolInflight.get(cacheKey);
    if (inflight) {
        return await inflight;
    }

    // 排序 tokens
    const [currency0, currency1] =
        BigInt(tokenA) < BigInt(tokenB)
            ? [tokenA, tokenB]
            : [tokenB, tokenA];

    // 生成所有 PoolKey 组合
    const poolKeys: V4PoolKey[] = [];
    for (const config of configs) {
        for (const hooks of config.hooks) {
            poolKeys.push({
                currency0,
                currency1,
                fee: config.fee,
                tickSpacing: config.tickSpacing,
                hooks
            });
        }
    }

    const promise = (async () => {
        const isFastStrategy = options?.strategy === 'fast';
        const shouldKeepPool = (pool: V4PoolInfo | null): pool is V4PoolInfo => {
            if (!pool) return false;
            if (BigInt(pool.liquidity) > 0n) return true;
            if (chainId !== 8453) return false;
            const family = resolveV4HookProfile(chainId, pool.poolKey.hooks).family;
            return BASE_V4_ZERO_LIQ_HOOK_FAMILIES.has(family);
        };

        const collect = (items: Array<V4PoolInfo | null>): V4PoolInfo[] => {
            const deduped = new Map<string, V4PoolInfo>();
            for (const pool of items) {
                if (!shouldKeepPool(pool)) continue;
                deduped.set(pool.poolId.toLowerCase(), pool);
            }
            return Array.from(deduped.values());
        };

        let pools: V4PoolInfo[] = [];

        if (isFastStrategy && chainId === 8453) {
            const dynamic200Hooks = Array.from(new Set(KNOWN_DYNAMIC_FEE_HOOKS_BASE.map((h) => h.toLowerCase())));
            const dynamic200Keys: V4PoolKey[] = dynamic200Hooks.map((hooks) => ({
                currency0,
                currency1,
                fee: DYNAMIC_FEE_FLAG,
                tickSpacing: 200,
                hooks
            }));
            if (dynamic200Keys.length > 0) {
                const dynamicHits = await Promise.all(
                    dynamic200Keys.map((poolKey) => getV4PoolInfo(poolKey, chainId, options).catch(() => null))
                );
                const dynamicPools = collect(dynamicHits);
                if (dynamicPools.length > 0) {
                    pools = dynamicPools;
                }
            }
        }

        if (isFastStrategy && chainId === 8453 && pools.length === 0) {
            const sorted = [...poolKeys].sort((a, b) => {
                const byScore = baseFastPriorityScore(a) - baseFastPriorityScore(b);
                if (byScore !== 0) return byScore;
                const aZeroHook = a.hooks === '0x0000000000000000000000000000000000000000' ? 1 : 0;
                const bZeroHook = b.hooks === '0x0000000000000000000000000000000000000000' ? 1 : 0;
                return aZeroHook - bZeroHook;
            });
            const startedAt = Date.now();
            const batchSize = Math.max(4, V4_FAST_DISCOVERY_BATCH_SIZE);
            for (let i = 0; i < sorted.length; i += batchSize) {
                if (Date.now() - startedAt >= V4_FAST_DISCOVERY_WINDOW_MS) break;
                const batch = sorted.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map((poolKey) => getV4PoolInfo(poolKey, chainId, options).catch(() => null))
                );
                const hit = collect(batchResults);
                if (hit.length > 0) {
                    pools = hit;
                    break;
                }
            }
        }

        if (pools.length === 0) {
            const results = await Promise.all(
                poolKeys.map(poolKey => getV4PoolInfo(poolKey, chainId, options).catch(() => null))
            );
            pools = collect(results);
        }

        v4PoolCache.set(cacheKey, { pools, timestamp: Date.now() });
        return pools;
    })();

    v4PoolInflight.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        v4PoolInflight.delete(cacheKey);
    }
}

/**
 * 计算价格
 */
export function calculatePriceFromSqrtX96(
    sqrtPriceX96: bigint,
    decimals0: number,
    decimals1: number
): number {
    const Q96 = BigInt(2) ** BigInt(96);
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    const priceRaw = sqrtPrice * sqrtPrice;
    const decimalAdjustment = 10 ** (decimals0 - decimals1);
    return priceRaw * decimalAdjustment;
}

/**
 * 检查 V4 支持
 */
export function isV4Supported(chainId: number): boolean {
    return chainId in V4_STATE_VIEW;
}

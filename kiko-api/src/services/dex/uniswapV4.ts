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
import { callRpc } from '../rpcManager.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { CLANKER_HOOKS_BY_CHAIN } from './v4Hooks.js';

// StateView ABI
const V4_STATE_VIEW_ABI = [
    'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
    'function getLiquidity(bytes32 poolId) view returns (uint128)'
];

// StateView 地址
export const V4_STATE_VIEW: Record<number, string> = {
    1: '0x000000002e0D16f0FF88E0bAD58f69B47c8656e9',
    8453: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
    42161: '0x76fd297e2D437cd7f76d50F01AfE6160f86e8557',
    10: '0xc18a3169788f4f75a170290584eca6395c75ecdb',
};

const stateViewInterface = new ethers.Interface(V4_STATE_VIEW_ABI);

const CLANKER_HOOKS_BASE = CLANKER_HOOKS_BY_CHAIN[8453] || [];
const CLANKER_HOOKS_DYNAMIC_BASE = [
    '0xd60d6b218116cfd801e28f78d011a203d2b068cc', // ClankerHookDynamicFeeV2 v4.1.0
    '0x34a45c6b61876d739400bd71228cbcbd4f53e8cc', // ClankerHookDynamicFee v4.0.0
];
const CLANKER_HOOKS_STATIC_BASE = [
    '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc', // ClankerHookStaticFeeV2 v4.1.0
    '0xdd5eeaff7bd481ad55db083062b13a3cdf0a68cc', // ClankerHookStaticFee v4.0.0
];

// Zora Creator Coin Hooks (Base)
const ZORA_HOOKS_BASE = [
    '0xd61A675F8a0c67A73DC3B54FB7318B4D91409040', // Original Creator Coin Hook
    '0xc8d077444625eb300a427a6dfb2b1dbf9b159040', // Newer Creator Coin Hook
    '0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040', // New Creator Coin Hook
];

// V4 配置
// [Ref]: Clanker 使用 DYNAMIC_FEE_FLAG (0x800000) 作为 fee
const DYNAMIC_FEE_FLAG = 0x800000;

interface V4PoolConfig {
    fee: number;
    tickSpacing: number;
    hooks: string[];
}

// 常见 V4 配置 - 精简版 (只保留最常用)
const V4_CONFIGS: Record<number, V4PoolConfig[]> = {
    8453: [ // Base
        // Dynamic fee (Clanker dynamic hooks)
        { fee: DYNAMIC_FEE_FLAG, tickSpacing: 200, hooks: CLANKER_HOOKS_DYNAMIC_BASE },

        // Static fee tiers (Clanker static hooks)
        { fee: 500, tickSpacing: 10, hooks: CLANKER_HOOKS_STATIC_BASE },
        { fee: 3000, tickSpacing: 60, hooks: CLANKER_HOOKS_STATIC_BASE },
        { fee: 10000, tickSpacing: 200, hooks: CLANKER_HOOKS_STATIC_BASE },

        // Common static fee tiers (hookless + Zora hooks)
        { fee: 500, tickSpacing: 10, hooks: ['0x0000000000000000000000000000000000000000', ...ZORA_HOOKS_BASE] },
        { fee: 3000, tickSpacing: 60, hooks: ['0x0000000000000000000000000000000000000000', ...ZORA_HOOKS_BASE] },
        { fee: 10000, tickSpacing: 200, hooks: ['0x0000000000000000000000000000000000000000', ...ZORA_HOOKS_BASE] },
    ],
    1: [ // Ethereum
        { fee: 3000, tickSpacing: 60, hooks: ['0x0000000000000000000000000000000000000000'] },
    ]
};

const V4_POOL_CACHE_TTL = 30000; // 30s cache
const v4PoolCache = new Map<string, { pools: V4PoolInfo[]; timestamp: number }>();
const v4PoolInflight = new Map<string, Promise<V4PoolInfo[]>>();

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
        // 查询 Slot0
        const slot0Data = stateViewInterface.encodeFunctionData('getSlot0', [poolId]);
        const slot0Result = await callRpc<string>(chainId, 'eth_call', [{
            to: stateView,
            data: slot0Data
        }, 'latest'], options);

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

        // 查询 Liquidity
        const liquidityData = stateViewInterface.encodeFunctionData('getLiquidity', [poolId]);
        const liquidityResult = await callRpc<string>(chainId, 'eth_call', [{
            to: stateView,
            data: liquidityData
        }, 'latest'], options);

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
        const results = await Promise.all(
            poolKeys.map(poolKey => getV4PoolInfo(poolKey, chainId, options).catch(() => null))
        );

        const pools = results.filter((pool): pool is V4PoolInfo =>
            pool !== null && BigInt(pool.liquidity) > BigInt(0)
        );

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
    const priceRaw = (sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
    const decimalAdjustment = 10 ** (decimals0 - decimals1);
    return Number(priceRaw) * decimalAdjustment;
}

/**
 * 检查 V4 支持
 */
export function isV4Supported(chainId: number): boolean {
    return chainId in V4_STATE_VIEW;
}

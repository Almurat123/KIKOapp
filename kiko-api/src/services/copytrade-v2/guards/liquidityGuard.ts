import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getLiquidityFromCandidatePools, getTokenLiquidity } from '../../dex/directSwap/pipeline/poolLayer.js';
import { getV2PoolInfo, getV3PoolInfo, type PoolInfo } from '../../dex/poolInfo.js';
import { getV4PoolInfo, matchV4PoolKeyById, type V4PoolKey } from '../../dex/uniswapV4.js';
import { resolveSolanaDirectLiquidity } from '../../solana/direct/liquidity.js';
import type { SolDirectProvider } from '../../solana/direct/types.js';
import type { DecodedSwap } from '../../txDecoder.js';
import { getChainConfig } from '../../../config/chainConfig.js';

// Guard-level total budget is ~1200ms, so keep direct Solana liquidity bounded.
const COPYTRADE_SOL_LIQ_TIMEOUT_MS = Number(process.env.COPYTRADE_SOL_LIQ_TIMEOUT_MS || '650');
const COPYTRADE_SOL_LIQUIDITY_SCAN_ALL_POOLS = (process.env.COPYTRADE_SOL_LIQUIDITY_SCAN_ALL_POOLS || 'false') === 'true';

export type LiquidityGuardSnapshot = {
    liquidityUsd: number;
    source: 'target_pool_tvl' | 'direct_pool_tvl' | 'token_info_fallback' | 'direct_pool_unpriced' | 'unavailable';
    reliable: boolean;
    poolCount: number;
    fallbackUsed: boolean;
    metadata?: Record<string, unknown>;
};

type TargetPoolCandidate = {
    poolAddress: string;
    kind: string;
    v4PoolKey?: V4PoolKey;
};

type TargetPoolDeps = {
    getV2PoolInfo: typeof getV2PoolInfo;
    getV3PoolInfo: typeof getV3PoolInfo;
    getV4PoolInfo: typeof getV4PoolInfo;
};

type LiquidityGuardDeps = TargetPoolDeps & {
    getLiquidityFromCandidatePools: typeof getLiquidityFromCandidatePools;
    getTokenLiquidity: typeof getTokenLiquidity;
};

function normalizeHintToken(token: string | undefined, chainId: number): string {
    const normalized = String(token || '').trim().toLowerCase();
    if (!normalized) return normalized;
    if (chainId !== 900 && normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        return getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
    }
    return normalized;
}

function resolveV4PoolKeyForCandidate(
    candidate: Pick<TargetPoolCandidate, 'poolAddress' | 'kind'>,
    swap: DecodedSwap | undefined,
    chainId: number
): V4PoolKey | undefined {
    if (candidate.kind !== 'v4') return undefined;

    const hinted = swap?.resolvedPoolHint;
    if (hinted?.kind === 'v4' && hinted.poolAddress?.toLowerCase() === candidate.poolAddress.toLowerCase() && hinted.v4PoolKey) {
        return {
            currency0: hinted.v4PoolKey.currency0,
            currency1: hinted.v4PoolKey.currency1,
            hooks: hinted.v4PoolKey.hooks,
            fee: hinted.v4PoolKey.fee,
            tickSpacing: hinted.v4PoolKey.tickSpacing,
        };
    }

    const tokenIn = normalizeHintToken(swap?.tokenIn, chainId);
    const tokenOut = normalizeHintToken(swap?.tokenOut, chainId);
    if (!tokenIn || !tokenOut) return undefined;

    return matchV4PoolKeyById(chainId, candidate.poolAddress, tokenIn, tokenOut) || undefined;
}

async function loadTargetInteractedPools(
    swap: DecodedSwap | undefined,
    chainId: number,
    deps: TargetPoolDeps = { getV2PoolInfo, getV3PoolInfo, getV4PoolInfo }
): Promise<PoolInfo[]> {
    const candidates = new Map<string, TargetPoolCandidate>();
    const pushCandidate = (poolAddress: unknown, kind: unknown, v4PoolKey?: V4PoolKey) => {
        const address = String(poolAddress || '').trim();
        const version = String(kind || '').trim().toLowerCase();
        if (!address || !version) return;
        candidates.set(`${version}:${address.toLowerCase()}`, { poolAddress: address, kind: version, v4PoolKey });
    };

    const resolvedV4PoolKey = swap?.resolvedPoolHint?.kind === 'v4' && swap.resolvedPoolHint.v4PoolKey
        ? {
            currency0: swap.resolvedPoolHint.v4PoolKey.currency0,
            currency1: swap.resolvedPoolHint.v4PoolKey.currency1,
            hooks: swap.resolvedPoolHint.v4PoolKey.hooks,
            fee: swap.resolvedPoolHint.v4PoolKey.fee,
            tickSpacing: swap.resolvedPoolHint.v4PoolKey.tickSpacing,
        }
        : undefined;

    pushCandidate(swap?.resolvedPoolHint?.poolAddress, swap?.resolvedPoolHint?.kind, resolvedV4PoolKey);
    for (const hop of swap?.routeHops || []) {
        pushCandidate(hop?.poolAddress, hop?.kind, resolveV4PoolKeyForCandidate({
            poolAddress: String(hop?.poolAddress || ''),
            kind: String(hop?.kind || ''),
        }, swap, chainId));
    }

    const pools = await Promise.all(Array.from(candidates.values()).map(async ({ poolAddress, kind, v4PoolKey }) => {
        try {
            if (kind === 'v2' || kind === 'aerodrome') {
                const pool = await deps.getV2PoolInfo(poolAddress, chainId);
                if (!pool) return null;
                return kind === 'aerodrome' ? { ...pool, version: 'aerodrome' as const, dex: 'aerodrome' as const } : pool;
            }
            if (kind === 'v3') {
                return await deps.getV3PoolInfo(poolAddress, chainId);
            }
            if (kind === 'v4' && v4PoolKey) {
                const pool = await deps.getV4PoolInfo(v4PoolKey, chainId, { strategy: 'fast' });
                if (!pool) return null;
                return {
                    poolAddress: pool.poolId,
                    token0: pool.poolKey.currency0,
                    token1: pool.poolKey.currency1,
                    liquidity: pool.liquidity,
                    sqrtPriceX96: pool.sqrtPriceX96,
                    fee: pool.lpFee,
                    version: 'v4' as const,
                    dex: 'uniswap' as const,
                    v4PoolKey: {
                        currency0: pool.poolKey.currency0,
                        currency1: pool.poolKey.currency1,
                        fee: pool.poolKey.fee,
                        tickSpacing: pool.poolKey.tickSpacing,
                        hooks: pool.poolKey.hooks,
                    },
                } satisfies PoolInfo;
            }
            return null;
        } catch {
            return null;
        }
    }));

    return pools.filter((pool): pool is PoolInfo => Boolean(pool));
}

function normalizeFinitePositive(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function deriveSolanaPreferredProviders(swap: DecodedSwap | undefined): SolDirectProvider[] {
    const values = new Set<SolDirectProvider>();
    const router = String(swap?.router || '').trim();
    const dexName = String(swap?.dexName || '').toLowerCase();

    if (router === 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA' || dexName.includes('pumpswap')) {
        values.add('pumpswap');
    }
    if (router === '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P' || dexName.includes('pump.fun')) {
        values.add('pumpfun');
    }
    if (router === 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj' || dexName.includes('raydium') || dexName.includes('bonkfun')) {
        values.add('raydium_launchlab');
    }
    if (dexName.includes('meteora')) {
        values.add('meteora');
    }

    return Array.from(values);
}

export async function resolveBuyLiquidityGuardSnapshot(
    tokenAddress: string,
    chainId: number,
    tokenInfo: any,
    options?: {
        swap?: DecodedSwap;
        stopAtLiquidityUsd?: number;
        allowTokenInfoFallback?: boolean;
    },
    deps: LiquidityGuardDeps = {
        getV2PoolInfo,
        getV3PoolInfo,
        getV4PoolInfo,
        getLiquidityFromCandidatePools,
        getTokenLiquidity,
    }
): Promise<LiquidityGuardSnapshot> {
    const fallbackLiquidityUsd = normalizeFinitePositive(tokenInfo?.liquidity);
    const allowTokenInfoFallback = options?.allowTokenInfoFallback !== false;

    if (chainId === 900) {
        try {
            const tokenPriceUsd = normalizeFinitePositive(tokenInfo?.price);
            const preferredProviders = deriveSolanaPreferredProviders(options?.swap);
            const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), COPYTRADE_SOL_LIQ_TIMEOUT_MS));
            const directLiquidity = await Promise.race([
                resolveSolanaDirectLiquidity(tokenAddress, tokenPriceUsd, {
                    includeProgramScan: COPYTRADE_SOL_LIQUIDITY_SCAN_ALL_POOLS,
                    budgetMs: COPYTRADE_SOL_LIQ_TIMEOUT_MS,
                    skipDetection: true,
                    preferredProviders,
                    stopAtLiquidityUsd: normalizeFinitePositive(options?.stopAtLiquidityUsd),
                }),
                timeout,
            ]);
            const directLiquidityUsd = normalizeFinitePositive(directLiquidity?.liquidityUsd);
            const poolCount = Number(directLiquidity?.poolCount || 0);

            if (directLiquidityUsd > 0) {
                const directMetadata = (directLiquidity?.metadata as Record<string, unknown> | undefined) || undefined;
                return {
                    liquidityUsd: directLiquidityUsd,
                    source: 'direct_pool_tvl',
                    reliable: Boolean(directLiquidity?.reliable),
                    poolCount,
                    fallbackUsed: false,
                    metadata: {
                        ...(directMetadata || {}),
                        mode: preferredProviders.length > 0 ? 'target_provider_first' : 'multi_program_scan',
                        preferredProviders,
                        stopAtLiquidityUsd: normalizeFinitePositive(options?.stopAtLiquidityUsd) || undefined,
                    },
                };
            }

            if (allowTokenInfoFallback && fallbackLiquidityUsd > 0) {
                const directMetadata = (directLiquidity?.metadata as Record<string, unknown> | undefined) || undefined;
                return {
                    liquidityUsd: fallbackLiquidityUsd,
                    source: poolCount > 0 ? 'direct_pool_unpriced' : 'token_info_fallback',
                    reliable: true,
                    poolCount,
                    fallbackUsed: true,
                    metadata: {
                        ...(directMetadata || {}),
                        mode: preferredProviders.length > 0 ? 'target_provider_first' : 'multi_program_scan',
                        preferredProviders,
                        stopAtLiquidityUsd: normalizeFinitePositive(options?.stopAtLiquidityUsd) || undefined,
                    },
                };
            }

            return {
                liquidityUsd: 0,
                source: poolCount > 0 ? 'direct_pool_unpriced' : 'unavailable',
                reliable: false,
                poolCount,
                fallbackUsed: false,
                metadata: {
                    ...(((directLiquidity?.metadata as Record<string, unknown> | undefined) || undefined) || {}),
                    mode: preferredProviders.length > 0 ? 'target_provider_first' : 'multi_program_scan',
                    preferredProviders,
                    stopAtLiquidityUsd: normalizeFinitePositive(options?.stopAtLiquidityUsd) || undefined,
                },
            };
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, '[CopyTradeGuard] Solana direct liquidity lookup failed', {
                token: tokenAddress,
                chainId,
                error: error?.message || String(error)
            });

            return {
                liquidityUsd: allowTokenInfoFallback ? fallbackLiquidityUsd : 0,
                source: allowTokenInfoFallback && fallbackLiquidityUsd > 0 ? 'token_info_fallback' : 'unavailable',
                reliable: allowTokenInfoFallback && fallbackLiquidityUsd > 0,
                poolCount: 0,
                fallbackUsed: allowTokenInfoFallback && fallbackLiquidityUsd > 0,
            };
        }
    }

    try {
        const targetPools = await loadTargetInteractedPools(options?.swap, chainId, deps).catch(() => []);
        if (targetPools.length > 0) {
            const targetPoolLiquidity = await deps.getLiquidityFromCandidatePools(tokenAddress, chainId, targetPools, {
                budgetMs: 700,
            }).catch(() => null);
            const targetLiquidityUsd = normalizeFinitePositive(targetPoolLiquidity?.totalTvlUsd);
            const targetPoolCount = Array.isArray(targetPoolLiquidity?.pools) ? targetPoolLiquidity.pools.length : targetPools.length;
            const stopAtLiquidityUsd = normalizeFinitePositive(options?.stopAtLiquidityUsd);

            if (targetLiquidityUsd > 0 && (!stopAtLiquidityUsd || targetLiquidityUsd >= stopAtLiquidityUsd)) {
                return {
                    liquidityUsd: targetLiquidityUsd,
                    source: 'target_pool_tvl',
                    reliable: Boolean(targetPoolLiquidity?.reliable),
                    poolCount: targetPoolCount,
                    fallbackUsed: false,
                    metadata: {
                        mode: 'target_interacted_pools',
                        targetPoolCount,
                        targetPoolAddresses: targetPools.map((pool) => pool.poolAddress),
                        stopAtLiquidityUsd: stopAtLiquidityUsd || undefined,
                    }
                };
            }
        }

        const directLiquidity = await deps.getTokenLiquidity(tokenAddress, chainId);
        const directLiquidityUsd = normalizeFinitePositive(directLiquidity?.totalTvlUsd);
        const poolCount = Array.isArray(directLiquidity?.pools) ? directLiquidity.pools.length : 0;

        if (directLiquidityUsd > 0) {
            return {
                liquidityUsd: directLiquidityUsd,
                source: 'direct_pool_tvl',
                reliable: Boolean(directLiquidity?.reliable),
                poolCount,
                fallbackUsed: false,
                metadata: {
                    mode: targetPools.length > 0 ? 'full_scan_after_target_pool_miss' : 'full_scan',
                    targetPoolCount: targetPools.length,
                    stopAtLiquidityUsd: normalizeFinitePositive(options?.stopAtLiquidityUsd) || undefined,
                }
            };
        }

        if (allowTokenInfoFallback && fallbackLiquidityUsd > 0) {
            return {
                liquidityUsd: fallbackLiquidityUsd,
                source: poolCount > 0 ? 'direct_pool_unpriced' : 'token_info_fallback',
                reliable: true,
                poolCount,
                fallbackUsed: true
            };
        }

        return {
            liquidityUsd: 0,
            source: poolCount > 0 ? 'direct_pool_unpriced' : 'unavailable',
            reliable: false,
            poolCount,
            fallbackUsed: false
        };
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[CopyTradeGuard] Direct liquidity lookup failed', {
            token: tokenAddress,
            chainId,
            error: error?.message || String(error)
        });

        return {
            liquidityUsd: allowTokenInfoFallback ? fallbackLiquidityUsd : 0,
            source: allowTokenInfoFallback && fallbackLiquidityUsd > 0 ? 'token_info_fallback' : 'unavailable',
            reliable: allowTokenInfoFallback && fallbackLiquidityUsd > 0,
            poolCount: 0,
            fallbackUsed: allowTokenInfoFallback && fallbackLiquidityUsd > 0
        };
    }
}

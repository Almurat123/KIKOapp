import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getTokenLiquidity } from '../../dex/directSwap/pipeline/poolLayer.js';
import { resolveSolanaDirectLiquidity } from '../../solana/direct/liquidity.js';

// Guard-level total budget is ~1200ms, so keep direct Solana liquidity bounded.
const COPYTRADE_SOL_LIQ_TIMEOUT_MS = Number(process.env.COPYTRADE_SOL_LIQ_TIMEOUT_MS || '650');
const COPYTRADE_SOL_LIQUIDITY_SCAN_ALL_POOLS = (process.env.COPYTRADE_SOL_LIQUIDITY_SCAN_ALL_POOLS || 'false') === 'true';

export type LiquidityGuardSnapshot = {
    liquidityUsd: number;
    source: 'direct_pool_tvl' | 'token_info_fallback' | 'direct_pool_unpriced' | 'unavailable';
    reliable: boolean;
    poolCount: number;
    fallbackUsed: boolean;
    metadata?: Record<string, unknown>;
};

function normalizeFinitePositive(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function resolveBuyLiquidityGuardSnapshot(
    tokenAddress: string,
    chainId: number,
    tokenInfo: any
): Promise<LiquidityGuardSnapshot> {
    const fallbackLiquidityUsd = normalizeFinitePositive(tokenInfo?.liquidity);

    if (chainId === 900) {
        try {
            const tokenPriceUsd = normalizeFinitePositive(tokenInfo?.price);
            const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), COPYTRADE_SOL_LIQ_TIMEOUT_MS));
            const directLiquidity = await Promise.race([
                resolveSolanaDirectLiquidity(tokenAddress, tokenPriceUsd, {
                    includeProgramScan: COPYTRADE_SOL_LIQUIDITY_SCAN_ALL_POOLS,
                    budgetMs: COPYTRADE_SOL_LIQ_TIMEOUT_MS,
                    skipDetection: true,
                }),
                timeout,
            ]);
            const directLiquidityUsd = normalizeFinitePositive(directLiquidity?.liquidityUsd);
            const poolCount = Number(directLiquidity?.poolCount || 0);

            if (directLiquidityUsd > 0) {
                return {
                    liquidityUsd: directLiquidityUsd,
                    source: 'direct_pool_tvl',
                    reliable: Boolean(directLiquidity?.reliable),
                    poolCount,
                    fallbackUsed: false,
                    metadata: (directLiquidity?.metadata as Record<string, unknown> | undefined) || undefined,
                };
            }

            if (fallbackLiquidityUsd > 0) {
                return {
                    liquidityUsd: fallbackLiquidityUsd,
                    source: poolCount > 0 ? 'direct_pool_unpriced' : 'token_info_fallback',
                    reliable: true,
                    poolCount,
                    fallbackUsed: true,
                    metadata: (directLiquidity?.metadata as Record<string, unknown> | undefined) || undefined,
                };
            }

            return {
                liquidityUsd: 0,
                source: poolCount > 0 ? 'direct_pool_unpriced' : 'unavailable',
                reliable: false,
                poolCount,
                fallbackUsed: false,
                metadata: (directLiquidity?.metadata as Record<string, unknown> | undefined) || undefined,
            };
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, '[CopyTradeGuard] Solana direct liquidity lookup failed', {
                token: tokenAddress,
                chainId,
                error: error?.message || String(error)
            });

            return {
                liquidityUsd: fallbackLiquidityUsd,
                source: fallbackLiquidityUsd > 0 ? 'token_info_fallback' : 'unavailable',
                reliable: fallbackLiquidityUsd > 0,
                poolCount: 0,
                fallbackUsed: fallbackLiquidityUsd > 0,
            };
        }
    }

    try {
        const directLiquidity = await getTokenLiquidity(tokenAddress, chainId);
        const directLiquidityUsd = normalizeFinitePositive(directLiquidity?.totalTvlUsd);
        const poolCount = Array.isArray(directLiquidity?.pools) ? directLiquidity.pools.length : 0;

        if (directLiquidityUsd > 0) {
            return {
                liquidityUsd: directLiquidityUsd,
                source: 'direct_pool_tvl',
                reliable: Boolean(directLiquidity?.reliable),
                poolCount,
                fallbackUsed: false
            };
        }

        if (fallbackLiquidityUsd > 0) {
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
            liquidityUsd: fallbackLiquidityUsd,
            source: fallbackLiquidityUsd > 0 ? 'token_info_fallback' : 'unavailable',
            reliable: fallbackLiquidityUsd > 0,
            poolCount: 0,
            fallbackUsed: fallbackLiquidityUsd > 0
        };
    }
}

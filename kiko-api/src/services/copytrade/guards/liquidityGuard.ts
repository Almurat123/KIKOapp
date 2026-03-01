import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getTokenLiquidity } from '../../dex/directSwap/pipeline/poolLayer.js';
import { resolveSolanaDirectLiquidity } from '../../solana/direct/liquidity.js';

export type LiquidityGuardSnapshot = {
    liquidityUsd: number;
    source: 'direct_pool_tvl' | 'token_info_fallback' | 'direct_pool_unpriced' | 'unavailable';
    reliable: boolean;
    poolCount: number;
    fallbackUsed: boolean;
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
            const directLiquidity = await resolveSolanaDirectLiquidity(tokenAddress);
            const directLiquidityUsd = normalizeFinitePositive(directLiquidity?.liquidityUsd);
            const poolCount = Number(directLiquidity?.poolCount || 0);

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
                fallbackUsed: fallbackLiquidityUsd > 0
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
                reliable: true,
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

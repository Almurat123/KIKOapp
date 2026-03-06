import { ethers } from 'ethers';
import { logger } from '../../../../utils/logger.js';
import { LogCode } from '../../../../config/logRegistry.js';
import { findTokenPools, type PoolInfo } from '../../poolInfo.js';
import { calculateV3TVL } from '../../v3Math.js';
import { reconstructV3PoolLiquidityUsd } from '../../v3LiquidityReconstruction.js';
import { getTokenDetails } from '../../../geckoTerminal.js';
import { getNativeTokenPriceUsd } from '../../../onChainPriceService.js';
import { getTokenDecimals, getTokenMetadata } from '../../../rpcService.js';
import type { DirectSwapHint } from '../../directSwapTypes.js';
import type { HintLiquidityGateResult } from '../domain/guards.js';
import {
  evaluateBuyLiquidityProtection,
  evaluateResolvedHintFastPathLiquidityGateFromPools
} from '../domain/guards.js';
import type { TokenLiquidity } from '../types.js';
import {
  getChainSlugForUsdLookup,
  isStableTokenAddress,
  STABLE_TOKEN_HINTS_BY_CHAIN,
  withTimeout,
  WETH_ADDRESSES
} from './context.js';

const DIRECT_SWAP_BUY_LIQ_MULTIPLIER = Number(process.env.DIRECT_SWAP_BUY_LIQ_MULTIPLIER || '100');

async function getNativePriceUsd(chainId: number): Promise<number> {
  return getNativeTokenPriceUsd(chainId).catch(() => 0);
}

export async function getLiquidityFromCandidatePools(
  tokenAddress: string,
  chainId: number,
  candidatePools: PoolInfo[],
  options?: { budgetMs?: number }
): Promise<TokenLiquidity> {
  const startedAt = Date.now();
  const budgetMs = Number(options?.budgetMs || 0);
  const hasBudget = Number.isFinite(budgetMs) && budgetMs > 0;
  const budgetExceeded = () => hasBudget && (Date.now() - startedAt) >= budgetMs;
  const wrappedNative = WETH_ADDRESSES[chainId];
  const nativePriceUsd = await getNativePriceUsd(chainId).catch(() => 0);
  const result: TokenLiquidity = { totalTvlUsd: 0, pools: [], reliable: false, source: 'unavailable' };
  const seenPools = new Set<string>();

  for (const pool of candidatePools) {
    if (budgetExceeded()) break;
    const poolKey = `${pool.version || 'unknown'}:${pool.poolAddress.toLowerCase()}`;
    if (seenPools.has(poolKey)) continue;
    seenPools.add(poolKey);

    let tvlUsd = 0;
    let source = 'direct_quote_pool_estimate';
    let reliable = false;
    let initializedTickCount: number | undefined;
    let intervalCount: number | undefined;

    const token0Lower = pool.token0.toLowerCase();
    const token1Lower = pool.token1.toLowerCase();
    const normalizedToken = tokenAddress.toLowerCase();
    const quoteLower = token0Lower === normalizedToken ? token1Lower : token0Lower;
    const quoteIsToken0 = token0Lower === quoteLower;
    const quoteIsToken1 = token1Lower === quoteLower;
    const quoteIsStable = isStableTokenAddress(chainId, quoteLower);
    const quotePriceUsd = quoteIsStable ? 1 : (quoteLower === wrappedNative?.toLowerCase() ? nativePriceUsd : 0);

    if (quotePriceUsd <= 0 || (!quoteIsToken0 && !quoteIsToken1)) {
      continue;
    }

    if (pool.reserve0 && pool.reserve1) {
      const quoteReserveRaw = quoteIsToken0 ? pool.reserve0 : pool.reserve1;
      const quoteDecimals = quoteIsToken0 ? (pool.token0Decimals || 18) : (pool.token1Decimals || 18);
      const quoteReserve = Number(BigInt(quoteReserveRaw)) / Math.pow(10, quoteDecimals);
      if (Number.isFinite(quoteReserve) && quoteReserve > 0) {
        tvlUsd = quoteReserve * quotePriceUsd * 2;
        source = quoteIsStable ? 'v2_quote_reserve_stable' : 'v2_quote_reserve_native';
        reliable = quoteIsStable || quotePriceUsd > 0;
      }
    } else if (pool.liquidity && pool.sqrtPriceX96) {
      const decimals0 = pool.token0Decimals || 18;
      const decimals1 = pool.token1Decimals || 18;
      const poolSpotPrice = Number(pool.price || 0);
      let price0Usd = 0;
      let price1Usd = 0;

      if (quoteIsToken0) {
        price0Usd = quotePriceUsd;
        price1Usd = poolSpotPrice > 0 ? quotePriceUsd / poolSpotPrice : 0;
      } else {
        price1Usd = quotePriceUsd;
        price0Usd = poolSpotPrice > 0 ? poolSpotPrice * quotePriceUsd : 0;
      }

      if (pool.version === 'v3') {
        const reconstructed = hasBudget
          ? await withTimeout(reconstructV3PoolLiquidityUsd({
            poolAddress: pool.poolAddress,
            chainId,
            decimals0,
            decimals1,
            price0Usd,
            price1Usd
          }), Math.max(50, budgetMs - (Date.now() - startedAt))).catch(() => null)
          : await reconstructV3PoolLiquidityUsd({
            poolAddress: pool.poolAddress,
            chainId,
            decimals0,
            decimals1,
            price0Usd,
            price1Usd
          }).catch(() => null);
        if (reconstructed && reconstructed.totalValueLockedUsd > 0) {
          tvlUsd = reconstructed.totalValueLockedUsd;
          source = 'v3_tick_reconstruction';
          reliable = true;
          initializedTickCount = reconstructed.initializedTickCount;
          intervalCount = reconstructed.intervalCount;
        }
      }

      if (!(tvlUsd > 0)) {
        source = quoteIsStable ? 'v3_quote_side_stable' : 'v3_quote_side_native';
        tvlUsd = calculateV3TVL(
          BigInt(pool.sqrtPriceX96),
          BigInt(pool.liquidity),
          decimals0,
          decimals1,
          price0Usd,
          price1Usd
        );
      }
    }

    result.pools.push({
      version: pool.version || 'v3',
      fee: pool.fee || 0,
      tvlUsd,
      address: pool.poolAddress,
      source,
      reliable,
      initializedTickCount,
      intervalCount
    });
    result.totalTvlUsd += tvlUsd;
    result.reliable = result.reliable || reliable;
  }

  if (result.totalTvlUsd > 0) {
    result.source = result.reliable ? 'direct_quote_pool_reconstruction' : 'direct_quote_pool_estimate';
  }

  return result;
}

export async function evaluateResolvedHintFastPathLiquidityGate(params: {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountInWei: bigint;
  resolvedHint: NonNullable<DirectSwapHint['resolvedPoolHint']>;
  budgetMs: number;
}): Promise<HintLiquidityGateResult> {
  if (params.budgetMs <= 80) {
    return {
      allowed: false,
      reason: 'hint_liquidity_gate_budget_exhausted',
      blockType: 'uncertain_block',
      poolCount: 0,
      matchingPoolCount: 0,
      matchingEligibleCount: 0,
      requiredReserveInWei: '0'
    };
  }

  let pools: PoolInfo[] = [];
  let poolDiscoveryFailed = false;
  try {
    pools = await withTimeout(
      findTokenPools(params.tokenIn, params.tokenOut, params.chainId),
      params.budgetMs
    );
  } catch {
    poolDiscoveryFailed = true;
    pools = [];
  }

  if (poolDiscoveryFailed) {
    return {
      allowed: false,
      reason: 'hint_liquidity_gate_discovery_failed',
      blockType: 'uncertain_block',
      poolCount: 0,
      matchingPoolCount: 0,
      matchingEligibleCount: 0,
      requiredReserveInWei: '0'
    };
  }

  if (pools.length === 0) {
    return {
      allowed: false,
      reason: 'hint_liquidity_gate_no_pools',
      blockType: 'uncertain_block',
      poolCount: 0,
      matchingPoolCount: 0,
      matchingEligibleCount: 0,
      requiredReserveInWei: '0'
    };
  }

  return evaluateResolvedHintFastPathLiquidityGateFromPools({
    pools,
    tokenIn: params.tokenIn,
    amountInWei: params.amountInWei,
    resolvedHint: params.resolvedHint,
    multiplier: Math.max(1, DIRECT_SWAP_BUY_LIQ_MULTIPLIER)
  });
}

export function evaluateAerodromeBuySideDepth(
  pools: PoolInfo[],
  tokenIn: string,
  amountInWei: bigint
): {
  eligible: boolean;
  requiredReserveInWei: bigint;
  checkedPools: number;
  matchedPools: number;
} {
  const aerodromePools = pools.filter((pool) => {
    const version = String(pool.version || '').toLowerCase();
    const dex = String(pool.dex || '').toLowerCase();
    return version === 'aerodrome' || dex === 'aerodrome';
  });
  const guard = evaluateBuyLiquidityProtection(
    aerodromePools,
    tokenIn,
    amountInWei,
    Math.max(1, DIRECT_SWAP_BUY_LIQ_MULTIPLIER)
  );
  return {
    eligible: guard.eligible,
    requiredReserveInWei: guard.requiredReserveInWei,
    checkedPools: guard.checkedPools,
    matchedPools: guard.matchedPools
  };
}

export async function estimateAmountUsdByToken(
  chainId: number,
  tokenAddress: string,
  amountInWei: bigint
): Promise<number> {
  if (amountInWei <= 0n) return 0;
  const normalized = tokenAddress.toLowerCase();
  const ethAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const wrappedNative = WETH_ADDRESSES[chainId]?.toLowerCase();

  if (normalized === ethAddress || (wrappedNative && normalized === wrappedNative)) {
    const nativePrice = await getNativePriceUsd(chainId);
    if (nativePrice > 0) {
      return Number(ethers.formatUnits(amountInWei, 18)) * nativePrice;
    }
  }

  if (isStableTokenAddress(chainId, normalized)) {
    const decimals = await getTokenDecimals(chainId, tokenAddress, { defaultDecimals: 18 }).catch(() => 18);
    return Number(ethers.formatUnits(amountInWei, decimals));
  }

  try {
    const chainSlug = getChainSlugForUsdLookup(chainId);
    if (!chainSlug) return 0;
    const [meta, tokenDetails] = await withTimeout(
      Promise.all([
        getTokenMetadata(chainId, tokenAddress),
        getTokenDetails(chainSlug, tokenAddress, 'high')
      ]),
      900
    );
    const priceUsd = Number(tokenDetails?.price || 0);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return 0;
    const decimals = meta?.decimals || 18;
    return Number(ethers.formatUnits(amountInWei, decimals)) * priceUsd;
  } catch {
    return 0;
  }
}

export async function getTokenLiquidity(
  tokenAddress: string,
  chainId: number,
  options?: { budgetMs?: number }
): Promise<TokenLiquidity> {
  const startedAt = Date.now();
  const budgetMs = Number(options?.budgetMs || 0);
  const hasBudget = Number.isFinite(budgetMs) && budgetMs > 0;
  const budgetExceeded = () => hasBudget && (Date.now() - startedAt) >= budgetMs;
  const wrappedNative = WETH_ADDRESSES[chainId];
  const stableHints = STABLE_TOKEN_HINTS_BY_CHAIN[chainId] || [];
  const quoteCandidates = [wrappedNative, ...stableHints]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())
    .filter((value, index, arr) => arr.indexOf(value) === index && value !== tokenAddress.toLowerCase());

  if (quoteCandidates.length === 0) {
    return { totalTvlUsd: 0, pools: [] };
  }

  try {
    const result: TokenLiquidity = { totalTvlUsd: 0, pools: [], reliable: false, source: 'unavailable' };

    for (const quoteToken of quoteCandidates) {
      if (budgetExceeded()) break;
      const pools = hasBudget
        ? await withTimeout(findTokenPools(tokenAddress, quoteToken, chainId), Math.max(50, budgetMs - (Date.now() - startedAt))).catch(() => [])
        : await findTokenPools(tokenAddress, quoteToken, chainId).catch(() => []);
      const partial = await getLiquidityFromCandidatePools(tokenAddress, chainId, pools, {
        budgetMs: hasBudget ? Math.max(50, budgetMs - (Date.now() - startedAt)) : undefined
      });
      result.totalTvlUsd += partial.totalTvlUsd;
      result.pools.push(...partial.pools);
      result.reliable = result.reliable || Boolean(partial.reliable);

      if (result.totalTvlUsd > 0) {
        break;
      }
    }

    if (result.totalTvlUsd > 0) {
      result.source = result.reliable ? 'direct_quote_pool_reconstruction' : 'direct_quote_pool_estimate';
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

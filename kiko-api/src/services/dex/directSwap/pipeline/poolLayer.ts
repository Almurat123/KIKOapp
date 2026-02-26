import { ethers } from 'ethers';
import { logger } from '../../../../utils/logger.js';
import { LogCode } from '../../../../config/logRegistry.js';
import { findTokenPools, type PoolInfo } from '../../poolInfo.js';
import { calculateV3TVL } from '../../v3Math.js';
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
  withTimeout,
  WETH_ADDRESSES
} from './context.js';

const DIRECT_SWAP_BUY_LIQ_MULTIPLIER = Number(process.env.DIRECT_SWAP_BUY_LIQ_MULTIPLIER || '100');

async function getNativePriceUsd(chainId: number): Promise<number> {
  return getNativeTokenPriceUsd(chainId).catch(() => 0);
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
      if (pool.liquidity && pool.sqrtPriceX96) {
        const isToken0 = pool.token0.toLowerCase() === tokenAddress.toLowerCase();
        const decimals0 = pool.token0Decimals || 18;
        const decimals1 = pool.token1Decimals || 18;
        const nativePriceUsd = await getNativePriceUsd(chainId);
        const price0USD = isToken0 ? 0 : nativePriceUsd;
        const price1USD = isToken0 ? nativePriceUsd : 0;

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

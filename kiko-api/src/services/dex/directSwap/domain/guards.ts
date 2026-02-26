import type { PoolInfo } from '../../poolInfo.js';
import type { DirectSwapHint } from '../../directSwapTypes.js';

export interface SourceAnchorExpectation {
  expectedOutFromSource: bigint;
  minAnchorRatioBps: number;
  maxAnchorRatioBps?: number;
  sourceTxHash?: string;
}

export interface HintLiquidityGateResult {
  allowed: boolean;
  reason: string;
  blockType: 'none' | 'definitive_block' | 'uncertain_block';
  poolCount: number;
  matchingPoolCount: number;
  matchingEligibleCount: number;
  requiredReserveInWei: string;
}

function canonicalAnchorToken(token: string | null | undefined, wrappedNative: string): string {
  const value = String(token || '').toLowerCase();
  if (!value) return '';
  const nativePseudo = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  if (value === nativePseudo) return wrappedNative || value;
  return value;
}

function parsePositiveBigInt(value: string | null | undefined): bigint {
  try {
    const parsed = BigInt(String(value || '0'));
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

export function resolveSourceAnchorExpectation(params: {
  hint?: DirectSwapHint;
  tokenIn: string;
  tokenOut: string;
  amountInWei: bigint;
  wrappedNativeAddress: string;
  minAnchorRatioBps: number;
  maxAnchorRatioBps?: number;
}): SourceAnchorExpectation | null {
  const sourceAmountIn = parsePositiveBigInt(params.hint?.sourceAmountIn);
  const sourceAmountOut = parsePositiveBigInt(params.hint?.sourceAmountOut);
  if (sourceAmountIn <= 0n || sourceAmountOut <= 0n || params.amountInWei <= 0n) return null;

  const wrapped = String(params.wrappedNativeAddress || '').toLowerCase();
  const pairMatches =
    canonicalAnchorToken(params.hint?.sourceTokenIn, wrapped) === canonicalAnchorToken(params.tokenIn, wrapped)
    && canonicalAnchorToken(params.hint?.sourceTokenOut, wrapped) === canonicalAnchorToken(params.tokenOut, wrapped);
  if (!pairMatches) return null;

  const expectedOutFromSource = (sourceAmountOut * params.amountInWei) / sourceAmountIn;
  if (expectedOutFromSource <= 0n) return null;

  return {
    expectedOutFromSource,
    minAnchorRatioBps: Math.max(1, Number(params.minAnchorRatioBps || 1)),
    maxAnchorRatioBps: Number.isFinite(Number(params.maxAnchorRatioBps))
      ? Math.max(Math.max(1, Number(params.minAnchorRatioBps || 1)), Number(params.maxAnchorRatioBps))
      : undefined,
    sourceTxHash: params.hint?.sourceTxHash
  };
}

export function evaluateSourceAnchorQuote(quotedOut: bigint, anchor: SourceAnchorExpectation): {
  accepted: boolean;
  ratioBps: number;
} {
  if (quotedOut <= 0n || anchor.expectedOutFromSource <= 0n) {
    return { accepted: false, ratioBps: 0 };
  }
  const ratioBps = Number((quotedOut * 10000n) / anchor.expectedOutFromSource);
  const maxAnchorRatioBps = Number.isFinite(Number(anchor.maxAnchorRatioBps))
    ? Number(anchor.maxAnchorRatioBps)
    : Number.MAX_SAFE_INTEGER;
  return {
    accepted: ratioBps >= anchor.minAnchorRatioBps && ratioBps <= maxAnchorRatioBps,
    ratioBps
  };
}

function resolvePoolInReserve(pool: PoolInfo, tokenIn: string): bigint {
  const t0 = (pool.token0 || '').toLowerCase();
  const t1 = (pool.token1 || '').toLowerCase();
  const inToken = tokenIn.toLowerCase();
  const reserve0 = BigInt(pool.reserve0 || '0');
  const reserve1 = BigInt(pool.reserve1 || '0');
  if (t0 === inToken) return reserve0;
  if (t1 === inToken) return reserve1;
  return reserve0 > reserve1 ? reserve0 : reserve1;
}

export function evaluateBuyLiquidityProtection(
  pools: PoolInfo[],
  tokenIn: string,
  amountInWei: bigint,
  multiplier: number
): {
  eligible: boolean;
  requiredReserveInWei: bigint;
  checkedPools: number;
  matchedPools: number;
  byVersion: { v2: number; v3: number; v4: number; aerodrome: number };
  sample: Array<{ version: string; pool: string; reserveLike: string; matched: boolean }>;
} {
  const requiredReserveInWei = amountInWei * BigInt(Math.max(1, multiplier));
  const byVersion = { v2: 0, v3: 0, v4: 0, aerodrome: 0 };
  let checkedPools = 0;
  let matchedPools = 0;
  const sample: Array<{ version: string; pool: string; reserveLike: string; matched: boolean }> = [];

  for (const p of pools) {
    const version = (p.version || '').toLowerCase();
    if (version === 'v2' || version === 'aerodrome') {
      const reserveLike = resolvePoolInReserve(p, tokenIn);
      const matched = reserveLike >= requiredReserveInWei;
      byVersion[version] += 1;
      checkedPools += 1;
      if (matched) matchedPools += 1;
      if (sample.length < 8) {
        sample.push({
          version,
          pool: String(p.poolAddress || '').slice(0, 12),
          reserveLike: reserveLike.toString().slice(0, 20),
          matched
        });
      }
      continue;
    }
    if (version === 'v3' || version === 'v4') {
      const reserveLike = BigInt(p.liquidity || '0');
      const matched = reserveLike >= requiredReserveInWei;
      byVersion[version] += 1;
      checkedPools += 1;
      if (matched) matchedPools += 1;
      if (sample.length < 8) {
        sample.push({
          version,
          pool: String(p.poolAddress || '').slice(0, 12),
          reserveLike: reserveLike.toString().slice(0, 20),
          matched
        });
      }
    }
  }

  return {
    eligible: matchedPools > 0,
    requiredReserveInWei,
    checkedPools,
    matchedPools,
    byVersion,
    sample
  };
}

export function poolPassesRequiredReserve(
  pool: PoolInfo,
  tokenIn: string,
  requiredReserveInWei: bigint
): boolean {
  const version = String(pool.version || '').toLowerCase();
  if (version === 'v2' || version === 'aerodrome') {
    return resolvePoolInReserve(pool, tokenIn) >= requiredReserveInWei;
  }
  if (version === 'v3' || version === 'v4') {
    return BigInt(pool.liquidity || '0') >= requiredReserveInWei;
  }
  return false;
}

export function matchesResolvedHintPool(
  pool: PoolInfo,
  hint: NonNullable<DirectSwapHint['resolvedPoolHint']>
): boolean {
  const poolVersion = String(pool.version || '').toLowerCase();
  const poolDex = String(pool.dex || '').toLowerCase();
  const hintDex = String(hint.dex || '').toLowerCase();
  const hintKind = String(hint.kind || '').toLowerCase();

  if (hintKind === 'v4' && poolVersion !== 'v4') return false;
  if (hintKind === 'v3' && poolVersion !== 'v3') return false;
  if (hintKind === 'v2' && poolVersion !== 'v2') return false;
  if (hintKind === 'aerodrome' && !(poolVersion === 'aerodrome' || poolDex === 'aerodrome')) return false;

  if (hintDex) {
    if (hintKind === 'aerodrome') {
      if (poolDex && poolDex !== hintDex) return false;
    } else if (poolDex && poolDex !== hintDex) {
      return false;
    }
  }

  if (hint.poolAddress && hintKind !== 'v4' && hintKind !== 'aerodrome') {
    const expectedPool = String(hint.poolAddress || '').toLowerCase();
    const actualPool = String(pool.poolAddress || '').toLowerCase();
    if (/^0x[a-f0-9]{40}$/.test(expectedPool) && /^0x[a-f0-9]{40}$/.test(actualPool) && expectedPool !== actualPool) {
      return false;
    }
  }

  return true;
}

export function evaluateResolvedHintFastPathLiquidityGateFromPools(params: {
  pools: PoolInfo[];
  tokenIn: string;
  amountInWei: bigint;
  resolvedHint: NonNullable<DirectSwapHint['resolvedPoolHint']>;
  multiplier: number;
}): HintLiquidityGateResult {
  const requiredReserveInWei = params.amountInWei * BigInt(Math.max(1, params.multiplier));
  const matchingPools = params.pools.filter((pool) => matchesResolvedHintPool(pool, params.resolvedHint));
  const matchingEligiblePools = matchingPools.filter((pool) =>
    poolPassesRequiredReserve(pool, params.tokenIn, requiredReserveInWei)
  );
  const hasUnknownDepthConcentratedPool = matchingPools.some((pool) => {
    const version = String(pool.version || '').toLowerCase();
    if (version !== 'v3' && version !== 'v4') return false;
    const liq = BigInt(pool.liquidity || '0');
    return liq <= 0n;
  });

  if (matchingPools.length === 0) {
    return {
      allowed: false,
      reason: 'hint_liquidity_gate_no_matching_pools',
      blockType: 'definitive_block',
      poolCount: params.pools.length,
      matchingPoolCount: 0,
      matchingEligibleCount: 0,
      requiredReserveInWei: requiredReserveInWei.toString()
    };
  }

  return {
    allowed: matchingEligiblePools.length > 0,
    reason: matchingEligiblePools.length > 0
      ? 'hint_liquidity_gate_pass'
      : (hasUnknownDepthConcentratedPool
        ? 'hint_liquidity_gate_unknown_depth_for_concentrated_pool'
        : 'hint_liquidity_gate_matching_pools_insufficient_depth'),
    blockType: matchingEligiblePools.length > 0
      ? 'none'
      : (hasUnknownDepthConcentratedPool ? 'uncertain_block' : 'definitive_block'),
    poolCount: params.pools.length,
    matchingPoolCount: matchingPools.length,
    matchingEligibleCount: matchingEligiblePools.length,
    requiredReserveInWei: requiredReserveInWei.toString()
  };
}

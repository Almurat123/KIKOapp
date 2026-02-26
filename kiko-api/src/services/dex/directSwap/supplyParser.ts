import { getChainConfig } from '../../../config/chainConfig.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getTransactionByHash, getTransactionReceipt } from '../../rpcManager.js';
import { parseSwapTransaction, type DecodedSwap } from '../../txDecoder.js';
import { createTimedCache } from './cache.js';
import type { DirectSwapHint, HintedSourcePool } from '../directSwapTypes.js';
import type { SelectedV4Pool } from '../v4ExecutionPlan.js';
import type { PoolInfo } from '../poolInfo.js';
import { findV4Pools } from '../uniswapV4.js';

const NATIVE_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EXTRA_NATIVE_ALIASES_BY_CHAIN: Record<number, string[]> = {
  // Flaunch pools on Base often use this currency alias in logs/path metadata.
  8453: ['0x000000000d564d5be76f7f0d28fe52605afc7cf8']
};
const PARSER_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_SUPPLY_PARSER_CACHE_TTL_MS || '30000');
const HINT_TX_PARSE_TIMEOUT_MS = Math.max(200, Number.parseInt(String(process.env.DIRECT_SWAP_HINT_PARSE_TIMEOUT_MS || '2200'), 10) || 2200);
const HINT_V4_FALLBACK_TIMEOUT_MS = Math.max(200, Number.parseInt(String(process.env.DIRECT_SWAP_HINT_V4_FALLBACK_TIMEOUT_MS || '1400'), 10) || 1400);

type ParserCacheEntry = {
  value: DecodedSwap | null;
};

const parserCache = createTimedCache<ParserCacheEntry>();
const parserInflight = new Map<string, Promise<DecodedSwap | null>>();

interface SupplyParserDeps {
  getTransactionByHash: typeof getTransactionByHash;
  getTransactionReceipt: typeof getTransactionReceipt;
  parseSwapTransaction: typeof parseSwapTransaction;
}

const defaultSupplyParserDeps: SupplyParserDeps = {
  getTransactionByHash,
  getTransactionReceipt,
  parseSwapTransaction
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutLabel)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeForMatching(token: string, chainId: number): string {
  const value = String(token || '').toLowerCase();
  if (!value) return value;
  if (value === NATIVE_TOKEN || value === ZERO_ADDRESS || (EXTRA_NATIVE_ALIASES_BY_CHAIN[chainId] || []).includes(value)) {
    return String(getChainConfig(chainId).wrappedNativeAddress || value).toLowerCase();
  }
  return value;
}

function uniqueLower(items: string[]): string[] {
  return Array.from(new Set(items.map((x) => String(x || '').toLowerCase()).filter(Boolean)));
}

function buildV4DiscoveryTokenCandidates(token: string, chainId: number): string[] {
  const value = String(token || '').toLowerCase();
  const chain = getChainConfig(chainId);
  const wrapped = String(chain.wrappedNativeAddress || '').toLowerCase();
  const aliases = EXTRA_NATIVE_ALIASES_BY_CHAIN[chainId] || [];
  const isNativeLike = value === NATIVE_TOKEN || value === ZERO_ADDRESS || value === wrapped || aliases.includes(value);
  if (!isNativeLike) return uniqueLower([value]);
  return uniqueLower([wrapped, ...aliases]);
}

function matchesRequestedPair(
  requestedIn: string,
  requestedOut: string,
  decodedIn: string,
  decodedOut: string,
  chainId: number
): boolean {
  const reqIn = normalizeForMatching(requestedIn, chainId);
  const reqOut = normalizeForMatching(requestedOut, chainId);
  const decIn = normalizeForMatching(decodedIn, chainId);
  const decOut = normalizeForMatching(decodedOut, chainId);

  if (reqIn === decIn && reqOut === decOut) return true;
  if (reqIn === decOut && reqOut === decIn) return true;
  return false;
}

function getHintRouteHopCount(hint?: DirectSwapHint): number {
  if (!hint) return 0;
  return Math.max(Number(hint.routeHopCount || 0), hint.routeHops?.length || 0);
}

function mapRouteHopToResolvedHint(
  hop: NonNullable<DirectSwapHint['routeHops']>[number]
): NonNullable<DirectSwapHint['resolvedPoolHint']> | null {
  const kind = hop.kind;
  if (kind !== 'v4' && kind !== 'v3' && kind !== 'v2' && kind !== 'aerodrome') return null;
  if (!hop.poolAddress) return null;
  return {
    kind,
    dex: hop.dex,
    poolAddress: hop.poolAddress,
    fee: hop.fee
  };
}

function pickPairMatchedRouteHint(params: {
  hint?: DirectSwapHint;
  tokenIn: string;
  tokenOut: string;
  chainId: number;
}): NonNullable<DirectSwapHint['resolvedPoolHint']> | null {
  const { hint, tokenIn, tokenOut, chainId } = params;
  if (!hint?.routeHops?.length) return null;
  for (const hop of hint.routeHops) {
    if (!hop.poolAddress || !hop.tokenIn || !hop.tokenOut) continue;
    if (!matchesRequestedPair(tokenIn, tokenOut, hop.tokenIn, hop.tokenOut, chainId)) continue;
    const mapped = mapRouteHopToResolvedHint(hop);
    if (mapped) return mapped;
  }
  return null;
}

function pickPairMatchedDecodedRouteHint(params: {
  decoded: DecodedSwap;
  tokenIn: string;
  tokenOut: string;
  chainId: number;
}): NonNullable<DirectSwapHint['resolvedPoolHint']> | null {
  const { decoded, tokenIn, tokenOut, chainId } = params;
  if (!decoded.routeHops?.length) return null;
  for (const hop of decoded.routeHops) {
    if (!hop.poolAddress || !hop.tokenIn || !hop.tokenOut) continue;
    if (!matchesRequestedPair(tokenIn, tokenOut, hop.tokenIn, hop.tokenOut, chainId)) continue;
    const mapped = mapRouteHopToResolvedHint(hop);
    if (mapped) return mapped;
  }
  return null;
}

export async function parseSwapSupplyFromSourceTx(params: {
  chainId: number;
  sourceTxHash: string;
  tokenIn: string;
  tokenOut: string;
}, deps?: Partial<SupplyParserDeps>): Promise<DecodedSwap | null> {
  const parserDeps: SupplyParserDeps = {
    ...defaultSupplyParserDeps,
    ...(deps || {})
  };
  const { chainId, sourceTxHash, tokenIn, tokenOut } = params;

  if (!sourceTxHash || !/^0x[a-fA-F0-9]{64}$/.test(sourceTxHash)) return null;

  const cacheKey = `${chainId}:${sourceTxHash.toLowerCase()}:${normalizeForMatching(tokenIn, chainId)}:${normalizeForMatching(tokenOut, chainId)}`;
  const cached = parserCache.get(cacheKey, PARSER_CACHE_TTL_MS);
  if (cached) {
    return cached.value;
  }

  const inflight = parserInflight.get(cacheKey);
  if (inflight) return await inflight;

  const task = (async (): Promise<DecodedSwap | null> => {
    try {
      const [tx, receipt] = await Promise.all([
        parserDeps.getTransactionByHash(chainId, sourceTxHash),
        parserDeps.getTransactionReceipt(chainId, sourceTxHash)
      ]);

      if (!tx || !receipt) return null;
      const decoded = await parserDeps.parseSwapTransaction(tx, receipt, chainId);
      if (!decoded) return null;

      if (!matchesRequestedPair(tokenIn, tokenOut, decoded.tokenIn, decoded.tokenOut, chainId)) {
        return null;
      }
      return decoded;
    } catch (error: any) {
      logger.debug(LogCode.DEC_SWAP_DETECTION, '[DirectSwapSupplyParser] Failed to decode source tx', {
        chainId,
        txHash: sourceTxHash,
        error: String(error?.message || error || 'unknown_error').slice(0, 200)
      });
      return null;
    }
  })();

  parserInflight.set(cacheKey, task);
  try {
    const result = await task;
    parserCache.set(cacheKey, { value: result });
    return result;
  } finally {
    parserInflight.delete(cacheKey);
  }
}

function mapHintedDex(raw?: string): 'uniswap' | 'pancake' {
  return raw === 'pancake' ? 'pancake' : 'uniswap';
}

function buildPoolInfo(
  kind: 'v2' | 'v3',
  tokenIn: string,
  tokenOut: string,
  hint: NonNullable<DirectSwapHint['resolvedPoolHint']>
): PoolInfo {
  return {
    poolAddress: String(hint.poolAddress || '').toLowerCase(),
    token0: tokenIn,
    token1: tokenOut,
    fee: Number(hint.fee || (kind === 'v3' ? 3000 : 0)),
    version: kind,
    dex: hint.dex === 'pancake' ? 'pancake' : 'uniswap'
  };
}

function mapV4ResolvedHintToSelectedPool(
  resolved: NonNullable<DirectSwapHint['resolvedPoolHint']>
): SelectedV4Pool | null {
  if (resolved.kind !== 'v4') return null;
  if (!resolved.v4PoolKey || !resolved.poolAddress) return null;

  return {
    poolId: resolved.poolAddress.toLowerCase(),
    poolAddress: resolved.poolAddress.toLowerCase(),
    poolKey: {
      currency0: resolved.v4PoolKey.currency0,
      currency1: resolved.v4PoolKey.currency1,
      hooks: resolved.v4PoolKey.hooks,
      fee: resolved.v4PoolKey.fee,
      tickSpacing: resolved.v4PoolKey.tickSpacing
    },
    token0: resolved.v4PoolKey.currency0,
    token1: resolved.v4PoolKey.currency1,
    sqrtPriceX96: '0',
    liquidity: '0',
    fee: resolved.v4PoolKey.fee,
    version: 'v4',
    dex: 'uniswap'
  };
}

async function resolveV4PoolByIdFallback(
  tokenIn: string,
  tokenOut: string,
  chainId: number,
  resolved: NonNullable<DirectSwapHint['resolvedPoolHint']>
): Promise<SelectedV4Pool | null> {
  if (resolved.kind !== 'v4' || !resolved.poolAddress) return null;

  const poolId = resolved.poolAddress.toLowerCase();
  const inCandidates = buildV4DiscoveryTokenCandidates(tokenIn, chainId);
  const outCandidates = buildV4DiscoveryTokenCandidates(tokenOut, chainId);
  const poolMap = new Map<string, Awaited<ReturnType<typeof findV4Pools>>[number]>();
  for (const inToken of inCandidates) {
    for (const outToken of outCandidates) {
      if (!inToken || !outToken || inToken === outToken) continue;
      const found = await findV4Pools(inToken, outToken, chainId, { strategy: 'fast' }).catch(() => []);
      for (const pool of found) poolMap.set(String(pool.poolId).toLowerCase(), pool);
    }
  }
  const pools = Array.from(poolMap.values());
  const matched = pools.find((p) => p.poolId.toLowerCase() === poolId);
  if (!matched) return null;

  return {
    poolId: matched.poolId,
    poolAddress: matched.poolId,
    poolKey: matched.poolKey,
    token0: matched.poolKey.currency0,
    token1: matched.poolKey.currency1,
    sqrtPriceX96: matched.sqrtPriceX96,
    liquidity: matched.liquidity,
    fee: matched.lpFee,
    version: 'v4',
    dex: 'uniswap'
  };
}

function toBigIntSafe(value: unknown): bigint {
  try {
    return BigInt(String(value ?? '0'));
  } catch {
    return 0n;
  }
}

function pickPreferredV4PoolByLiquidity(params: {
  pools: Awaited<ReturnType<typeof findV4Pools>>;
  preferredFee?: number;
}): Awaited<ReturnType<typeof findV4Pools>>[number] | null {
  const { pools, preferredFee } = params;
  if (!pools.length) return null;
  const filteredByFee = Number.isFinite(Number(preferredFee))
    ? pools.filter((p) => Number(p.poolKey.fee) === Number(preferredFee))
    : pools;
  const candidates = filteredByFee.length ? filteredByFee : pools;
  const sorted = [...candidates].sort((a, b) => {
    const liq = toBigIntSafe(b.liquidity) - toBigIntSafe(a.liquidity);
    if (liq !== 0n) return liq > 0n ? 1 : -1;
    return String(a.poolId).localeCompare(String(b.poolId));
  });
  if (sorted.length === 1) return sorted[0];
  const top = toBigIntSafe(sorted[0]?.liquidity);
  const second = toBigIntSafe(sorted[1]?.liquidity);
  // Only auto-pick when the winner is clearly dominant to avoid wrong-pool execution.
  if (top > 0n && second > 0n && top * 5n < second * 8n) return null;
  return sorted[0] || null;
}

async function resolveV4PoolByPairFallback(
  tokenIn: string,
  tokenOut: string,
  chainId: number,
  resolved: NonNullable<DirectSwapHint['resolvedPoolHint']>
): Promise<SelectedV4Pool | null> {
  if (resolved.kind !== 'v4') return null;
  const inCandidates = buildV4DiscoveryTokenCandidates(tokenIn, chainId);
  const outCandidates = buildV4DiscoveryTokenCandidates(tokenOut, chainId);
  const poolMap = new Map<string, Awaited<ReturnType<typeof findV4Pools>>[number]>();
  for (const inToken of inCandidates) {
    for (const outToken of outCandidates) {
      if (!inToken || !outToken || inToken === outToken) continue;
      const found = await findV4Pools(inToken, outToken, chainId, { strategy: 'fast' }).catch(() => []);
      for (const pool of found) poolMap.set(String(pool.poolId).toLowerCase(), pool);
    }
  }
  const pools = Array.from(poolMap.values());
  if (!pools.length) return null;
  const preferred = pickPreferredV4PoolByLiquidity({
    pools,
    preferredFee: Number(resolved.fee || 0)
  });
  if (!preferred) return null;
  return {
    poolId: preferred.poolId,
    poolAddress: preferred.poolId,
    poolKey: preferred.poolKey,
    token0: preferred.poolKey.currency0,
    token1: preferred.poolKey.currency1,
    sqrtPriceX96: preferred.sqrtPriceX96,
    liquidity: preferred.liquidity,
    fee: preferred.lpFee || preferred.poolKey.fee,
    version: 'v4',
    dex: 'uniswap'
  };
}

export async function resolvePoolHintFromSwapSupply(params: {
  tokenIn: string;
  tokenOut: string;
  chainId: number;
  hint?: DirectSwapHint;
}): Promise<NonNullable<DirectSwapHint['resolvedPoolHint']> | null> {
  const { tokenIn, tokenOut, chainId, hint } = params;
  const routeHopCount = getHintRouteHopCount(hint);
  const canUseResolvedFastPath = hint?.canUseResolvedPoolFastPath !== false && routeHopCount <= 1;
  if (hint?.resolvedPoolHint && canUseResolvedFastPath) return hint.resolvedPoolHint;
  if (hint?.resolvedPoolHint && !canUseResolvedFastPath) {
    const fromRoute = pickPairMatchedRouteHint({ hint, tokenIn, tokenOut, chainId });
    if (fromRoute) return fromRoute;
  }

  const txHash = String(hint?.sourceTxHash || '').trim();
  if (!txHash) return null;

  const decoded = await withTimeout(
    parseSwapSupplyFromSourceTx({
      chainId,
      sourceTxHash: txHash,
      tokenIn,
      tokenOut
    }),
    HINT_TX_PARSE_TIMEOUT_MS,
    `DIRECT_HINT_PARSE_TIMEOUT:${HINT_TX_PARSE_TIMEOUT_MS}ms`
  ).catch((error: any) => {
    logger.info(LogCode.SYS_INFO, '[DirectSwapSupplyParser] Source hint parse timed out/fallback', {
      chainId,
      txHash: txHash.toLowerCase(),
      timeoutMs: HINT_TX_PARSE_TIMEOUT_MS,
      reason: String(error?.message || error || 'unknown').slice(0, 160)
    });
    return null;
  });
  if (!decoded) return null;
  if (decoded.resolvedPoolHint && decoded.canUseResolvedPoolFastPath !== false) {
    return decoded.resolvedPoolHint;
  }
  const fromDecodedRoute = pickPairMatchedDecodedRouteHint({ decoded, tokenIn, tokenOut, chainId });
  if (fromDecodedRoute) return fromDecodedRoute;
  return decoded.resolvedPoolHint || null;
}

export async function resolveHintedPoolFromSwapSupply(params: {
  tokenIn: string;
  tokenOut: string;
  chainId: number;
  hint?: DirectSwapHint;
}): Promise<HintedSourcePool | null> {
  const { tokenIn, tokenOut, chainId, hint } = params;
  const resolved = await resolvePoolHintFromSwapSupply({ tokenIn, tokenOut, chainId, hint });
  if (!resolved || !resolved.poolAddress) return null;

  if (resolved.kind === 'v4') {
    const direct = mapV4ResolvedHintToSelectedPool(resolved);
    if (direct) return { kind: 'v4', dex: mapHintedDex(resolved.dex), pool: direct };

    const fallback = await withTimeout(
      resolveV4PoolByIdFallback(tokenIn, tokenOut, chainId, resolved),
      HINT_V4_FALLBACK_TIMEOUT_MS,
      `DIRECT_HINT_V4_ID_TIMEOUT:${HINT_V4_FALLBACK_TIMEOUT_MS}ms`
    ).catch((error: any) => {
      logger.info(LogCode.SYS_INFO, '[DirectSwapSupplyParser] V4 hinted pool-id fallback timed out', {
        chainId,
        tokenIn: normalizeForMatching(tokenIn, chainId),
        tokenOut: normalizeForMatching(tokenOut, chainId),
        timeoutMs: HINT_V4_FALLBACK_TIMEOUT_MS,
        reason: String(error?.message || error || 'unknown').slice(0, 160)
      });
      return null;
    });
    if (fallback) return { kind: 'v4', dex: mapHintedDex(resolved.dex), pool: fallback };

    const pairFallback = await withTimeout(
      resolveV4PoolByPairFallback(tokenIn, tokenOut, chainId, resolved),
      HINT_V4_FALLBACK_TIMEOUT_MS,
      `DIRECT_HINT_V4_PAIR_TIMEOUT:${HINT_V4_FALLBACK_TIMEOUT_MS}ms`
    ).catch((error: any) => {
      logger.info(LogCode.SYS_INFO, '[DirectSwapSupplyParser] V4 hinted pair fallback timed out', {
        chainId,
        tokenIn: normalizeForMatching(tokenIn, chainId),
        tokenOut: normalizeForMatching(tokenOut, chainId),
        timeoutMs: HINT_V4_FALLBACK_TIMEOUT_MS,
        reason: String(error?.message || error || 'unknown').slice(0, 160)
      });
      return null;
    });
    if (!pairFallback) return null;
    logger.info(LogCode.SYS_INFO, '[DirectSwapSupplyParser] Resolved V4 hinted pool by pair fallback', {
      chainId,
      tokenIn: normalizeForMatching(tokenIn, chainId),
      tokenOut: normalizeForMatching(tokenOut, chainId),
      hintedPoolAddress: String(resolved.poolAddress || '').toLowerCase(),
      selectedPoolId: pairFallback.poolId,
      selectedHook: pairFallback.poolKey.hooks,
      selectedFee: pairFallback.poolKey.fee,
      selectedTickSpacing: pairFallback.poolKey.tickSpacing
    });
    return { kind: 'v4', dex: mapHintedDex(resolved.dex), pool: pairFallback };
  }

  if (resolved.kind === 'v3') {
    return {
      kind: 'v3',
      dex: mapHintedDex(resolved.dex),
      pool: buildPoolInfo('v3', tokenIn, tokenOut, resolved)
    };
  }

  if (resolved.kind === 'v2') {
    return {
      kind: 'v2',
      dex: resolved.dex || (chainId === 56 ? 'pancake' : 'uniswap'),
      pool: buildPoolInfo('v2', tokenIn, tokenOut, resolved)
    };
  }

  return null;
}

export async function resolveHintedV4PoolFromSwapSupply(params: {
  tokenIn: string;
  tokenOut: string;
  chainId: number;
  hint?: DirectSwapHint;
}): Promise<SelectedV4Pool | null> {
  const { tokenIn, tokenOut, chainId, hint } = params;
  const resolved = await resolvePoolHintFromSwapSupply({ tokenIn, tokenOut, chainId, hint });
  if (!resolved || resolved.kind !== 'v4') return null;

  const direct = mapV4ResolvedHintToSelectedPool(resolved);
  if (direct) return direct;
  return await resolveV4PoolByIdFallback(tokenIn, tokenOut, chainId, resolved);
}

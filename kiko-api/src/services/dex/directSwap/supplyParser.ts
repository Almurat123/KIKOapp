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
const PARSER_CACHE_TTL_MS = Number(process.env.DIRECT_SWAP_SUPPLY_PARSER_CACHE_TTL_MS || '30000');

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

function normalizeForMatching(token: string, chainId: number): string {
  const value = String(token || '').toLowerCase();
  if (!value) return value;
  if (value === NATIVE_TOKEN) {
    return String(getChainConfig(chainId).wrappedNativeAddress || value).toLowerCase();
  }
  return value;
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
  const pools = await findV4Pools(tokenIn, tokenOut, chainId, { strategy: 'fast' }).catch(() => []);
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

export async function resolvePoolHintFromSwapSupply(params: {
  tokenIn: string;
  tokenOut: string;
  chainId: number;
  hint?: DirectSwapHint;
}): Promise<NonNullable<DirectSwapHint['resolvedPoolHint']> | null> {
  const { tokenIn, tokenOut, chainId, hint } = params;
  if (hint?.resolvedPoolHint) return hint.resolvedPoolHint;

  const txHash = String(hint?.sourceTxHash || '').trim();
  if (!txHash) return null;

  const decoded = await parseSwapSupplyFromSourceTx({
    chainId,
    sourceTxHash: txHash,
    tokenIn,
    tokenOut
  });
  return decoded?.resolvedPoolHint || null;
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

    const fallback = await resolveV4PoolByIdFallback(tokenIn, tokenOut, chainId, resolved);
    if (!fallback) return null;
    return { kind: 'v4', dex: mapHintedDex(resolved.dex), pool: fallback };
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

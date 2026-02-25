import prisma from '../../../db/prisma.js';
import { get as cacheGet, set as cacheSet } from '../../../cache/cacheClient.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { DirectSwapHint } from '../../dex/directSwapTypes.js';
import { getContextRedisTtlSec, isContextBusEnabled, isContextPersistEnabled } from './featureFlags.js';
import type { ContextStoreHit, SwapExecutionContextV1 } from './types.js';

function contextRedisKey(chainId: number, txHash: string): string {
  return `copytrade:ctx:${chainId}:${String(txHash || '').toLowerCase()}`;
}

function normalizeHash(hash: string): string {
  return String(hash || '').toLowerCase();
}

export function buildDirectSwapHintFromContext(
  ctx?: SwapExecutionContextV1 | null
): DirectSwapHint | undefined {
  if (!ctx) return undefined;
  if (!ctx.sourceTxHash && !ctx.sourceRouter && !ctx.resolvedPoolHint && !ctx.routeHops?.length) return undefined;
  return {
    sourceTxHash: ctx.sourceTxHash,
    sourceRouter: ctx.sourceRouter,
    sourceTokenIn: ctx.tokenIn,
    sourceTokenOut: ctx.tokenOut,
    sourceAmountIn: ctx.amountIn,
    sourceAmountOut: ctx.amountOut,
    routeHopCount: ctx.routeHops?.length || 0,
    routeHops: ctx.routeHops?.map((hop) => ({
      kind: hop.kind,
      dex: hop.dex,
      poolAddress: hop.poolAddress,
      tokenIn: hop.tokenIn,
      tokenOut: hop.tokenOut,
      fee: hop.fee
    })),
    resolvedPoolHint: ctx.resolvedPoolHint
      ? {
          kind: ctx.resolvedPoolHint.kind,
          dex: ctx.resolvedPoolHint.dex,
          poolAddress: ctx.resolvedPoolHint.poolAddress,
          fee: ctx.resolvedPoolHint.fee,
          v4PoolKey: ctx.resolvedPoolHint.v4PoolKey
        }
      : undefined,
    bypassReferencePrice: true
  };
}

export async function putContext(ctx: SwapExecutionContextV1): Promise<{ contextId?: string }> {
  if (!isContextBusEnabled()) return {};
  const hash = normalizeHash(ctx.sourceTxHash);
  if (!hash || !/^0x[0-9a-f]{64}$/.test(hash)) return {};

  const key = contextRedisKey(ctx.chainId, hash);
  const payload = JSON.stringify(ctx);
  await cacheSet(key, payload, getContextRedisTtlSec()).catch(() => {});

  if (!isContextPersistEnabled()) return {};
  try {
    const db = prisma as any;
    const row = await db.swapExecutionContext.upsert({
      where: {
        chainId_sourceTxHash: {
          chainId: ctx.chainId,
          sourceTxHash: hash
        }
      },
      create: {
        chainId: ctx.chainId,
        sourceTxHash: hash,
        sourceRouter: ctx.sourceRouter || null,
        sourceSelector: ctx.sourceSelector || null,
        contextJson: payload
      },
      update: {
        sourceRouter: ctx.sourceRouter || null,
        sourceSelector: ctx.sourceSelector || null,
        contextJson: payload
      },
      select: { id: true }
    });
    return { contextId: row?.id };
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[CTX] Failed to persist swap execution context', {
      chainId: ctx.chainId,
      txHash: hash,
      error: error?.message || String(error)
    });
    return {};
  }
}

export async function getContextByTxHash(chainId: number, txHash: string): Promise<ContextStoreHit> {
  if (!isContextBusEnabled()) return { context: null, source: 'miss' };
  const hash = normalizeHash(txHash);
  if (!hash || !/^0x[0-9a-f]{64}$/.test(hash)) return { context: null, source: 'miss' };

  const key = contextRedisKey(chainId, hash);
  const cached = await cacheGet(key).catch(() => null);
  if (cached) {
    try {
      return { context: JSON.parse(cached) as SwapExecutionContextV1, source: 'redis' };
    } catch {
      // continue to db
    }
  }

  if (!isContextPersistEnabled()) return { context: null, source: 'miss' };
  try {
    const db = prisma as any;
    const row = await db.swapExecutionContext.findUnique({
      where: {
        chainId_sourceTxHash: {
          chainId,
          sourceTxHash: hash
        }
      },
      select: {
        id: true,
        contextJson: true
      }
    });
    if (!row?.contextJson) return { context: null, source: 'miss' };
    const context = JSON.parse(String(row.contextJson)) as SwapExecutionContextV1;
    await cacheSet(key, JSON.stringify(context), getContextRedisTtlSec()).catch(() => {});
    return {
      context,
      source: 'db',
      contextId: row.id
    };
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[CTX] Failed to load swap execution context', {
      chainId,
      txHash: hash,
      error: error?.message || String(error)
    });
    return { context: null, source: 'miss' };
  }
}

export async function queryContextsBySelector(params: {
  chainId: number;
  router: string;
  selector: string;
  limit?: number;
}): Promise<SwapExecutionContextV1[]> {
  if (!isContextPersistEnabled()) return [];
  try {
    const db = prisma as any;
    const rows = await db.swapExecutionContext.findMany({
      where: {
        chainId: params.chainId,
        sourceRouter: String(params.router || '').toLowerCase(),
        sourceSelector: String(params.selector || '').toLowerCase()
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(500, Number(params.limit || 100)))
    });
    return rows
      .map((r: any) => {
        try {
          return JSON.parse(String(r.contextJson)) as SwapExecutionContextV1;
        } catch {
          return null;
        }
      })
      .filter((x: SwapExecutionContextV1 | null): x is SwapExecutionContextV1 => Boolean(x));
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[CTX] Failed to query contexts by selector', {
      chainId: params.chainId,
      router: params.router,
      selector: params.selector,
      error: error?.message || String(error)
    });
    return [];
  }
}

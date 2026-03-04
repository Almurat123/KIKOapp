import prisma from '../../../db/prisma.js';
import { reconcileOpenPositionsForExit } from './openPositionReconciliation.js';
import {
  listPendingAttributedPositions,
  type PendingAttributedPositionLotLike,
} from '../positions/pendingAttributedPositionLedger.js';
import type { PositionExitReason } from './types.js';
import type { ExitSnapshotPosition } from './exitSnapshotTypes.js';

export interface ExitContextResolverDeps {
  loadPositions(params: {
    userId: string;
    chainId: number;
    tokenAddress: string;
  }): Promise<ExitSnapshotPosition[]>;
  loadPendingLots(params: {
    userId: string;
    chainId: number;
    tokenAddress: string;
    positionIds: string[];
  }): Promise<PendingAttributedPositionLotLike[]>;
}

export interface ResolvedExitExecutionContext {
  positions: ExitSnapshotPosition[];
  pendingAttributedLots: PendingAttributedPositionLotLike[];
  reasonCode:
    | 'EXIT_CONTEXT_MIRROR_SELL_CANONICAL'
    | 'EXIT_CONTEXT_MIRROR_SELL_FALLBACK_SUPPLIED'
    | 'EXIT_CONTEXT_NON_MIRROR_SELL';
  metrics: {
    suppliedPositionCount: number;
    resolvedPositionCount: number;
    pendingLotCount: number;
  };
}

const defaultDeps: ExitContextResolverDeps = {
  async loadPositions(params) {
    return prisma.position.findMany({
      where: {
        userId: params.userId,
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
        status: { in: ['open', 'pending'] },
      },
      orderBy: { createdAt: 'asc' },
    }) as Promise<ExitSnapshotPosition[]>;
  },
  async loadPendingLots(params) {
    return listPendingAttributedPositions({
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      positionIds: params.positionIds,
      statuses: ['armed', 'sell_armed'],
    });
  },
};

function mergePositions(
  loaded: ExitSnapshotPosition[],
  supplied: ExitSnapshotPosition[],
): ExitSnapshotPosition[] {
  const merged = new Map<string, ExitSnapshotPosition>();
  for (const position of loaded) merged.set(position.id, position);
  for (const position of supplied) {
    if (!position?.id) continue;
    merged.set(position.id, { ...merged.get(position.id), ...position });
  }
  return [...merged.values()];
}

function mergePendingLots(
  loaded: PendingAttributedPositionLotLike[],
  supplied: PendingAttributedPositionLotLike[],
): PendingAttributedPositionLotLike[] {
  const merged = new Map<string, PendingAttributedPositionLotLike>();
  for (const lot of loaded) merged.set(lot.id, lot);
  for (const lot of supplied) {
    if (!lot?.id) continue;
    merged.set(lot.id, lot);
  }
  return [...merged.values()];
}

export async function resolveExitExecutionContext(
  params: {
    userId: string;
    chainId: number;
    tokenAddress: string;
    exitReason: PositionExitReason;
    positions?: ExitSnapshotPosition[];
    pendingAttributedLots?: PendingAttributedPositionLotLike[];
  },
  deps: ExitContextResolverDeps = defaultDeps,
): Promise<ResolvedExitExecutionContext> {
  const suppliedPositions = [...(params.positions || [])];
  const suppliedPendingLots = [...(params.pendingAttributedLots || [])];

  if (params.exitReason !== 'mirror_sell') {
    return {
      positions: suppliedPositions,
      pendingAttributedLots: suppliedPendingLots,
      reasonCode: 'EXIT_CONTEXT_NON_MIRROR_SELL',
      metrics: {
        suppliedPositionCount: suppliedPositions.length,
        resolvedPositionCount: suppliedPositions.length,
        pendingLotCount: suppliedPendingLots.length,
      },
    };
  }

  const loadedPositions = await deps.loadPositions({
    userId: params.userId,
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
  });
  const reconciledLoaded = reconcileOpenPositionsForExit(
    loadedPositions,
    params.tokenAddress,
    params.chainId,
  );
  const reconciledSupplied = reconcileOpenPositionsForExit(
    suppliedPositions,
    params.tokenAddress,
    params.chainId,
  );
  const mergedPositions = mergePositions(
    reconciledLoaded.matchedPositions,
    reconciledSupplied.matchedPositions,
  );
  const resolvedPositions =
    mergedPositions.length > 0 ? mergedPositions : reconciledSupplied.matchedPositions;
  const positionIds = resolvedPositions.map((position) => position.id).filter(Boolean);
  const loadedPendingLots =
    positionIds.length > 0
      ? await deps.loadPendingLots({
          userId: params.userId,
          chainId: params.chainId,
          tokenAddress: params.tokenAddress,
          positionIds,
        })
      : [];

  return {
    positions: resolvedPositions,
    pendingAttributedLots: mergePendingLots(loadedPendingLots, suppliedPendingLots),
    reasonCode:
      mergedPositions.length > 0
        ? 'EXIT_CONTEXT_MIRROR_SELL_CANONICAL'
        : 'EXIT_CONTEXT_MIRROR_SELL_FALLBACK_SUPPLIED',
    metrics: {
      suppliedPositionCount: suppliedPositions.length,
      resolvedPositionCount: resolvedPositions.length,
      pendingLotCount: mergePendingLots(loadedPendingLots, suppliedPendingLots).length,
    },
  };
}

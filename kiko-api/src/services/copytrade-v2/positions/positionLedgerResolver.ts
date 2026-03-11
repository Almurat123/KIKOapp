import prisma from '../../../db/prisma.js';
import type { PendingAttributedPositionLotLike } from './pendingAttributedPositionLedger.js';
import { listPendingAttributedPositions } from './pendingAttributedPositionLedger.js';
import { resolveTargetSellLink } from '../reconcile/copytradeTargetSellLinkResolver.js';
import { findLatestTargetSellEvent } from '../exit/targetSellEventStore.js';
import {
  derivePositionLedgerLifecyclePhase,
  type PositionLedgerPosition,
  type PositionLedgerSnapshot,
} from './positionLedgerSnapshot.js';
import { normalizeToken, normalizeWallet } from '../runtime/chainIdentityNormalizer.js';
import type { TargetSellEventRecord } from '../exit/targetSellEventStore.js';

function normalizeTokenAddress(chainId: number, value: string): string {
  return normalizeToken(chainId, value);
}

function mergePendingLots(params: {
  loaded: PendingAttributedPositionLotLike[];
  supplied?: PendingAttributedPositionLotLike[];
}): PendingAttributedPositionLotLike[] {
  const merged = new Map<string, PendingAttributedPositionLotLike>();
  for (const lot of params.loaded) merged.set(lot.id, lot);
  for (const lot of params.supplied || []) {
    if (!lot?.id) continue;
    merged.set(lot.id, lot);
  }
  return [...merged.values()];
}

export function resolveLatestTargetSellSignal(params: {
  linkedSell: {
    txHash: string | null;
    blockTimestamp: Date | null;
  };
  persistedSellEvent?: TargetSellEventRecord | null;
}): {
  txHash: string | null;
  at: Date | null;
  source: 'linked_history' | 'persisted_event' | 'none';
} {
  if (params.linkedSell.txHash) {
    return {
      txHash: params.linkedSell.txHash,
      at: params.linkedSell.blockTimestamp || null,
      source: 'linked_history',
    };
  }
  if (params.persistedSellEvent?.targetSellTxHash) {
    return {
      txHash: params.persistedSellEvent.targetSellTxHash,
      at: params.persistedSellEvent.detectedAt || null,
      source: 'persisted_event',
    };
  }
  return {
    txHash: null,
    at: null,
    source: 'none',
  };
}

export async function resolvePositionLedgerSnapshot(params: {
  chainId: number;
  tokenAddress: string;
  targetWallet?: string | null;
  leaderBuyTxHash?: string | null;
  positionCreatedAt?: Date | null;
  positions?: PositionLedgerPosition[];
  pendingLots?: PendingAttributedPositionLotLike[];
  positionIds?: string[];
}): Promise<PositionLedgerSnapshot> {
  const tokenAddress = normalizeTokenAddress(params.chainId, params.tokenAddress);
  const positions = params.positions && params.positions.length > 0
    ? params.positions.map((position) => ({
        ...position,
        tokenAddress: normalizeTokenAddress(position.chainId || params.chainId, position.tokenAddress),
      }))
    : await prisma.position.findMany({
        where: {
          chainId: params.chainId,
          tokenAddress: { equals: tokenAddress, mode: 'insensitive' },
          ...(params.positionIds?.length ? { id: { in: params.positionIds } } : {}),
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          userId: true,
          configId: true,
          tokenAddress: true,
          chainId: true,
          entryTxHash: true,
          entryAmountDec: true,
          entryAmountExact: true,
          status: true,
          leaderTxHash: true,
          createdAt: true,
        },
      });

  const positionIds = (params.positionIds?.length ? params.positionIds : positions.map((position) => position.id))
    .filter(Boolean);
  const loadedPendingLots = positionIds.length > 0
    ? await listPendingAttributedPositions({
        chainId: params.chainId,
        tokenAddress,
        positionIds,
        statuses: ['armed', 'sell_armed', 'consumed', 'cancelled'],
      }).catch(() => [])
    : [];
  const pendingLots = mergePendingLots({
    loaded: loadedPendingLots,
    supplied: params.pendingLots,
  });

  let latestTargetSellTxHash: string | null = null;
  let latestTargetSellAt: Date | null = null;
  const normalizedWallet = normalizeWallet(params.chainId, params.targetWallet);
  if (normalizedWallet) {
    const linkedSell = await resolveTargetSellLink({
      targetWallet: normalizedWallet,
      chainId: params.chainId,
      tokenAddress,
      leaderBuyTxHash: params.leaderBuyTxHash || positions.find((position) => position.leaderTxHash)?.leaderTxHash || null,
      positionCreatedAt: params.positionCreatedAt || positions[0]?.createdAt || null,
      pendingCreatedAt: pendingLots[0]?.createdAt || null,
    });
    const persistedSellEvent = linkedSell.txHash
      ? null
      : await findLatestTargetSellEvent({
          targetWallet: normalizedWallet,
          chainId: params.chainId,
          tokenAddress,
        }).catch(() => null);
    const resolvedSignal = resolveLatestTargetSellSignal({
      linkedSell,
      persistedSellEvent,
    });
    latestTargetSellTxHash = resolvedSignal.txHash;
    latestTargetSellAt = resolvedSignal.at;
  }

  return {
    chainId: params.chainId,
    tokenAddress,
    userId: positions[0]?.userId || pendingLots[0]?.userId || null,
    positionIds,
    positions,
    pendingLots,
    latestTargetSellTxHash,
    latestTargetSellAt,
    lifecyclePhase: derivePositionLedgerLifecyclePhase({ positions, pendingLots }),
  };
}

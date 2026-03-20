import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';

import prisma from '../../../db/prisma.js';
import { normalizeToken, normalizeTxHash, normalizeWallet } from '../runtime/chainIdentityNormalizer.js';

type CanonicalDirection = 'buy' | 'sell' | 'token_swap' | 'unknown';

export interface CanonicalOrderIdentity {
  userId: string;
  configId: string;
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
  leaderTxHash: string;
  direction: CanonicalDirection;
}

export interface CanonicalOrderSnapshot {
  id: string;
  canonicalKey: string | null;
  lifecycleState: string;
  lastReasonCode: string;
  chainId: number;
  txHash: string;
  targetWallet: string;
  tokenIn: string;
  tokenOut: string;
  userId: string | null;
  configId: string | null;
  metadata: Record<string, unknown>;
}

export type CanonicalOrderAwaitingKind = 'buy_finality' | 'exit_finality' | 'projection_repair';

function toSnapshot(row: any): CanonicalOrderSnapshot {
  return {
    id: row.id,
    canonicalKey: row.canonicalKey || null,
    lifecycleState: row.lifecycleState,
    lastReasonCode: row.lastReasonCode,
    chainId: row.chainId,
    txHash: row.txHash,
    targetWallet: row.targetWallet,
    tokenIn: row.tokenIn,
    tokenOut: row.tokenOut,
    userId: row.userId || null,
    configId: row.configId || null,
    metadata: (row.metadataJson as Record<string, unknown> | null) || {},
  };
}

export function buildCanonicalOrderKey(identity: CanonicalOrderIdentity): string {
  return [
    String(identity.chainId),
    normalizeTxHash(identity.chainId, identity.leaderTxHash),
    normalizeWallet(identity.chainId, identity.targetWallet),
    identity.userId,
    identity.configId,
    normalizeToken(identity.chainId, identity.tokenAddress),
    identity.direction,
  ].join(':');
}

async function appendOrderEvent(params: {
  orderId: string;
  eventType: string;
  lifecycleState: string;
  reasonCode: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await prisma.copytradeOrderEvent.create({
    data: {
      id: crypto.randomUUID(),
      orderId: params.orderId,
      eventType: params.eventType,
      lifecycleState: params.lifecycleState,
      reasonCode: params.reasonCode,
      payloadJson: (params.payload || {}) as Prisma.InputJsonValue,
    },
  });
}

export async function claimOrCreateCanonicalOrder(params: CanonicalOrderIdentity & {
  mode?: string;
  tokenIn?: string | null;
  tokenOut?: string | null;
  followerWallet?: string | null;
  detectedAt?: Date;
  metadata?: Record<string, unknown>;
}): Promise<CanonicalOrderSnapshot> {
  const canonicalKey = buildCanonicalOrderKey(params);
  const existing = await prisma.copytradeOrder.findUnique({
    where: { canonicalKey },
  }).catch(() => null);
  if (existing) return toSnapshot(existing);

  const chainId = params.chainId;
  const txHash = normalizeTxHash(chainId, params.leaderTxHash);
  const targetWallet = normalizeWallet(chainId, params.targetWallet);
  const tokenAddress = normalizeToken(chainId, params.tokenAddress);
  const tokenIn = normalizeToken(chainId, params.tokenIn || (params.direction === 'sell' ? tokenAddress : '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'));
  const tokenOut = normalizeToken(chainId, params.tokenOut || (params.direction === 'buy' ? tokenAddress : '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'));

  const metadata = {
    canonicalKey,
    leaderTxHash: txHash,
    targetWallet,
    followerWallet: params.followerWallet ? normalizeWallet(chainId, params.followerWallet) : null,
    tokenAddress,
    lastKnownExposureSource: null,
    ...params.metadata,
  };

  try {
    const created = await prisma.copytradeOrder.create({
      data: {
        id: crypto.randomUUID(),
        canonicalKey,
        chainId,
        txHash,
        targetWallet,
        tokenIn,
        tokenOut,
        mode: params.mode || 'normal',
        direction: params.direction,
        lifecycleState: 'DETECTED',
        lastReasonCode: 'ok_detected',
        retryCount: 0,
        userId: params.userId,
        configId: params.configId,
        detectedAt: params.detectedAt || new Date(),
        metadataJson: metadata as Prisma.InputJsonValue,
      },
    });
    await appendOrderEvent({
      orderId: created.id,
      eventType: 'ORDER_CREATED',
      lifecycleState: created.lifecycleState,
      reasonCode: created.lastReasonCode,
      payload: metadata,
    }).catch(() => undefined);
    return toSnapshot(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      const raced = await prisma.copytradeOrder.findUnique({
        where: { canonicalKey },
      });
      if (raced) return toSnapshot(raced);
    }
    throw error;
  }
}

export async function advanceCanonicalOrderState(params: {
  orderId: string;
  lifecycleState: string;
  reasonCode: string;
  eventType: string;
  metadataPatch?: Record<string, unknown>;
  closedAt?: Date | null;
  payload?: Record<string, unknown>;
}): Promise<CanonicalOrderSnapshot | null> {
  const existing = await prisma.copytradeOrder.findUnique({
    where: { id: params.orderId },
    select: { metadataJson: true },
  });
  if (!existing) return null;

  const nextMetadata = params.metadataPatch
    ? {
        ...((existing.metadataJson as Record<string, unknown> | null) || {}),
        ...params.metadataPatch,
      }
    : (existing.metadataJson as Record<string, unknown> | null) || {};

  const updated = await prisma.copytradeOrder.update({
    where: { id: params.orderId },
    data: {
      lifecycleState: params.lifecycleState,
      lastReasonCode: params.reasonCode,
      lastExecutionAt: new Date(),
      closedAt: params.closedAt ?? undefined,
      metadataJson: nextMetadata as Prisma.InputJsonValue,
    },
  });

  await appendOrderEvent({
    orderId: updated.id,
    eventType: params.eventType,
    lifecycleState: updated.lifecycleState,
    reasonCode: params.reasonCode,
    payload: {
      ...(params.payload || {}),
      ...(params.metadataPatch || {}),
    },
  }).catch(() => undefined);

  return toSnapshot(updated);
}

export async function recordCanonicalOrderExecution(params: {
  orderId: string;
  status: string;
  reasonCode: string;
  txHash?: string | null;
  mode?: string | null;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const latest = await prisma.copytradeOrderExecution.findFirst({
    where: { orderId: params.orderId },
    orderBy: { attemptNo: 'desc' },
    select: { attemptNo: true },
  });

  await prisma.copytradeOrderExecution.create({
    data: {
      id: crypto.randomUUID(),
      orderId: params.orderId,
      attemptNo: Number(latest?.attemptNo || 0) + 1,
      mode: params.mode || 'legacy',
      status: params.status,
      txHash: params.txHash || null,
      reasonCode: params.reasonCode,
      retryable: Boolean(params.retryable),
      metadataJson: (params.metadata || {}) as Prisma.InputJsonValue,
    },
  });
}

export async function findCanonicalOrderByIdentity(identity: CanonicalOrderIdentity): Promise<CanonicalOrderSnapshot | null> {
  const row = await prisma.copytradeOrder.findUnique({
    where: { canonicalKey: buildCanonicalOrderKey(identity) },
  }).catch(() => null);
  return row ? toSnapshot(row) : null;
}

export async function getCanonicalOrderById(orderId: string): Promise<CanonicalOrderSnapshot | null> {
  const row = await prisma.copytradeOrder.findUnique({
    where: { id: orderId },
  }).catch(() => null);
  return row ? toSnapshot(row) : null;
}

export async function markCanonicalOrderAwaitingObservation(params: {
  orderId: string;
  kind: CanonicalOrderAwaitingKind;
  delayMs?: number;
  lifecycleState?: string | null;
  reasonCode: string;
  eventType: string;
  txHash?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<CanonicalOrderSnapshot | null> {
  const nextObservationAt = new Date(Date.now() + Math.max(0, Number(params.delayMs || 0)));
  return advanceCanonicalOrderState({
    orderId: params.orderId,
    lifecycleState: params.lifecycleState || (
      params.kind === 'buy_finality' ? 'BUY_AWAITING_FINALITY' : 'EXIT_AWAITING_FINALITY'
    ),
    reasonCode: params.reasonCode,
    eventType: params.eventType,
    metadataPatch: {
      awaitingKind: params.kind,
      nextObservationAt: nextObservationAt.toISOString(),
      lastObservedTxHash: params.txHash || null,
      ...(params.metadataPatch || {}),
    },
  });
}

export async function clearCanonicalOrderObservation(params: {
  orderId: string;
  lifecycleState?: string | null;
  reasonCode: string;
  eventType: string;
  metadataPatch?: Record<string, unknown>;
}): Promise<CanonicalOrderSnapshot | null> {
  const current = await getCanonicalOrderById(params.orderId);
  if (!current) return null;

  return advanceCanonicalOrderState({
    orderId: params.orderId,
    lifecycleState: params.lifecycleState || current.lifecycleState,
    reasonCode: params.reasonCode,
    eventType: params.eventType,
    metadataPatch: {
      awaitingKind: null,
      nextObservationAt: null,
      ...(params.metadataPatch || {}),
    },
  });
}

export async function listCanonicalOrdersForObservation(params?: {
  take?: number;
}): Promise<CanonicalOrderSnapshot[]> {
  const rows = await prisma.copytradeOrder.findMany({
    where: {
      lifecycleState: {
        in: [
          'BUY_SUBMITTING',
          'BUY_ACCEPTED',
          'BUY_VISIBLE',
          'BUY_AWAITING_FINALITY',
          'EXIT_ARMED',
          'EXIT_SUBMITTING',
          'EXIT_ACCEPTED',
          'EXIT_VISIBLE',
          'EXIT_AWAITING_FINALITY',
        ],
      },
    },
    orderBy: { updatedAt: 'asc' },
    take: Math.min(Math.max(params?.take || 200, 1), 500),
  }).catch(() => []);
  return rows.map(toSnapshot);
}

export async function listActiveCanonicalOrders(params: {
  userId: string;
  configId: string;
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
  direction?: CanonicalDirection;
}): Promise<CanonicalOrderSnapshot[]> {
  const rows = await prisma.copytradeOrder.findMany({
    where: {
      userId: params.userId,
      configId: params.configId,
      chainId: params.chainId,
      targetWallet: normalizeWallet(params.chainId, params.targetWallet),
      direction: params.direction || 'buy',
      tokenOut: normalizeToken(params.chainId, params.tokenAddress),
      lifecycleState: {
        in: [
          'VALIDATED',
          'BUY_ADMITTED',
          'BUY_SEND_STARTED',
          'BUY_SUBMITTING',
          'BUY_ACCEPTED',
          'BUY_VISIBLE',
          'BUY_AWAITING_FINALITY',
          'BUY_CONFIRMED_OPEN',
          'SELL_PREEMPTED',
          'EXIT_ARMED',
          'EXIT_SUBMITTING',
          'EXIT_ACCEPTED',
          'EXIT_VISIBLE',
          'EXIT_AWAITING_FINALITY',
        ],
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(toSnapshot);
}

import { Prisma } from '@prisma/client';

import prisma from '../../../db/prisma.js';
import type { PositionExitReason } from './types.js';
import {
  buildExitIntentIdentityKey,
  resolveExitIntentLane,
  type ExitExecutionState,
  type PositionExitIntentPayload,
} from './intentTypes.js';
import {
  claimQueuedExitIntentIds,
  removeExitIntentQueueEntry,
  scheduleExitIntentQueueEntry,
} from './positionExitIntentQueue.js';

const ACTIVE_INTENT_STATES: ExitExecutionState[] = [
  'EXIT_INTENT_CREATED',
  'EXIT_PRECHECK_READY',
  'EXIT_SUBMITTING',
  'EXIT_ACCEPTED',
  'EXIT_PENDING_FINALITY',
  'EXIT_RETRYABLE_UNRESOLVED',
];

const LIVE_EXIT_LANES = ['evm-exit', 'solana-exit'] as const;

const TERMINAL_INTENT_STATES: ExitExecutionState[] = [
  'EXIT_CONFIRMED',
  'EXIT_FAILED_TERMINAL',
  'EXIT_CLOSED_DUST',
];

export interface PositionExitIntentRecord {
  id: string;
  positionId: string;
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  exitReason: PositionExitReason;
  sourceEventId: string | null;
  targetSellTxHash: string | null;
  desiredSellRaw: string | null;
  intentVersion: number;
  priority: number;
  lane: string;
  notBefore: Date | null;
  lifecycleState: ExitExecutionState;
  lastReasonCode: string | null;
  identityKey: string;
  executionTxHash: string | null;
  claimedBy: string | null;
  claimedAt: Date | null;
  closedAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(row: any): PositionExitIntentRecord {
  return {
    id: row.id,
    positionId: row.positionId,
    userId: row.userId,
    configId: row.configId,
    chainId: row.chainId,
    tokenAddress: row.tokenAddress,
    exitReason: row.exitReason,
    sourceEventId: row.sourceEventId || null,
    targetSellTxHash: row.targetSellTxHash || null,
    desiredSellRaw: row.desiredSellRaw || null,
    intentVersion: Number(row.intentVersion || 1),
    priority: Number(row.priority || 100),
    lane: row.lane,
    notBefore: row.notBefore || null,
    lifecycleState: row.lifecycleState,
    lastReasonCode: row.lastReasonCode || null,
    identityKey: row.identityKey,
    executionTxHash: row.executionTxHash || null,
    claimedBy: row.claimedBy || null,
    claimedAt: row.claimedAt || null,
    closedAt: row.closedAt || null,
    metadata: (row.metadataJson as Record<string, unknown> | null) || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function resolveNextIntentVersion(positionId: string, exitReason: PositionExitReason): Promise<number> {
  const latest = await prisma.positionExitIntent.findFirst({
    where: {
      positionId,
      exitReason,
    },
    orderBy: { intentVersion: 'desc' },
    select: { intentVersion: true },
  });
  return Math.max(1, Number(latest?.intentVersion || 0) + 1);
}

export async function enqueuePositionExitIntent(payload: PositionExitIntentPayload): Promise<{ record: PositionExitIntentRecord; created: boolean }> {
  const exitReason = payload.exitReason;
  const normalizedTargetSellTxHash = String(payload.targetSellTxHash || '').trim() || null;
  const active = await prisma.positionExitIntent.findFirst({
    where: {
      positionId: payload.positionId,
      exitReason,
      ...(normalizedTargetSellTxHash ? { targetSellTxHash: normalizedTargetSellTxHash } : {}),
      lifecycleState: { in: ACTIVE_INTENT_STATES },
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (active) {
    return { record: toRecord(active), created: false };
  }

  const intentVersion = exitReason === 'mirror_sell'
    ? 1
    : (payload.intentVersion && payload.intentVersion > 0 ? payload.intentVersion : await resolveNextIntentVersion(payload.positionId, exitReason));
  const identityKey = buildExitIntentIdentityKey({
    positionId: payload.positionId,
    exitReason,
    targetSellTxHash: normalizedTargetSellTxHash,
    intentVersion,
  });
  const existing = await prisma.positionExitIntent.findUnique({ where: { identityKey } }).catch(() => null);
  if (existing) {
    return { record: toRecord(existing), created: false };
  }

  const row = await prisma.positionExitIntent.create({
    data: {
      positionId: payload.positionId,
      userId: payload.userId,
      configId: payload.configId,
      chainId: payload.chainId,
      tokenAddress: payload.tokenAddress,
      exitReason,
      sourceEventId: payload.sourceEventId || null,
      targetSellTxHash: normalizedTargetSellTxHash,
      desiredSellRaw: payload.desiredSellRaw || null,
      intentVersion,
      priority: payload.priority ?? 100,
      lane: payload.lane || resolveExitIntentLane(payload.chainId),
      notBefore: payload.notBefore || null,
      lifecycleState: 'EXIT_INTENT_CREATED',
      identityKey,
      metadataJson: payload.metadata ? payload.metadata as Prisma.InputJsonValue : undefined,
    },
  });
  await scheduleExitIntentQueueEntry({
    intentId: row.id,
    lane: row.lane,
    notBefore: row.notBefore,
  }).catch(() => false);
  return { record: toRecord(row), created: true };
}

export async function claimPendingExitIntents(params: {
  lane: string;
  limit: number;
  workerId: string;
  staleClaimMs?: number;
}): Promise<PositionExitIntentRecord[]> {
  const queuedIds = await claimQueuedExitIntentIds({
    lane: params.lane,
    limit: params.limit,
  }).catch(() => null);
  if (queuedIds && queuedIds.length > 0) {
    const queuedRows = await prisma.positionExitIntent.findMany({
      where: {
        id: { in: queuedIds },
        lane: params.lane,
        lifecycleState: { in: ACTIVE_INTENT_STATES },
      },
    });
    const byId = new Map(queuedRows.map((row) => [row.id, row]));
    const now = new Date();
    const staleBefore = new Date(Date.now() - Math.max(30_000, Number(params.staleClaimMs || 120_000)));
    const claimedQueued: PositionExitIntentRecord[] = [];
    for (const intentId of queuedIds) {
      const candidate = byId.get(intentId);
      if (!candidate) continue;
      if (candidate.notBefore && candidate.notBefore.getTime() > Date.now()) {
        await scheduleExitIntentQueueEntry({
          intentId: candidate.id,
          lane: candidate.lane,
          notBefore: candidate.notBefore,
        }).catch(() => false);
        continue;
      }
      const updated = await prisma.positionExitIntent.updateMany({
        where: {
          id: candidate.id,
          lifecycleState: { in: ACTIVE_INTENT_STATES },
          OR: [
            { claimedAt: null },
            { claimedAt: { lt: staleBefore } },
          ],
        },
        data: {
          claimedBy: params.workerId,
          claimedAt: now,
          lifecycleState: candidate.lifecycleState === 'EXIT_INTENT_CREATED'
            ? 'EXIT_PRECHECK_READY'
            : candidate.lifecycleState,
        },
      });
      if (updated.count > 0) {
        claimedQueued.push(toRecord({
          ...candidate,
          claimedBy: params.workerId,
          claimedAt: now,
          lifecycleState: candidate.lifecycleState === 'EXIT_INTENT_CREATED'
            ? 'EXIT_PRECHECK_READY'
            : candidate.lifecycleState,
        }));
      } else {
        await scheduleExitIntentQueueEntry({
          intentId: candidate.id,
          lane: candidate.lane,
          notBefore: candidate.notBefore,
        }).catch(() => false);
      }
    }
    if (claimedQueued.length > 0) {
      return claimedQueued;
    }
  }

  const now = new Date();
  const staleBefore = new Date(Date.now() - Math.max(30_000, Number(params.staleClaimMs || 120_000)));
  const candidates = await prisma.positionExitIntent.findMany({
    where: {
      lane: params.lane,
      lifecycleState: { in: ACTIVE_INTENT_STATES },
      AND: [
        {
          OR: [
            { notBefore: null },
            { notBefore: { lte: now } },
          ],
        },
        {
          OR: [
            { claimedAt: null },
            { claimedAt: { lt: staleBefore } },
          ],
        },
      ],
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
    take: Math.max(1, params.limit),
  });

  const claimed: PositionExitIntentRecord[] = [];
  for (const candidate of candidates) {
    const updated = await prisma.positionExitIntent.updateMany({
      where: {
        id: candidate.id,
        lifecycleState: { in: ACTIVE_INTENT_STATES },
        OR: [
          { claimedAt: null },
          { claimedAt: { lt: staleBefore } },
        ],
      },
      data: {
        claimedBy: params.workerId,
        claimedAt: now,
        lifecycleState: candidate.lifecycleState === 'EXIT_INTENT_CREATED'
          ? 'EXIT_PRECHECK_READY'
          : candidate.lifecycleState,
      },
    });
    if (updated.count > 0) {
      claimed.push(toRecord({
        ...candidate,
        claimedBy: params.workerId,
        claimedAt: now,
        lifecycleState: candidate.lifecycleState === 'EXIT_INTENT_CREATED'
          ? 'EXIT_PRECHECK_READY'
          : candidate.lifecycleState,
      }));
    }
  }
  return claimed;
}

export async function updatePositionExitIntentState(params: {
  id: string;
  lifecycleState: ExitExecutionState;
  lastReasonCode?: string | null;
  executionTxHash?: string | null;
  notBefore?: Date | null;
  lane?: string;
  clearClaim?: boolean;
  metadataPatch?: Record<string, unknown> | null;
  close?: boolean;
}): Promise<void> {
  const existing = await prisma.positionExitIntent.findUnique({
    where: { id: params.id },
    select: { metadataJson: true },
  }).catch(() => null);
  const metadata = {
    ...((existing?.metadataJson as Record<string, unknown> | null) || {}),
    ...(params.metadataPatch || {}),
  };
  await prisma.positionExitIntent.update({
    where: { id: params.id },
    data: {
      lifecycleState: params.lifecycleState,
      lastReasonCode: params.lastReasonCode ?? undefined,
      executionTxHash: params.executionTxHash ?? undefined,
      notBefore: params.notBefore === undefined ? undefined : params.notBefore,
      lane: params.lane ?? undefined,
      claimedAt: params.clearClaim ? null : undefined,
      claimedBy: params.clearClaim ? null : undefined,
      closedAt: params.close || TERMINAL_INTENT_STATES.includes(params.lifecycleState) ? new Date() : undefined,
      metadataJson: Object.keys(metadata).length > 0 ? metadata as Prisma.InputJsonValue : undefined,
    },
  });
  if (TERMINAL_INTENT_STATES.includes(params.lifecycleState) || params.close) {
    await removeExitIntentQueueEntry({
      intentId: params.id,
      lane: params.lane ?? null,
    }).catch(() => undefined);
    return;
  }
  if (ACTIVE_INTENT_STATES.includes(params.lifecycleState) && params.clearClaim !== false) {
    const row = await prisma.positionExitIntent.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        lane: true,
        notBefore: true,
      },
    }).catch(() => null);
    if (row?.id && row?.lane) {
      await scheduleExitIntentQueueEntry({
        intentId: row.id,
        lane: row.lane,
        notBefore: row.notBefore,
      }).catch(() => false);
    }
  }
}

export async function patchPositionExitIntentMetadata(params: {
  id: string;
  lastReasonCode?: string | null;
  executionTxHash?: string | null;
  metadataPatch?: Record<string, unknown> | null;
}): Promise<void> {
  const existing = await prisma.positionExitIntent.findUnique({
    where: { id: params.id },
    select: { metadataJson: true },
  }).catch(() => null);
  const metadata = {
    ...((existing?.metadataJson as Record<string, unknown> | null) || {}),
    ...(params.metadataPatch || {}),
  };
  await prisma.positionExitIntent.update({
    where: { id: params.id },
    data: {
      lastReasonCode: params.lastReasonCode ?? undefined,
      executionTxHash: params.executionTxHash ?? undefined,
      metadataJson: Object.keys(metadata).length > 0 ? metadata as Prisma.InputJsonValue : undefined,
    },
  });
}

export async function getPositionExitIntentById(id: string): Promise<PositionExitIntentRecord | null> {
  const row = await prisma.positionExitIntent.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}

export async function getPositionExitIntentsByIds(ids: string[]): Promise<PositionExitIntentRecord[]> {
  if (!ids.length) return [];
  const rows = await prisma.positionExitIntent.findMany({
    where: { id: { in: ids } },
  });
  const byId = new Map(rows.map((row) => [row.id, toRecord(row)]));
  return ids.map((id) => byId.get(id)).filter((row): row is PositionExitIntentRecord => Boolean(row));
}

export async function hasActiveExitIntent(positionId: string): Promise<boolean> {
  const row = await prisma.positionExitIntent.findFirst({
    where: {
      positionId,
      lifecycleState: { in: ACTIVE_INTENT_STATES },
    },
    select: { id: true },
  });
  return Boolean(row?.id);
}

export async function listActiveExitIntentPositionIds(positionIds: string[]): Promise<Set<string>> {
  if (!positionIds.length) return new Set();
  const rows = await prisma.positionExitIntent.findMany({
    where: {
      positionId: { in: positionIds },
      lifecycleState: { in: ACTIVE_INTENT_STATES },
      lane: { in: [...LIVE_EXIT_LANES] },
    },
    select: {
      positionId: true,
    },
  });
  return new Set(rows.map((row) => row.positionId));
}

export async function hasActiveMirrorSellIntentForUserChain(params: {
  userId: string;
  chainId: number;
}): Promise<boolean> {
  const row = await prisma.positionExitIntent.findFirst({
    where: {
      userId: params.userId,
      chainId: params.chainId,
      exitReason: 'mirror_sell',
      lifecycleState: { in: ACTIVE_INTENT_STATES },
    },
    select: { id: true },
  });
  return Boolean(row?.id);
}

export async function hasActiveMirrorSellIntentForUserChainAndToken(params: {
  userId: string;
  chainId: number;
  tokenAddress: string;
}): Promise<boolean> {
  const tokenAddress = String(params.tokenAddress || '').trim().toLowerCase();
  if (!tokenAddress) return false;
  const row = await prisma.positionExitIntent.findFirst({
    where: {
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress,
      exitReason: 'mirror_sell',
      lifecycleState: { in: ACTIVE_INTENT_STATES },
    },
    select: { id: true },
  });
  return Boolean(row?.id);
}

export async function releaseActiveMirrorSellIntent(params: {
  positionId: string;
  targetSellTxHash: string;
  reasonCode?: string | null;
}): Promise<number> {
  const targetSellTxHash = String(params.targetSellTxHash || '').trim();
  if (!params.positionId || !targetSellTxHash) return 0;
  const result = await prisma.positionExitIntent.updateMany({
    where: {
      positionId: params.positionId,
      exitReason: 'mirror_sell',
      targetSellTxHash,
      lifecycleState: { in: ACTIVE_INTENT_STATES },
    },
    data: {
      notBefore: null,
      lastReasonCode: params.reasonCode || 'buy_confirmation_released',
      claimedAt: null,
      claimedBy: null,
    },
  });
  return result.count;
}

export async function cancelActiveMirrorSellIntentsForPosition(params: {
  positionId?: string | null;
  reasonCode: string;
}): Promise<number> {
  if (!params.positionId) return 0;
  const result = await prisma.positionExitIntent.updateMany({
    where: {
      positionId: params.positionId,
      exitReason: 'mirror_sell',
      lifecycleState: { in: ACTIVE_INTENT_STATES },
    },
    data: {
      lifecycleState: 'EXIT_FAILED_TERMINAL',
      lastReasonCode: params.reasonCode,
      claimedAt: null,
      claimedBy: null,
      closedAt: new Date(),
    },
  });
  return result.count;
}

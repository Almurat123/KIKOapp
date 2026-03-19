import crypto from 'node:crypto';

import { Prisma } from '@prisma/client';
import prisma from '../../../db/prisma.js';
import { normalizeToken, normalizeTxHash, normalizeWallet } from '../runtime/chainIdentityNormalizer.js';
import { buildCanonicalOrderKey } from '../orders/canonicalOrderState.js';

type PositionIdentity = {
  id: string;
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  leaderTxHash: string | null;
  config: {
    targetWallet: string;
  } | null;
};

function normalizeOptionalText(value: unknown): string | null {
  const raw = String(value || '').trim();
  return raw || null;
}

async function resolvePositionIdentityById(positionId: string): Promise<PositionIdentity | null> {
  return prisma.position.findUnique({
    where: { id: positionId },
    select: {
      id: true,
      userId: true,
      configId: true,
      chainId: true,
      tokenAddress: true,
      leaderTxHash: true,
      config: {
        select: {
          targetWallet: true,
        },
      },
    },
  });
}

async function resolveLatestPositionIdentity(params: {
  userId: string;
  chainId: number;
  tokenAddress: string;
}): Promise<PositionIdentity | null> {
  return prisma.position.findFirst({
    where: {
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: {
        equals: normalizeToken(params.chainId, params.tokenAddress),
        mode: 'insensitive',
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      id: true,
      userId: true,
      configId: true,
      chainId: true,
      tokenAddress: true,
      leaderTxHash: true,
      config: {
        select: {
          targetWallet: true,
        },
      },
    },
  });
}

async function appendFollowerFact(position: PositionIdentity, params: {
  kind: 'buy' | 'approval' | 'exit';
  phase: 'submitted' | 'confirmed' | 'failed' | 'deferred' | 'skipped';
  txHash?: string | null;
  walletAddress?: string | null;
  amountRaw?: string | null;
  reasonCode?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const targetWallet = normalizeWallet(position.chainId, position.config?.targetWallet);
  const leaderTxHash = normalizeTxHash(position.chainId, position.leaderTxHash);
  if (!targetWallet || !leaderTxHash) return;

  const canonicalKey = buildCanonicalOrderKey({
    userId: position.userId,
    configId: position.configId,
    chainId: position.chainId,
    targetWallet,
    tokenAddress: position.tokenAddress,
    leaderTxHash,
    direction: 'buy',
  });
  const order = await prisma.copytradeOrder.findUnique({
    where: { canonicalKey },
    select: {
      id: true,
      lifecycleState: true,
    },
  });
  if (!order?.id) return;

  await prisma.copytradeOrderEvent.create({
    data: {
      id: crypto.randomUUID(),
      orderId: order.id,
      eventType: 'FOLLOWER_TX_FACT',
      lifecycleState: order.lifecycleState,
      reasonCode: normalizeOptionalText(params.reasonCode) || 'ok_follower_tx_fact',
      payloadJson: {
        kind: params.kind,
        phase: params.phase,
        positionId: position.id,
        userId: position.userId,
        configId: position.configId,
        chainId: position.chainId,
        tokenAddress: normalizeToken(position.chainId, position.tokenAddress),
        targetWallet,
        leaderTxHash,
        walletAddress: normalizeWallet(position.chainId, params.walletAddress || null),
        txHash: normalizeOptionalText(params.txHash),
        amountRaw: normalizeOptionalText(params.amountRaw),
        metadata: params.metadata || null,
      } as Prisma.InputJsonValue,
    },
  }).catch(() => {});
}

export async function recordFollowerTransactionFactByPosition(params: {
  positionId: string;
  kind: 'buy' | 'approval' | 'exit';
  phase: 'submitted' | 'confirmed' | 'failed' | 'deferred' | 'skipped';
  txHash?: string | null;
  walletAddress?: string | null;
  amountRaw?: string | null;
  reasonCode?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const position = await resolvePositionIdentityById(params.positionId);
  if (!position) return;
  await appendFollowerFact(position, params);
}

export async function recordFollowerTransactionFactForLatestPosition(params: {
  userId: string;
  chainId: number;
  tokenAddress: string;
  kind: 'buy' | 'approval' | 'exit';
  phase: 'submitted' | 'confirmed' | 'failed' | 'deferred' | 'skipped';
  txHash?: string | null;
  walletAddress?: string | null;
  amountRaw?: string | null;
  reasonCode?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const position = await resolveLatestPositionIdentity(params);
  if (!position) return;
  await appendFollowerFact(position, params);
}

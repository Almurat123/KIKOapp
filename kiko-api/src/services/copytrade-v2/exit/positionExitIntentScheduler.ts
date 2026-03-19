import { ethers } from 'ethers';

import prisma from '../../../db/prisma.js';
import { classifyCopytradeAssetEligibility } from '../../copytradeAssetEligibility.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { normalizeToken, normalizeWallet } from '../runtime/chainIdentityNormalizer.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';
import {
  computeDesiredMirrorSellRaw,
  resolveExitIntentLane,
  type PositionExitIntentPayload,
  type TargetSellEventPayload,
} from './intentTypes.js';
import { advanceCanonicalOrderState } from '../orders/canonicalOrderState.js';
import { enqueuePositionExitIntent } from './positionExitIntentStore.js';
import { replaceTargetSellEventMetadata, upsertTargetSellEvent, type TargetSellEventRecord } from './targetSellEventStore.js';
import type { PositionExitReason } from './types.js';
import { nudgePositionExitIntentWorker } from './positionExitIntentWorker.js';
import { persistTerminalExitBlockState } from './persistence.js';
import {
  cloneTargetSellEventReconcileMetadata,
  markTargetSellEventConfigResolved,
} from './targetSellEventReconcileState.js';

function parsePositiveBigInt(value: unknown): bigint {
  const raw = String(value || '').trim();
  if (!raw || !/^\d+$/.test(raw)) return 0n;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

function deriveEntryAmountRaw(position: {
  entryAmountExact?: string | null;
  entryAmountDec?: { toString(): string } | string | number | null;
}, decimals = 18): bigint {
  const exact = parsePositiveBigInt(position.entryAmountExact);
  if (exact > 0n) return exact;
  const decText = String(position.entryAmountDec || '').trim();
  if (!decText) return 0n;
  try {
    return ethers.parseUnits(decText, decimals);
  } catch {
    return 0n;
  }
}

async function resolveTrackedRemainingRaw(params: {
  position: {
    id: string;
    chainId: number;
    tokenAddress: string;
    entryAmountExact?: string | null;
    entryAmountDec?: { toString(): string } | string | number | null;
  };
  targetWallet?: string | null;
}): Promise<bigint> {
  await syncCopytradeLedgerFromLegacy({
    positionId: params.position.id,
    targetWallet: params.targetWallet,
  }).catch(() => null);
  const row = await prisma.copytradePositionLedger.findUnique({
    where: { positionIdLegacy: params.position.id },
    select: {
      trackedRemainingRaw: true,
      effectiveOwnedAmountRaw: true,
      sellableAmountRaw: true,
    },
  }).catch(() => null);
  return parsePositiveBigInt(row?.trackedRemainingRaw)
    || parsePositiveBigInt(row?.sellableAmountRaw)
    || parsePositiveBigInt(row?.effectiveOwnedAmountRaw)
    || deriveEntryAmountRaw(params.position);
}

export async function persistTargetSellEventAndSchedulePositions(params: {
  event: TargetSellEventPayload;
  positions: Array<{
    id: string;
    orderId?: string | null;
    userId: string;
    configId: string;
    chainId: number;
    tokenAddress: string;
    entryAmountExact?: string | null;
    entryAmountDec?: { toString(): string } | string | number | null;
  }>;
  priority?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ event: TargetSellEventRecord; scheduled: number; skipped: number }> {
  const event = await upsertTargetSellEvent({
    ...params.event,
    metadata: {
      ...(params.event.metadata || {}),
      ...(params.metadata || {}),
    },
  });
  return scheduleMirrorSellIntentsForEvent({
    event,
    positions: params.positions,
    priority: params.priority,
  });
}

export async function scheduleMirrorSellIntentsForEvent(params: {
  event: TargetSellEventRecord;
  positions: Array<{
    id: string;
    orderId?: string | null;
    userId: string;
    configId: string;
    chainId: number;
    tokenAddress: string;
    entryAmountExact?: string | null;
    entryAmountDec?: { toString(): string } | string | number | null;
  }>;
  priority?: number;
}): Promise<{ event: TargetSellEventRecord; scheduled: number; skipped: number }> {
  const event = params.event;
  let scheduled = 0;
  let skipped = 0;
  let metadata = cloneTargetSellEventReconcileMetadata(event.metadata);
  let metadataChanged = false;
  for (const position of params.positions) {
    const assetEligibility = classifyCopytradeAssetEligibility({
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
    });
    if (!assetEligibility.allowed) {
      await persistTerminalExitBlockState({
        positions: [{ id: position.id } as any],
        targetWallet: params.event.targetWallet,
        reasonCode: assetEligibility.reasonCode || 'forbidden_asset',
      }).catch(() => undefined);
      skipped += 1;
      markTargetSellEventConfigResolved({
        metadata,
        configId: position.configId,
        blockedReason: 'forbidden_asset',
        reasonCode: assetEligibility.reasonCode || 'forbidden_asset',
      });
      metadataChanged = true;
      emitCopytradeDomainAudit('mirror_sell_idempotent_skip', {
        extra: {
          positionId: position.id,
          userId: position.userId,
          chainId: position.chainId,
          tokenAddress: position.tokenAddress,
          targetWallet: params.event.targetWallet,
          targetSellTxHash: event.targetSellTxHash,
          blockedReason: 'forbidden_asset',
          reasonCode: assetEligibility.reasonCode,
        },
      });
      continue;
    }

    const trackedRemainingRaw = await resolveTrackedRemainingRaw({
      position,
      targetWallet: params.event.targetWallet,
    });
    const ratioBps = Number(event.targetSellRatioBps || 0);
    const desiredSellRaw = ratioBps > 0
      ? computeDesiredMirrorSellRaw({ trackedRemainingRaw, ratioBps })
      : trackedRemainingRaw;
    const payload: PositionExitIntentPayload = {
      positionId: position.id,
      userId: position.userId,
      configId: position.configId,
      chainId: position.chainId,
      tokenAddress: normalizeToken(position.chainId, position.tokenAddress),
      exitReason: 'mirror_sell',
      sourceEventId: event.id,
      targetSellTxHash: event.targetSellTxHash,
      desiredSellRaw: desiredSellRaw > 0n ? desiredSellRaw.toString() : null,
      priority: params.priority ?? 200,
      lane: resolveExitIntentLane(position.chainId),
      metadata: {
        trackedRemainingRaw: trackedRemainingRaw.toString(),
        targetSellRatioBps: event.targetSellRatioBps,
        targetFullExitVerified: event.targetFullExitVerified,
        targetWallet: event.targetWallet,
        orderId: position.orderId || null,
      },
    };
    const result = await enqueuePositionExitIntent(payload);
    if (result.created) {
      if (position.orderId) {
        await advanceCanonicalOrderState({
          orderId: position.orderId,
          lifecycleState: 'EXIT_ARMED',
          reasonCode: 'exit_armed_from_target_sell',
          eventType: 'ORDER_EXIT_INTENT_SCHEDULED',
          metadataPatch: {
            targetSellTxHash: event.targetSellTxHash || null,
            positionIdLegacy: position.id,
            lastKnownExposureSource: 'exit_intent_projection',
          },
        }).catch(() => null);
      }
      scheduled += 1;
      markTargetSellEventConfigResolved({
        metadata,
        configId: position.configId,
        blockedReason: 'scheduled',
        reasonCode: 'mirror_sell_intent_scheduled',
      });
      metadataChanged = true;
      nudgePositionExitIntentWorker(payload.lane);
      continue;
    }
    skipped += 1;
    markTargetSellEventConfigResolved({
      metadata,
      configId: position.configId,
      blockedReason: 'active_intent',
      reasonCode: 'position_exit_intent_active',
    });
    metadataChanged = true;
    emitCopytradeDomainAudit('mirror_sell_idempotent_skip', {
      extra: {
        positionId: position.id,
        userId: position.userId,
        chainId: position.chainId,
        tokenAddress: position.tokenAddress,
        targetWallet: event.targetWallet,
        targetSellTxHash: event.targetSellTxHash,
        blockedReason: 'active_intent',
        reasonCode: 'position_exit_intent_active',
      },
    });
  }
  if (metadataChanged) {
    const replaced = await replaceTargetSellEventMetadata(event.id, metadata).catch(() => null);
    if (replaced) {
      metadata = cloneTargetSellEventReconcileMetadata(replaced.metadata);
    }
  }
  return { event, scheduled, skipped };
}

export async function schedulePositionExitIntent(params: {
  position: {
    id: string;
    userId: string;
    configId: string;
    chainId: number;
    tokenAddress: string;
    orderId?: string | null;
  };
  exitReason: PositionExitReason;
  priority?: number;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const result = await enqueuePositionExitIntent({
    positionId: params.position.id,
    userId: params.position.userId,
    configId: params.position.configId,
    chainId: params.position.chainId,
    tokenAddress: normalizeToken(params.position.chainId, params.position.tokenAddress),
    exitReason: params.exitReason,
    priority: params.priority ?? 150,
    lane: resolveExitIntentLane(params.position.chainId),
    metadata: {
      ...(params.metadata || {}),
      orderId: params.position.orderId || (params.metadata as Record<string, unknown> | undefined)?.orderId || null,
    },
  });
  if (result.created) {
    const orderId = String(params.position.orderId || (params.metadata as Record<string, unknown> | undefined)?.orderId || '').trim();
    if (orderId) {
      await advanceCanonicalOrderState({
        orderId,
        lifecycleState: 'EXIT_ARMED',
        reasonCode: params.exitReason === 'mirror_sell' ? 'exit_armed_from_target_sell' : 'ok_exit_armed',
        eventType: 'ORDER_EXIT_INTENT_SCHEDULED',
        metadataPatch: {
          positionIdLegacy: params.position.id,
          lastKnownExposureSource: 'exit_intent_projection',
        },
      }).catch(() => null);
    }
    nudgePositionExitIntentWorker(resolveExitIntentLane(params.position.chainId));
  }
  return result.created;
}

export function buildTargetSellEventPayload(params: {
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
  targetSellTxHash: string;
  targetSellRatioBps?: number | null;
  targetFullExitVerified?: boolean;
  targetRemainingBalanceRaw?: string | null;
  source: TargetSellEventPayload['source'];
  metadata?: Record<string, unknown>;
}): TargetSellEventPayload {
  return {
    chainId: params.chainId,
    targetWallet: normalizeWallet(params.chainId, params.targetWallet),
    tokenAddress: normalizeToken(params.chainId, params.tokenAddress),
    targetSellTxHash: params.targetSellTxHash,
    targetSellRatioBps: params.targetSellRatioBps ?? null,
    targetFullExitVerified: params.targetFullExitVerified,
    targetRemainingBalanceRaw: params.targetRemainingBalanceRaw ?? null,
    detectedAt: new Date(),
    source: params.source,
    metadata: params.metadata,
  };
}

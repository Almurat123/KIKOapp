import type { MirrorSellIntentDecision } from '../positions/mirrorSellIntentPolicy.js';

export interface CanonicalOrderLike {
  lifecycleState?: string | null;
  metadata?: Record<string, unknown> | null;
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = String(metadata?.[key] || '').trim();
  return value || null;
}

export function resolveCanonicalSellPreemption(order?: CanonicalOrderLike | null): MirrorSellIntentDecision {
  if (!order) {
    return { disposition: 'none' };
  }

  const metadata = order.metadata || {};
  const targetSellTxHash = readMetadataString(metadata, 'targetSellTxHash');
  if (!targetSellTxHash) {
    return { disposition: 'none' };
  }

  return {
    disposition: 'execute_immediately',
    targetSellTxHash,
    reasonCode: readMetadataString(metadata, 'targetSellReasonCode')
      || readMetadataString(metadata, 'lastExecutionReasonCode')
      || 'ORDER_TARGET_SELL_PREEMPTED',
  };
}

export function shouldAwaitBuyConfirmationForMirrorSell(params: {
  exitReason?: string | null;
  positionStatus?: string | null;
  canonicalOrderLifecycle?: string | null;
  entryTxHash?: string | null;
}): boolean {
  if (String(params.exitReason || '').trim().toLowerCase() !== 'mirror_sell') {
    return false;
  }

  if (canExecuteMirrorSellFromPendingExposure(params)) {
    return false;
  }

  const normalizedStatus = String(params.positionStatus || '').trim().toLowerCase();
  if (normalizedStatus === 'pending_broadcast' || normalizedStatus === 'broadcasted_unseen') {
    return true;
  }

  const lifecycleState = String(params.canonicalOrderLifecycle || '').trim().toUpperCase();
  return lifecycleState === 'BUY_SUBMITTING'
    || lifecycleState === 'BUY_SEND_STARTED'
    || lifecycleState === 'BUY_ACCEPTED'
    || lifecycleState === 'BUY_VISIBLE'
    || lifecycleState === 'BUY_AWAITING_FINALITY';
}

export function canExecuteMirrorSellFromPendingExposure(params: {
  exitReason?: string | null;
  positionStatus?: string | null;
  canonicalOrderLifecycle?: string | null;
  entryTxHash?: string | null;
}): boolean {
  if (String(params.exitReason || '').trim().toLowerCase() !== 'mirror_sell') {
    return false;
  }

  const lifecycleState = String(params.canonicalOrderLifecycle || '').trim().toUpperCase();
  if (lifecycleState !== 'EXIT_ARMED' && lifecycleState !== 'EXIT_AWAITING_FINALITY') {
    return false;
  }

  const entryTxHash = readMetadataString(
    params.entryTxHash ? { entryTxHash: params.entryTxHash } : null,
    'entryTxHash',
  );
  if (!entryTxHash) {
    return false;
  }

  const normalizedStatus = String(params.positionStatus || '').trim().toLowerCase();
  return normalizedStatus === 'pending_broadcast' || normalizedStatus === 'broadcasted_unseen';
}

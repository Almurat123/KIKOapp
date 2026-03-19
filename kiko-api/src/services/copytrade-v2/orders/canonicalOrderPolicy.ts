export interface CanonicalOrderLike {
  lifecycleState?: string | null;
  metadata?: Record<string, unknown> | null;
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = String(metadata?.[key] || '').trim();
  return value || null;
}

export function resolveCanonicalSellPreemption(order?: CanonicalOrderLike | null): {
  shouldMirrorSell: boolean;
  targetSellTxHash?: string;
  reasonCode?: string;
} {
  if (!order) {
    return { shouldMirrorSell: false };
  }

  const metadata = order.metadata || {};
  const targetSellTxHash = readMetadataString(metadata, 'targetSellTxHash');
  if (!targetSellTxHash) {
    return { shouldMirrorSell: false };
  }

  return {
    shouldMirrorSell: true,
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
}): boolean {
  if (String(params.exitReason || '').trim().toLowerCase() !== 'mirror_sell') {
    return false;
  }

  const normalizedStatus = String(params.positionStatus || '').trim().toLowerCase();
  if (normalizedStatus === 'pending_broadcast' || normalizedStatus === 'broadcasted_unseen') {
    return true;
  }

  const lifecycleState = String(params.canonicalOrderLifecycle || '').trim().toUpperCase();
  return lifecycleState === 'BUY_SUBMITTING' || lifecycleState === 'BUY_ACCEPTED';
}

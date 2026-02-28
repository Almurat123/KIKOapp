import type { TxLifecycleResult } from '../../txLifecycle.js';
import { snapshotOrderRuntime } from '../context.js';
import type { OrderRuntimeContext } from '../types.js';

export type PositionBusinessStatus = 'pending' | 'open' | 'closing' | 'closed' | 'failed';

export function resolvePositionOpeningStatus(
  runtimeContext?: OrderRuntimeContext | null,
  lifecycle?: TxLifecycleResult | null
): PositionBusinessStatus {
  const state = runtimeContext?.state;
  if (state === 'confirmed_success' || state === 'mempool_visible' || state === 'included' || state === 'hash_accepted') {
    return 'open';
  }
  const lifecycleStatus = lifecycle?.status || runtimeContext?.lastLifecycle?.status;
  if (lifecycleStatus === 'confirmed_success' || lifecycleStatus === 'visible_pending') {
    return 'open';
  }
  if (lifecycleStatus === 'confirmed_failed') {
    return 'failed';
  }
  if (state === 'failed' || state === 'confirmed_failed' || state === 'fallback_failed') {
    return 'failed';
  }
  return 'pending';
}

export function buildOrderAuditFields(runtimeContext?: OrderRuntimeContext | null): Record<string, any> {
  if (!runtimeContext) {
    return {
      orderId: null,
      orderState: null,
      orderReasonCode: null,
      canonicalTxHash: null,
      fallbackUsed: null,
      route_ms: null,
      send_ms: null,
      visible_ms: null,
      total_ms: null
    };
  }
  const snapshot = snapshotOrderRuntime(runtimeContext);
  return {
    orderId: snapshot.orderId,
    orderState: snapshot.state,
    orderReasonCode: snapshot.reasonCode,
    canonicalTxHash: snapshot.canonicalTxHash || null,
    allTxHashes: snapshot.relatedTxHashes,
    fallbackUsed: snapshot.fallbackUsed,
    route_ms: snapshot.metrics.routeMs,
    send_ms: snapshot.metrics.sendMs,
    visible_ms: snapshot.metrics.visibleMs,
    total_ms: snapshot.metrics.totalMs
  };
}

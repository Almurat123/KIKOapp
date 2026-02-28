import type { TxLifecycleResult } from '../../txLifecycle.js';
import { snapshotOrderRuntime } from '../context.js';
import type { OrderRuntimeContext } from '../types.js';
import { getAdjudicatedSnapshot } from '../adjudicator/service.js';
import { resolveTxFinalState } from '../adjudicator/finalState.js';

export type PositionBusinessStatus = 'pending' | 'open' | 'closing' | 'closed' | 'failed';

export function resolvePositionOpeningStatus(
  runtimeContext?: OrderRuntimeContext | null,
  lifecycle?: TxLifecycleResult | null
): PositionBusinessStatus {
  const finalState = resolveTxFinalState({
    runtimeContext,
    lifecycle
  });
  if (finalState.accepted) {
    return 'open';
  }
  if (finalState.failed) {
    return 'failed';
  }
  return 'pending';
}

export function buildOrderAuditFields(runtimeContext?: OrderRuntimeContext | null): Record<string, any> {
  const adjudicated = getAdjudicatedSnapshot({
    orderId: runtimeContext?.orderId,
    chainId: runtimeContext?.chainId,
    txHash: runtimeContext?.canonicalTxHash
  });
  if (!runtimeContext) {
    return {
      orderId: null,
      orderState: null,
      orderReasonCode: null,
      canonicalTxHash: null,
      adjudicatedState: adjudicated?.adjudicated.state || null,
      adjudicatedReason: adjudicated?.adjudicated.reasonCode || null,
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
    adjudicatedState: adjudicated?.adjudicated.state || null,
    adjudicatedReason: adjudicated?.adjudicated.reasonCode || null,
    fallbackUsed: snapshot.fallbackUsed,
    route_ms: snapshot.metrics.routeMs,
    send_ms: snapshot.metrics.sendMs,
    visible_ms: snapshot.metrics.visibleMs,
    total_ms: snapshot.metrics.totalMs
  };
}

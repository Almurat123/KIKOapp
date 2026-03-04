import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { snapshotOrderRuntime } from '../context.js';
import type { OrderRuntimeContext } from '../types.js';
import { buildExecutionLifecycleAuditFields } from '../../swap/lifecycle/executionLifecycleTranslator.js';

export function logOrderRuntimeSnapshot(ctx: OrderRuntimeContext, label: string): void {
  const snapshot = snapshotOrderRuntime(ctx);
  logger.info(LogCode.SYS_INFO, label, {
    ...buildExecutionLifecycleAuditFields({ runtimeContext: ctx }),
    orderId: snapshot.orderId,
    state: snapshot.state,
    reasonCode: snapshot.reasonCode,
    provider: snapshot.route.provider || null,
    poolKind: snapshot.route.poolKind || null,
    poolAddress: snapshot.route.poolAddress || null,
    sourceTxHash: snapshot.sourceTxHash || null,
    canonicalTxHash: snapshot.canonicalTxHash || null,
    allTxHashes: snapshot.relatedTxHashes,
    fallbackUsed: snapshot.fallbackUsed,
    route_ms: snapshot.metrics.routeMs,
    send_ms: snapshot.metrics.sendMs,
    visible_ms: snapshot.metrics.visibleMs,
    total_ms: snapshot.metrics.totalMs,
    attempts: snapshot.attempts.map((attempt) => ({
      attempt: attempt.attempt,
      channel: attempt.channel,
      state: attempt.state,
      txHash: attempt.txHash || null,
      reasonCode: attempt.reasonCode || null,
      error: attempt.error || null
    }))
  });
}

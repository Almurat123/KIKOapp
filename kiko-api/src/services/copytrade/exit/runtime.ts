import {
  attachOrderTxHash,
  createOrderRuntimeContext,
  setOrderMetadata,
  snapshotOrderRuntime
} from '../../order-runtime/context.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { MainSwapResult } from '../../MainSwapService.js';
import type { PositionExitReason } from './types.js';

export function createExitOrderRuntimeContext(seed: {
  userId: string;
  walletAddress: string;
  chainId: number;
  tokenAddress: string;
  exitReason: PositionExitReason;
  targetWallet?: string;
}): OrderRuntimeContext {
  return createOrderRuntimeContext({
    userId: seed.userId,
    walletAddress: seed.walletAddress,
    chainId: seed.chainId,
    side: 'sell',
    mode: 'copytrade',
    tokenIn: seed.tokenAddress,
    tokenOut: 'ETH',
    metadata: {
      exitReason: seed.exitReason,
      targetWallet: seed.targetWallet || null,
      flow: 'copytrade_exit'
    }
  });
}

export function mergeSwapResultIntoExitRuntime(
  target: OrderRuntimeContext,
  swapResult?: MainSwapResult | null
): OrderRuntimeContext {
  const source = swapResult?.runtimeContext;
  if (!source) return target;

  const snapshot = snapshotOrderRuntime(source);
  target.state = snapshot.state;
  target.reasonCode = snapshot.reasonCode;
  target.route = { ...snapshot.route };
  target.lastLifecycle = snapshot.lastLifecycle ? { ...snapshot.lastLifecycle } : target.lastLifecycle;
  target.fallbackUsed = target.fallbackUsed || snapshot.fallbackUsed;
  target.metadata = { ...target.metadata, ...snapshot.metadata };

  if (!target.timing.routeStartedAt && source.timing.routeStartedAt) target.timing.routeStartedAt = source.timing.routeStartedAt;
  if (!target.timing.routeSelectedAt && source.timing.routeSelectedAt) target.timing.routeSelectedAt = source.timing.routeSelectedAt;
  if (!target.timing.txPreparedAt && source.timing.txPreparedAt) target.timing.txPreparedAt = source.timing.txPreparedAt;
  if (!target.timing.sendStartedAt && source.timing.sendStartedAt) target.timing.sendStartedAt = source.timing.sendStartedAt;
  if (!target.timing.hashAcceptedAt && source.timing.hashAcceptedAt) target.timing.hashAcceptedAt = source.timing.hashAcceptedAt;
  if (!target.timing.visibleAt && source.timing.visibleAt) target.timing.visibleAt = source.timing.visibleAt;
  if (!target.timing.includedAt && source.timing.includedAt) target.timing.includedAt = source.timing.includedAt;
  if (!target.timing.finishedAt && source.timing.finishedAt) target.timing.finishedAt = source.timing.finishedAt;

  for (const txHash of snapshot.relatedTxHashes) {
    attachOrderTxHash(target, txHash, { canonical: txHash === snapshot.canonicalTxHash });
  }

  if (snapshot.attempts.length > 0) {
    target.attempts = snapshot.attempts.map((attempt, index) => ({
      ...attempt,
      id: `${target.orderId}:attempt:${index + 1}`
    }));
  }

  setOrderMetadata(target, {
    directProvider: snapshot.route.provider || null,
    fallbackUsed: snapshot.fallbackUsed,
    lastTxLifecycleStatus: snapshot.lastLifecycle?.status || null
  });

  return target;
}

import { resolveTxFinalState } from '../../order-runtime/adjudicator/finalState.js';
import {
  getAdjudicatedSnapshot,
  hydrateSharedAdjudicatedSnapshot,
} from '../../order-runtime/adjudicator/service.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';
import { waitForTransactionConfirmation } from '../../swap/confirmationCoordinator.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';

export type CopytradeBuyPositionStatus = 'pending' | 'open' | 'failed';

export function resolveCopytradeBuyPositionStatus(
  runtimeContext?: OrderRuntimeContext | null,
  lifecycle?: TxLifecycleResult | null
): CopytradeBuyPositionStatus {
  const finalState = resolveTxFinalState({
    runtimeContext,
    lifecycle
  });
  if (finalState.success) {
    return 'open';
  }
  if (finalState.failed) {
    return 'failed';
  }
  return 'pending';
}

export async function waitForCopytradeBuyConfirmation(params: {
  chainId: number;
  txHash: string;
  timeoutMs: number;
  pollMs: number;
  txHashes?: string[];
  orderId?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  forceRefresh?: boolean;
  allowCachedUncertain?: boolean;
}, deps?: {
  resolveTxFinalState?: typeof resolveTxFinalState;
  waitForTransactionConfirmation?: typeof waitForTransactionConfirmation;
  getAdjudicatedSnapshot?: typeof getAdjudicatedSnapshot;
  hydrateSharedAdjudicatedSnapshot?: typeof hydrateSharedAdjudicatedSnapshot;
}): Promise<ConfirmationOutcome> {
  const resolveFinalState = deps?.resolveTxFinalState || resolveTxFinalState;
  const waitForConfirmation = deps?.waitForTransactionConfirmation || waitForTransactionConfirmation;
  const getSnapshot = deps?.getAdjudicatedSnapshot || getAdjudicatedSnapshot;
  const hydrateSnapshot = deps?.hydrateSharedAdjudicatedSnapshot || hydrateSharedAdjudicatedSnapshot;
  const orderId = params.orderId || params.runtimeContext?.orderId || undefined;
  const candidateTxHashes = [...new Set(
    [
      params.txHash,
      ...(params.txHashes || []),
      params.runtimeContext?.canonicalTxHash,
      ...(params.runtimeContext?.relatedTxHashes || []),
      params.runtimeContext?.lastLifecycle?.txHash,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  )];
  const waitTxHash = candidateTxHashes[0] || params.txHash;

  const resolveAliasAwareState = () => {
    const orderResolution = resolveFinalState({
      runtimeContext: params.runtimeContext,
      lifecycle: params.runtimeContext?.lastLifecycle,
      chainId: params.chainId,
      txHash: waitTxHash,
      orderId,
    });
    const orderSnapshot = getSnapshot({
      orderId,
      chainId: params.chainId,
      txHash: waitTxHash,
    });
    const resolvedTxHash = orderSnapshot?.canonicalTxHash
      || params.runtimeContext?.canonicalTxHash
      || candidateTxHashes[0]
      || waitTxHash;

    if (orderResolution.success) {
      return {
        resolution: orderResolution,
        resolvedTxHash,
      };
    }

    let firstFailed: {
      resolution: ReturnType<typeof resolveTxFinalState>;
      resolvedTxHash: string;
    } | null = null;
    for (const candidateTxHash of candidateTxHashes) {
      const resolution = resolveFinalState({
        chainId: params.chainId,
        txHash: candidateTxHash,
        orderId,
      });
      if (resolution.success) {
        return {
          resolution,
          resolvedTxHash: candidateTxHash,
        };
      }
      if (resolution.failed && !firstFailed) {
        firstFailed = {
          resolution,
          resolvedTxHash: candidateTxHash,
        };
      }
    }

    if (orderResolution.failed && !firstFailed) {
      firstFailed = {
        resolution: orderResolution,
        resolvedTxHash,
      };
    }

    return firstFailed || {
      resolution: orderResolution,
      resolvedTxHash,
    };
  };

  const initialState = resolveAliasAwareState();
  if (initialState.resolution.success) {
    return {
      success: true,
      kind: 'confirmed_success',
      visible: true,
      resolvedTxHash: initialState.resolvedTxHash,
    };
  }
  if (initialState.resolution.failed) {
    return {
      success: false,
      kind: 'confirmed_failed',
      reason: initialState.resolution.reasonCode || 'transaction_reverted',
      visible: initialState.resolution.visible,
      resolvedTxHash: initialState.resolvedTxHash,
    };
  }

  await hydrateSnapshot({
    orderId,
    chainId: params.chainId,
    txHash: waitTxHash,
  }).catch(() => null);

  const waited = await waitForConfirmation({
    txHash: waitTxHash,
    chainId: params.chainId,
    dexName: 'copytrade_buy',
    timeoutMs: params.timeoutMs,
    pollMs: params.pollMs,
    forceRefresh: params.forceRefresh,
    allowCachedUncertain: params.allowCachedUncertain,
  });

  const resolvedAfterWait = resolveAliasAwareState();
  if (resolvedAfterWait.resolution.success) {
    return {
      success: true,
      kind: 'confirmed_success',
      visible: true,
      receipt: waited.receipt,
      resolvedTxHash: resolvedAfterWait.resolvedTxHash,
    };
  }
  if (resolvedAfterWait.resolution.failed) {
    return {
      success: false,
      kind: 'confirmed_failed',
      reason: resolvedAfterWait.resolution.reasonCode || waited.reason || 'transaction_reverted',
      visible: resolvedAfterWait.resolution.visible || waited.visible,
      receipt: waited.receipt,
      resolvedTxHash: resolvedAfterWait.resolvedTxHash,
    };
  }

  return {
    ...waited,
    resolvedTxHash: waited.resolvedTxHash || waitTxHash,
  };
}

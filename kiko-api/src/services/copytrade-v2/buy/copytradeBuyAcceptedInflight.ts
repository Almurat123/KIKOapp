import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';
import { resolveTxFinalState } from '../../order-runtime/adjudicator/finalState.js';

export interface CopytradeBuyAcceptedInflightDecision {
  adoptAcceptedTx: boolean;
  txHash?: string;
  reasonCode: string;
  shouldDeferFeeCollection: boolean;
}

export function evaluateCopytradeBuyAcceptedInflight(params: {
  mode: string;
  isBuyDirection: boolean;
  chainId: number;
  txHash?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
}): CopytradeBuyAcceptedInflightDecision {
  if (params.mode !== 'copytrade' || !params.isBuyDirection) {
    return {
      adoptAcceptedTx: false,
      reasonCode: 'not_copytrade_buy',
      shouldDeferFeeCollection: false
    };
  }

  const resolution = resolveTxFinalState({
    runtimeContext: params.runtimeContext,
    lifecycle: params.lifecycle || undefined,
    chainId: params.chainId,
    txHash: params.txHash || params.runtimeContext?.canonicalTxHash
  });

  const acceptedTxHash = params.runtimeContext?.canonicalTxHash || params.txHash || undefined;
  if (!resolution.accepted || resolution.failed || !acceptedTxHash) {
    const runtimeState = String(params.runtimeContext?.state || '').trim().toLowerCase();
    const lifecycleStatus = String(params.lifecycle?.status || '').trim().toLowerCase();
    const hasDurableAcceptedEvidence = Boolean(acceptedTxHash)
      && !resolution.failed
      && (
        runtimeState === 'hash_accepted'
        || runtimeState === 'rpc_uncertain'
        || runtimeState === 'mempool_visible'
        || runtimeState === 'included'
        || lifecycleStatus === 'broadcasted_unseen'
        || lifecycleStatus === 'visible_pending'
      );
    if (hasDurableAcceptedEvidence) {
      return {
        adoptAcceptedTx: true,
        txHash: acceptedTxHash,
        reasonCode: runtimeState || lifecycleStatus || 'accepted_hash_present',
        shouldDeferFeeCollection: lifecycleStatus !== 'visible_pending' && lifecycleStatus !== 'confirmed_success',
      };
    }
    return {
      adoptAcceptedTx: false,
      reasonCode: resolution.reasonCode || 'not_accepted',
      shouldDeferFeeCollection: false
    };
  }

  return {
    adoptAcceptedTx: true,
    txHash: acceptedTxHash,
    reasonCode: resolution.reasonCode || resolution.state || 'send_accepted',
    shouldDeferFeeCollection: !resolution.visible && !resolution.success
  };
}

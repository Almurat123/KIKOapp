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

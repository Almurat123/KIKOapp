import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { resolveTxFinalState } from '../../order-runtime/adjudicator/finalState.js';

export interface CopytradeBuyRetryDecision {
  shouldAbortRetry: boolean;
  txHash?: string;
  reasonCode: string;
}

export function shouldAbortCopytradeBuyRetry(params: {
  chainId: number;
  runtimeContext?: OrderRuntimeContext | null;
}): CopytradeBuyRetryDecision {
  const resolution = resolveTxFinalState({
    runtimeContext: params.runtimeContext,
    chainId: params.chainId,
    txHash: params.runtimeContext?.canonicalTxHash
  });

  if (!resolution.accepted || resolution.failed) {
    return {
      shouldAbortRetry: false,
      reasonCode: resolution.reasonCode || 'no_accepted_evidence'
    };
  }

  return {
    shouldAbortRetry: true,
    txHash: params.runtimeContext?.canonicalTxHash,
    reasonCode: resolution.reasonCode || resolution.state || 'send_accepted'
  };
}

import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { evaluateCopytradeBuySendState } from './copytradeBuySendState.js';

export interface CopytradeBuyRetryDecision {
  shouldAbortRetry: boolean;
  txHash?: string;
  reasonCode: string;
}

export function shouldAbortCopytradeBuyRetry(params: {
  chainId: number;
  runtimeContext?: OrderRuntimeContext | null;
}): CopytradeBuyRetryDecision {
  const decision = evaluateCopytradeBuySendState({
    mode: params.runtimeContext?.mode || 'copytrade',
    isBuyDirection: params.runtimeContext?.side === 'buy',
    runtimeContext: params.runtimeContext,
    chainId: params.chainId,
    txHash: params.runtimeContext?.canonicalTxHash,
  });
  if (!decision.adoptAcceptedTx || !decision.txHash) {
    return {
      shouldAbortRetry: false,
      reasonCode: decision.reasonCode || 'no_accepted_evidence'
    };
  }

  return {
    shouldAbortRetry: true,
    txHash: decision.txHash,
    reasonCode: decision.reasonCode || 'send_accepted'
  };
}

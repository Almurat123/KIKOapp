import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { resolveCopytradeBuyEvidence } from './copytradeBuyEvidence.js';

export interface CopytradeBuyRetryDecision {
  shouldAbortRetry: boolean;
  txHash?: string;
  reasonCode: string;
}

export function shouldAbortCopytradeBuyRetry(params: {
  chainId: number;
  runtimeContext?: OrderRuntimeContext | null;
}): CopytradeBuyRetryDecision {
  const evidence = resolveCopytradeBuyEvidence({
    runtimeContext: params.runtimeContext,
    chainId: params.chainId,
    txHash: params.runtimeContext?.canonicalTxHash,
  });
  const resolution = evidence.resolution;

  if (!resolution.accepted || resolution.failed) {
    return {
      shouldAbortRetry: false,
      reasonCode: resolution.reasonCode || 'no_accepted_evidence'
    };
  }

  return {
    shouldAbortRetry: true,
    txHash: evidence.txHash,
    reasonCode: resolution.reasonCode || resolution.state || 'send_accepted'
  };
}

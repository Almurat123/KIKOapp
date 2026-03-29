import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';
import { evaluateCopytradeBuySendState } from './copytradeBuySendState.js';

export interface CopytradeBuyAcceptedInflightDecision {
  adoptAcceptedTx: boolean;
  blockAdditionalSend: boolean;
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
  const decision = evaluateCopytradeBuySendState(params);
  return {
    adoptAcceptedTx: decision.adoptAcceptedTx,
    blockAdditionalSend: decision.blockAdditionalSend,
    txHash: decision.txHash,
    reasonCode: decision.reasonCode,
    shouldDeferFeeCollection: decision.shouldDeferFeeCollection,
  };
}

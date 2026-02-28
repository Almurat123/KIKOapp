import type { TxLifecycleResult } from '../txLifecycle.js';
import type { OrderRuntimeContext } from '../order-runtime/types.js';
import { resolveTxFinalState } from '../order-runtime/adjudicator/finalState.js';

export interface VisibilityRetryDecision {
  retry: boolean;
  bumpGas: boolean;
  reason: string;
}

export function shouldRetryAfterBroadcastUnseen(params: {
  chainId: number;
  txHash?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
  attempt: number;
  maxRetries: number;
  hasNonce: boolean;
  txPurpose?: string | null;
  fastTradePath: boolean;
}): VisibilityRetryDecision {
  if (!params.hasNonce) {
    return { retry: false, bumpGas: false, reason: 'no_nonce' };
  }
  if (params.attempt >= params.maxRetries) {
    return { retry: false, bumpGas: false, reason: 'retry_budget_exhausted' };
  }
  const finalState = resolveTxFinalState({
    runtimeContext: params.runtimeContext,
    lifecycle: params.lifecycle || undefined,
    chainId: params.chainId,
    txHash: params.txHash || params.lifecycle?.txHash
  });
  if (finalState.visible || finalState.success) {
    return { retry: false, bumpGas: false, reason: `final_state_${finalState.state}` };
  }
  if (!params.fastTradePath && params.txPurpose !== 'trade' && params.txPurpose !== 'speedup') {
    return { retry: false, bumpGas: false, reason: 'non_trade_purpose' };
  }
  if (params.fastTradePath) {
    return { retry: false, bumpGas: false, reason: 'fast_trade_wait_for_shared_evidence' };
  }
  return { retry: true, bumpGas: true, reason: 'shared_evidence_still_uncertain' };
}

export function shouldPassVisibilityGate(params: {
  chainId: number;
  txHash?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
}): boolean {
  const finalState = resolveTxFinalState({
    runtimeContext: params.runtimeContext,
    lifecycle: params.lifecycle || undefined,
    chainId: params.chainId,
    txHash: params.txHash || params.lifecycle?.txHash
  });
  return finalState.visible || finalState.success;
}

export function describeVisibilityFailure(params: {
  chainId: number;
  txHash?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
}): { failure: string; reason: string } {
  const finalState = resolveTxFinalState({
    runtimeContext: params.runtimeContext,
    lifecycle: params.lifecycle || undefined,
    chainId: params.chainId,
    txHash: params.txHash || params.lifecycle?.txHash
  });
  if (finalState.state !== 'unknown') {
    return {
      failure: finalState.state,
      reason: finalState.reasonCode || 'none'
    };
  }
  return {
    failure: params.lifecycle?.status || 'broadcasted_unseen',
    reason: params.lifecycle?.lastRpcError || 'not_found_by_rpc'
  };
}

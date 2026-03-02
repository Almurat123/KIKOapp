import { resolveTxFinalState } from '../../order-runtime/adjudicator/finalState.js';
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
}): Promise<ConfirmationOutcome> {
  const initialState = resolveTxFinalState({
    chainId: params.chainId,
    txHash: params.txHash
  });
  if (initialState.success) {
    return {
      success: true,
      kind: 'confirmed_success',
      visible: true
    };
  }
  if (initialState.failed) {
    return {
      success: false,
      kind: 'confirmed_failed',
      reason: initialState.reasonCode || 'transaction_reverted',
      visible: initialState.visible
    };
  }
  return await waitForTransactionConfirmation({
    txHash: params.txHash,
    chainId: params.chainId,
    dexName: 'copytrade_buy',
    timeoutMs: params.timeoutMs,
    pollMs: params.pollMs
  });
}

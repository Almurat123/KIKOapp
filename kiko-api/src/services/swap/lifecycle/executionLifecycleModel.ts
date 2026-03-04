import type { MainSwapResult } from '../../MainSwapService.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';

export type ExecutionLifecycleState =
  | 'submitted'
  | 'accepted'
  | 'awaiting_visibility'
  | 'visible_pending'
  | 'confirmed_success'
  | 'confirmed_failed'
  | 'retryable_failure'
  | 'terminal_failure';

export interface ExecutionLifecycleSnapshot {
  state: ExecutionLifecycleState;
  reasonCode: string;
  txHash?: string | null;
  provider?: string | null;
  accepted: boolean;
  visible: boolean;
  confirmed: boolean;
  terminal: boolean;
}

function resolveLifecycleInput(input: {
  result?: Pick<MainSwapResult, 'success' | 'error' | 'txHash' | 'txLifecycle' | 'runtimeContext' | 'metadata'> | null;
  txLifecycle?: TxLifecycleResult | null;
  runtimeContext?: OrderRuntimeContext | null;
  error?: string | null;
}) {
  return {
    txLifecycle: input.txLifecycle || input.result?.txLifecycle || input.runtimeContext?.lastLifecycle || input.result?.runtimeContext?.lastLifecycle,
    runtimeContext: input.runtimeContext || input.result?.runtimeContext || null,
    txHash: input.result?.txHash || input.txLifecycle?.txHash || input.runtimeContext?.canonicalTxHash || input.result?.runtimeContext?.canonicalTxHash || null,
    provider: input.result?.metadata?.provider || input.runtimeContext?.route?.provider || input.result?.runtimeContext?.route?.provider || null,
    error: input.error || input.result?.error || null,
  };
}

export function resolveExecutionLifecycleSnapshot(input: {
  result?: Pick<MainSwapResult, 'success' | 'error' | 'txHash' | 'txLifecycle' | 'runtimeContext' | 'metadata'> | null;
  txLifecycle?: TxLifecycleResult | null;
  runtimeContext?: OrderRuntimeContext | null;
  error?: string | null;
}): ExecutionLifecycleSnapshot {
  const resolved = resolveLifecycleInput(input);
  const lifecycle = resolved.txLifecycle;
  const reasonCode = resolved.runtimeContext?.reasonCode
    || lifecycle?.lastRpcError
    || resolved.error
    || 'none';

  if (!lifecycle) {
    return {
      state: input.result?.success === false ? 'retryable_failure' : 'submitted',
      reasonCode,
      txHash: resolved.txHash,
      provider: resolved.provider,
      accepted: false,
      visible: false,
      confirmed: false,
      terminal: false,
    };
  }

  switch (lifecycle.status) {
    case 'confirmed_success':
      return {
        state: 'confirmed_success',
        reasonCode,
        txHash: resolved.txHash,
        provider: resolved.provider,
        accepted: true,
        visible: true,
        confirmed: true,
        terminal: true,
      };
    case 'confirmed_failed':
      return {
        state: 'confirmed_failed',
        reasonCode,
        txHash: resolved.txHash,
        provider: resolved.provider,
        accepted: true,
        visible: true,
        confirmed: true,
        terminal: true,
      };
    case 'visible_pending':
      return {
        state: 'visible_pending',
        reasonCode,
        txHash: resolved.txHash,
        provider: resolved.provider,
        accepted: true,
        visible: true,
        confirmed: false,
        terminal: false,
      };
    case 'broadcasted_unseen':
      return {
        state: 'awaiting_visibility',
        reasonCode,
        txHash: resolved.txHash,
        provider: resolved.provider,
        accepted: true,
        visible: false,
        confirmed: false,
        terminal: false,
      };
    case 'pending_broadcast':
      return {
        state: 'accepted',
        reasonCode,
        txHash: resolved.txHash,
        provider: resolved.provider,
        accepted: Boolean(resolved.txHash),
        visible: false,
        confirmed: false,
        terminal: false,
      };
    case 'dropped_timeout':
      return {
        state: 'terminal_failure',
        reasonCode,
        txHash: resolved.txHash,
        provider: resolved.provider,
        accepted: Boolean(resolved.txHash),
        visible: false,
        confirmed: false,
        terminal: true,
      };
    default:
      return {
        state: 'retryable_failure',
        reasonCode,
        txHash: resolved.txHash,
        provider: resolved.provider,
        accepted: Boolean(resolved.txHash),
        visible: false,
        confirmed: false,
        terminal: false,
      };
  }
}

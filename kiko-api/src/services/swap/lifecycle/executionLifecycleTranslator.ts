import type { MainSwapResult } from '../../MainSwapService.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';
import { resolveExecutionLifecycleSnapshot } from './executionLifecycleModel.js';

export function buildExecutionLifecycleAuditFields(input: {
  result?: Pick<MainSwapResult, 'success' | 'error' | 'txHash' | 'txLifecycle' | 'runtimeContext' | 'metadata'> | null;
  txLifecycle?: TxLifecycleResult | null;
  runtimeContext?: OrderRuntimeContext | null;
  error?: string | null;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const snapshot = resolveExecutionLifecycleSnapshot(input);
  return {
    executionLifecycleState: snapshot.state,
    executionLifecycleReasonCode: snapshot.reasonCode,
    executionLifecycleAccepted: snapshot.accepted,
    executionLifecycleVisible: snapshot.visible,
    executionLifecycleConfirmed: snapshot.confirmed,
    executionLifecycleTerminal: snapshot.terminal,
    executionTxHash: snapshot.txHash || null,
    executionProvider: snapshot.provider || null,
    ...(input.extra || {}),
  };
}

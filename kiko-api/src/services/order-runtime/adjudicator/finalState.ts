import type { TxLifecycleResult, TxLifecycleStatus } from '../../txLifecycle.js';
import type { OrderRuntimeContext, OrderState } from '../types.js';
import { getAdjudicatedSnapshot } from './service.js';
import type { AdjudicatedTxState } from './types.js';

export interface TxFinalStateResolution {
  state: AdjudicatedTxState;
  reasonCode: string;
  terminal: boolean;
  accepted: boolean;
  visible: boolean;
  success: boolean;
  failed: boolean;
  source: 'adjudicator' | 'runtime' | 'lifecycle' | 'none';
}

function flagsForState(state: AdjudicatedTxState, terminal: boolean) {
  return {
    terminal,
    accepted: state === 'send_accepted' || state === 'rpc_visible' || state === 'chain_observed' || state === 'confirmed_success',
    visible: state === 'rpc_visible' || state === 'chain_observed' || state === 'confirmed_success',
    success: state === 'confirmed_success',
    failed: state === 'confirmed_failed'
  };
}

function fromAdjudicatedState(state?: AdjudicatedTxState | null, reasonCode?: string, final?: boolean): TxFinalStateResolution | null {
  if (!state || state === 'unknown') return null;
  return {
    state,
    reasonCode: reasonCode || 'none',
    source: 'adjudicator',
    ...flagsForState(state, Boolean(final))
  };
}

function fromRuntimeState(state?: OrderState | null, reasonCode?: string): TxFinalStateResolution | null {
  if (!state) return null;
  const mapped: AdjudicatedTxState | null =
    state === 'confirmed_success' ? 'confirmed_success'
      : state === 'confirmed_failed' || state === 'failed' || state === 'fallback_failed' ? 'confirmed_failed'
        : state === 'included' || state === 'mempool_visible' ? 'rpc_visible'
          : state === 'hash_accepted' ? 'send_accepted'
            : state === 'rpc_uncertain' ? 'rpc_uncertain'
              : null;
  if (!mapped) return null;
  const terminal = mapped === 'confirmed_success' || mapped === 'confirmed_failed';
  return {
    state: mapped,
    reasonCode: reasonCode || 'none',
    source: 'runtime',
    ...flagsForState(mapped, terminal)
  };
}

function fromLifecycleStatus(status?: TxLifecycleStatus | 'send_failed' | null, reasonCode?: string): TxFinalStateResolution | null {
  if (!status) return null;
  const mapped: AdjudicatedTxState | null =
    status === 'confirmed_success' ? 'confirmed_success'
      : status === 'confirmed_failed' || status === 'dropped_timeout' || status === 'send_failed' ? 'confirmed_failed'
        : status === 'visible_pending' ? 'rpc_visible'
          : status === 'broadcasted_unseen' ? 'rpc_uncertain'
            : status === 'pending_broadcast' ? 'unknown'
              : null;
  if (!mapped || mapped === 'unknown') return null;
  const terminal = mapped === 'confirmed_success' || mapped === 'confirmed_failed';
  return {
    state: mapped,
    reasonCode: reasonCode || 'none',
    source: 'lifecycle',
    ...flagsForState(mapped, terminal)
  };
}

export function resolveTxFinalState(params: {
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | { status?: TxLifecycleStatus | 'send_failed'; lastRpcError?: string } | null;
  chainId?: number;
  txHash?: string | null;
  orderId?: string | null;
}): TxFinalStateResolution {
  const runtimeContext = params.runtimeContext;
  const lifecycle = params.lifecycle;
  const lifecycleTxHash = lifecycle && 'txHash' in lifecycle ? lifecycle.txHash : undefined;
  const snapshot = getAdjudicatedSnapshot({
    orderId: params.orderId || runtimeContext?.orderId,
    chainId: params.chainId || runtimeContext?.chainId,
    txHash: params.txHash || runtimeContext?.canonicalTxHash || lifecycleTxHash
  });

  const adjudicated = fromAdjudicatedState(
    snapshot?.adjudicated.state,
    snapshot?.adjudicated.reasonCode,
    snapshot?.adjudicated.final
  );
  if (adjudicated) return adjudicated;

  const runtime = fromRuntimeState(runtimeContext?.state, runtimeContext?.reasonCode);
  if (runtime) return runtime;

  const lifecycleState = fromLifecycleStatus(lifecycle?.status, lifecycle?.lastRpcError);
  if (lifecycleState) return lifecycleState;

  return {
    state: 'unknown',
    reasonCode: 'none',
    terminal: false,
    accepted: false,
    visible: false,
    success: false,
    failed: false,
    source: 'none'
  };
}

export function toLifecycleResultFromFinalState(params: {
  chainId: number;
  txHash: string;
  resolution: TxFinalStateResolution;
  attempts?: number;
  firstSeenAt?: number;
  confirmedAt?: number;
}): TxLifecycleResult {
  const status: TxLifecycleStatus =
    params.resolution.state === 'confirmed_success' ? 'confirmed_success'
      : params.resolution.state === 'confirmed_failed' ? 'confirmed_failed'
        : params.resolution.state === 'rpc_visible' || params.resolution.state === 'chain_observed' ? 'visible_pending'
          : params.resolution.state === 'send_accepted' || params.resolution.state === 'rpc_uncertain' ? 'broadcasted_unseen'
            : 'dropped_timeout';
  return {
    status,
    txHash: params.txHash,
    chainId: params.chainId,
    attempts: params.attempts || 0,
    firstSeenAt: params.firstSeenAt,
    confirmedAt: params.confirmedAt,
    lastRpcError: params.resolution.reasonCode || undefined
  };
}

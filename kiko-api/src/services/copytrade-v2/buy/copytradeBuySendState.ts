import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';
import { resolveCopytradeBuyEvidence } from './copytradeBuyEvidence.js';

export type CopytradeBuySendState =
  | 'not_copytrade_buy'
  | 'no_send_evidence'
  | 'send_inflight'
  | 'send_adopted';

export interface CopytradeBuySendStateDecision {
  sendState: CopytradeBuySendState;
  allowFallback: boolean;
  blockAdditionalSend: boolean;
  adoptAcceptedTx: boolean;
  txHash?: string;
  reasonCode: string;
  shouldDeferFeeCollection: boolean;
}

function hasRuntimeSendStarted(runtimeContext?: OrderRuntimeContext | null): boolean {
  const runtimeState = String(runtimeContext?.state || '').trim().toLowerCase();
  return runtimeState === 'send_started'
    || runtimeContext?.attempts?.some((attempt) => attempt.state === 'sending') === true;
}

function hasDurableAcceptedEvidence(params: {
  acceptedTxHash?: string;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
  accepted: boolean;
  failed: boolean;
}): boolean {
  if (!params.acceptedTxHash || params.failed) return false;
  if (params.accepted) return true;
  const runtimeState = String(params.runtimeContext?.state || '').trim().toLowerCase();
  const lifecycleStatus = String(params.lifecycle?.status || '').trim().toLowerCase();
  return runtimeState === 'hash_accepted'
    || runtimeState === 'rpc_uncertain'
    || runtimeState === 'mempool_visible'
    || runtimeState === 'included'
    || lifecycleStatus === 'broadcasted_unseen'
    || lifecycleStatus === 'visible_pending';
}

export function evaluateCopytradeBuySendState(params: {
  mode: string;
  isBuyDirection: boolean;
  chainId: number;
  txHash?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
}): CopytradeBuySendStateDecision {
  if (params.mode !== 'copytrade' || !params.isBuyDirection) {
    return {
      sendState: 'not_copytrade_buy',
      allowFallback: false,
      blockAdditionalSend: false,
      adoptAcceptedTx: false,
      reasonCode: 'not_copytrade_buy',
      shouldDeferFeeCollection: false,
    };
  }

  const evidence = resolveCopytradeBuyEvidence({
    runtimeContext: params.runtimeContext,
    lifecycle: params.lifecycle || undefined,
    chainId: params.chainId,
    txHash: params.txHash || params.runtimeContext?.canonicalTxHash,
  });
  const resolution = evidence.resolution;
  const acceptedTxHash = evidence.txHash;

  if (hasRuntimeSendStarted(params.runtimeContext) && !resolution.failed) {
    return {
      sendState: 'send_inflight',
      allowFallback: false,
      blockAdditionalSend: true,
      adoptAcceptedTx: false,
      txHash: acceptedTxHash,
      reasonCode: 'send_started',
      shouldDeferFeeCollection: true,
    };
  }

  if (hasDurableAcceptedEvidence({
    acceptedTxHash,
    runtimeContext: params.runtimeContext,
    lifecycle: params.lifecycle,
    accepted: resolution.accepted,
    failed: resolution.failed,
  })) {
    return {
      sendState: 'send_adopted',
      allowFallback: false,
      blockAdditionalSend: true,
      adoptAcceptedTx: Boolean(acceptedTxHash),
      txHash: acceptedTxHash,
      reasonCode: resolution.reasonCode
        || resolution.state
        || String(params.runtimeContext?.state || '').trim().toLowerCase()
        || String(params.lifecycle?.status || '').trim().toLowerCase()
        || 'send_accepted',
      shouldDeferFeeCollection: !resolution.visible && !resolution.success,
    };
  }

  return {
    sendState: 'no_send_evidence',
    allowFallback: true,
    blockAdditionalSend: false,
    adoptAcceptedTx: false,
    reasonCode: resolution.reasonCode || 'no_send_evidence',
    shouldDeferFeeCollection: false,
  };
}

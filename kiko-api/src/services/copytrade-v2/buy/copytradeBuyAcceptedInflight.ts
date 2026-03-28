import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';
import { resolveCopytradeBuyEvidence } from './copytradeBuyEvidence.js';

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
  if (params.mode !== 'copytrade' || !params.isBuyDirection) {
    return {
      adoptAcceptedTx: false,
      blockAdditionalSend: false,
      reasonCode: 'not_copytrade_buy',
      shouldDeferFeeCollection: false
    };
  }

  const evidence = resolveCopytradeBuyEvidence({
    runtimeContext: params.runtimeContext,
    lifecycle: params.lifecycle || undefined,
    chainId: params.chainId,
    txHash: params.txHash || params.runtimeContext?.canonicalTxHash
  });
  const resolution = evidence.resolution;

  const acceptedTxHash = evidence.txHash;
  const runtimeState = String(params.runtimeContext?.state || '').trim().toLowerCase();
  const lifecycleStatus = String(params.lifecycle?.status || '').trim().toLowerCase();
  const hasSendStartedEvidence = runtimeState === 'send_started'
    || params.runtimeContext?.attempts?.some((attempt) => attempt.state === 'sending') === true;
  if (hasSendStartedEvidence && !resolution.failed) {
    return {
      adoptAcceptedTx: false,
      blockAdditionalSend: true,
      txHash: acceptedTxHash,
      reasonCode: 'send_started',
      shouldDeferFeeCollection: true,
    };
  }
  if (!resolution.accepted || resolution.failed || !acceptedTxHash) {
    const hasDurableAcceptedEvidence = Boolean(acceptedTxHash)
      && !resolution.failed
      && (
        runtimeState === 'hash_accepted'
        || runtimeState === 'rpc_uncertain'
        || runtimeState === 'mempool_visible'
        || runtimeState === 'included'
        || lifecycleStatus === 'broadcasted_unseen'
        || lifecycleStatus === 'visible_pending'
      );
    if (hasDurableAcceptedEvidence) {
      return {
        adoptAcceptedTx: true,
        blockAdditionalSend: true,
        txHash: acceptedTxHash,
        reasonCode: runtimeState || lifecycleStatus || 'accepted_hash_present',
        shouldDeferFeeCollection: lifecycleStatus !== 'visible_pending' && lifecycleStatus !== 'confirmed_success',
      };
    }
    return {
      adoptAcceptedTx: false,
      blockAdditionalSend: false,
      reasonCode: resolution.reasonCode || 'not_accepted',
      shouldDeferFeeCollection: false
    };
  }

  return {
    adoptAcceptedTx: true,
    blockAdditionalSend: true,
    txHash: acceptedTxHash,
    reasonCode: resolution.reasonCode || resolution.state || 'send_accepted',
    shouldDeferFeeCollection: !resolution.visible && !resolution.success
  };
}

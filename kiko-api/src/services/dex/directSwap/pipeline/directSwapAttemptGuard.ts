import type { TxLifecycleResult } from '../../../txLifecycle.js';
import type { OrderRuntimeContext } from '../../../order-runtime/types.js';
import type { DirectSwapResult } from '../types.js';

export type DirectSwapSendGuardDecision = {
  blocked: boolean;
  reasonCode:
    | 'send_started'
    | 'tx_hash_present'
    | 'tx_visible_pending'
    | 'tx_confirmed'
    | 'send_guard_clear';
  txHash?: string | null;
  runtimeState?: string | null;
  lifecycleStatus?: string | null;
};

function resolveLifecycleStatus(
  runtimeContext?: OrderRuntimeContext | null,
  lifecycle?: TxLifecycleResult | null
): string {
  return String(lifecycle?.status || runtimeContext?.lastLifecycle?.status || '').trim().toLowerCase();
}

export function evaluateDirectSwapSendGuard(params: {
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
}): DirectSwapSendGuardDecision {
  const runtimeState = String(params.runtimeContext?.state || '').trim().toLowerCase();
  const lifecycleStatus = resolveLifecycleStatus(params.runtimeContext, params.lifecycle);
  const txHash = String(
    params.lifecycle?.txHash
    || params.runtimeContext?.lastLifecycle?.txHash
    || params.runtimeContext?.canonicalTxHash
    || ''
  ).trim().toLowerCase() || null;
  const hasSendStarted = runtimeState === 'send_started'
    || params.runtimeContext?.attempts?.some((attempt) => attempt.state === 'sending') === true;

  if (hasSendStarted) {
    return {
      blocked: true,
      reasonCode: 'send_started',
      txHash,
      runtimeState: runtimeState || null,
      lifecycleStatus: lifecycleStatus || null,
    };
  }

  if (lifecycleStatus === 'broadcasted_unseen' || lifecycleStatus === 'visible_pending') {
    return {
      blocked: true,
      reasonCode: 'tx_visible_pending',
      txHash,
      runtimeState: runtimeState || null,
      lifecycleStatus,
    };
  }

  if (txHash) {
    return {
      blocked: true,
      reasonCode: lifecycleStatus === 'confirmed_success' ? 'tx_confirmed' : 'tx_hash_present',
      txHash,
      runtimeState: runtimeState || null,
      lifecycleStatus: lifecycleStatus || null,
    };
  }

  return {
    blocked: false,
    reasonCode: 'send_guard_clear',
    runtimeState: runtimeState || null,
    lifecycleStatus: lifecycleStatus || null,
  };
}

export function shouldHaltFurtherDirectSwapAttempts(
  result: DirectSwapResult | null | undefined
): boolean {
  if (!result) return false;
  if (result.success) return true;
  const error = String(result.error || '').trim().toLowerCase();
  if (error === 'hint_fast_path_timeout') return true;
  if (error.includes('direct_swap_send_inflight')) return true;
  return evaluateDirectSwapSendGuard({
    runtimeContext: result.runtimeContext,
    lifecycle: result.txLifecycle,
  }).blocked;
}

export function buildTimedOutDirectSwapAttempt(params: {
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
  timeoutError?: string;
}): DirectSwapResult {
  const sendGuard = evaluateDirectSwapSendGuard({
    runtimeContext: params.runtimeContext,
    lifecycle: params.lifecycle,
  });
  const timeoutError = String(params.timeoutError || 'hint_fast_path_timeout').trim() || 'hint_fast_path_timeout';
  const guardedError = sendGuard.blocked
    ? `direct_swap_send_inflight:${sendGuard.reasonCode}`
    : timeoutError;
  return {
    success: false,
    error: guardedError,
    provider: 'failed',
    runtimeContext: params.runtimeContext || undefined,
    txLifecycle: params.lifecycle || params.runtimeContext?.lastLifecycle,
    txHash: sendGuard.txHash || undefined,
  };
}

import type { MainSwapResult } from '../../MainSwapService.js';
import type { CopytradeExecutionOutcome } from '../contracts/outcomes.js';
import type { CopytradeLifecycleState } from '../contracts/lifecycle.js';
import { resolveCtIssueTrace } from '../governance/ct136Linker.js';
import { normalizeCtIssueId, type CtIssueId } from '../governance/ct136Types.js';
import { classifyTradingError } from './errorClassifier.js';

function mapSuccessStatus(result: MainSwapResult): CopytradeExecutionOutcome['status'] {
  const lifecycleStatus = result.txLifecycle?.status;
  if (lifecycleStatus === 'confirmed_success') return 'confirmed';
  if (lifecycleStatus === 'broadcasted_unseen' || lifecycleStatus === 'visible_pending') return 'submitted';
  if (lifecycleStatus === 'pending_broadcast') return 'accepted';
  if (result.txHash) return 'submitted';
  return 'accepted';
}

export interface TradingOutcomeMappingContext {
  preferredIssueId?: CtIssueId | `CT-${string}`;
  sourceTxHash?: string | null;
}

function attachCtTrace(
  outcome: CopytradeExecutionOutcome,
  lifecycleState: CopytradeLifecycleState,
  context?: TradingOutcomeMappingContext,
): CopytradeExecutionOutcome {
  const preferredIssueId = normalizeCtIssueId(
    context?.preferredIssueId || outcome.metadata?.ctIssueHintId,
  );
  const trace = resolveCtIssueTrace({
    reasonCode: outcome.reasonCode,
    preferredFlow: 'trading-flow',
    lifecycleState,
    preferredIssueId,
  });

  return {
    ...outcome,
    metadata: {
      ...(outcome.metadata || {}),
      ctIssueIds: trace.primaryIds,
      ctRelatedIssueIds: trace.relatedIds,
      ctFlows: trace.flows,
    },
  };
}

export function mapSwapResultToOutcome(
  result: MainSwapResult,
  context?: TradingOutcomeMappingContext,
): CopytradeExecutionOutcome {
  const sourceTxHash = String(context?.sourceTxHash || result.runtimeContext?.sourceTxHash || '').trim() || null;

  if (result.success) {
    const lifecycleStatus = result.txLifecycle?.status;
    const reasonCode: CopytradeExecutionOutcome['reasonCode'] = lifecycleStatus === 'confirmed_success'
      ? 'ok_buy_confirmed_open'
      : lifecycleStatus === 'broadcasted_unseen'
        ? 'trading_execution_uncertain'
        : 'ok_buy_submitted';
    const visibilityState: CopytradeExecutionOutcome['visibilityState'] = lifecycleStatus === 'confirmed_success'
      ? 'confirmed'
      : lifecycleStatus === 'visible_pending' || lifecycleStatus === 'broadcasted_unseen'
        ? 'visible'
        : lifecycleStatus === 'pending_broadcast'
          ? 'unseen'
          : 'unknown';
    const finalityHint: CopytradeExecutionOutcome['finalityHint'] = lifecycleStatus === 'confirmed_success'
      ? 'confirmed_success'
      : lifecycleStatus === 'confirmed_failed'
        ? 'confirmed_failed'
        : lifecycleStatus === 'dropped_timeout'
          ? 'timeout_uncertain'
          : 'none';
    const successOutcome: CopytradeExecutionOutcome = {
      status: mapSuccessStatus(result),
      sourceTxHash,
      txHash: result.txHash || null,
      reasonCode,
      retryable: false,
      lifecycleStatus: lifecycleStatus || 'unknown',
      visibilityState,
      finalityHint,
      metadata: {
        provider: result.metadata?.provider || 'unknown',
        txLifecycleStatus: lifecycleStatus || null,
        uncertainVisibility: lifecycleStatus === 'broadcasted_unseen',
      },
    };
    const lifecycleState: CopytradeLifecycleState = successOutcome.status === 'confirmed'
      ? 'BUY_CONFIRMED_OPEN'
      : successOutcome.status === 'accepted'
        ? 'BUY_ACCEPTED'
        : 'BUY_SUBMITTING';
    return attachCtTrace(successOutcome, lifecycleState, context);
  }

  const decision = classifyTradingError(result.error || 'swap_failed');
  const failedOutcome: CopytradeExecutionOutcome = {
    status: decision.retryable ? 'failed_retryable' : 'failed_terminal',
    sourceTxHash,
    txHash: result.txHash || null,
    reasonCode: decision.reasonCode,
    retryable: decision.retryable,
    lifecycleStatus: result.txLifecycle?.status || 'unknown',
    visibilityState: result.txLifecycle?.status === 'confirmed_success'
      ? 'confirmed'
      : result.txLifecycle?.status === 'visible_pending' || result.txLifecycle?.status === 'broadcasted_unseen'
        ? 'visible'
        : result.txLifecycle?.status === 'pending_broadcast'
          ? 'unseen'
          : 'unknown',
    finalityHint: result.txLifecycle?.status === 'confirmed_failed'
      ? 'confirmed_failed'
      : result.txLifecycle?.status === 'dropped_timeout'
        ? 'timeout_uncertain'
        : 'none',
    metadata: {
      provider: result.metadata?.provider || 'unknown',
      hint: decision.hint,
      error: String(result.error || 'swap_failed').slice(0, 240),
      txLifecycleStatus: result.txLifecycle?.status || null,
    },
  };
  return attachCtTrace(
    failedOutcome,
    decision.retryable ? 'FAILED_RETRYABLE' : 'FAILED_TERMINAL',
    context,
  );
}

export function mapThrownErrorToOutcome(
  error: unknown,
  context?: TradingOutcomeMappingContext,
): CopytradeExecutionOutcome {
  const decision = classifyTradingError(error);
  const failedOutcome: CopytradeExecutionOutcome = {
    status: decision.retryable ? 'failed_retryable' : 'failed_terminal',
    sourceTxHash: String(context?.sourceTxHash || '').trim() || null,
    reasonCode: decision.reasonCode,
    retryable: decision.retryable,
    lifecycleStatus: 'unknown',
    visibilityState: 'unknown',
    finalityHint: 'none',
    metadata: {
      hint: decision.hint,
      error: String((error as any)?.message || error || 'unknown_error').slice(0, 240),
    },
  };
  return attachCtTrace(
    failedOutcome,
    decision.retryable ? 'FAILED_RETRYABLE' : 'FAILED_TERMINAL',
    context,
  );
}

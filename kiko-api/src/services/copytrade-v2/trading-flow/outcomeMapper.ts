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
  if (result.success) {
    const successOutcome: CopytradeExecutionOutcome = {
      status: mapSuccessStatus(result),
      txHash: result.txHash || null,
      reasonCode: result.txLifecycle?.status === 'confirmed_success'
        ? 'ok_buy_confirmed_open'
        : 'ok_buy_submitted',
      retryable: false,
      metadata: {
        provider: result.metadata?.provider || 'unknown',
        txLifecycleStatus: result.txLifecycle?.status || null,
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
    txHash: result.txHash || null,
    reasonCode: decision.reasonCode,
    retryable: decision.retryable,
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
    reasonCode: decision.reasonCode,
    retryable: decision.retryable,
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

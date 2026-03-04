import type { CopytradeExecutionOutcome } from '../contracts/outcomes.js';
import type { CopytradeLifecycleState, CopytradeReasonCode } from '../contracts/lifecycle.js';
import { resolveCtIssueTrace } from './ct136Linker.js';
import { normalizeCtIssueId } from './ct136Types.js';

function inferLifecycleStateFromOutcome(
  outcome: CopytradeExecutionOutcome,
): CopytradeLifecycleState {
  if (outcome.status === 'failed_terminal') return 'FAILED_TERMINAL';
  if (outcome.status === 'failed_retryable') return 'FAILED_RETRYABLE';
  if (outcome.status === 'confirmed') {
    return outcome.reasonCode === 'ok_exit_confirmed_closed'
      ? 'EXIT_CONFIRMED_CLOSED'
      : 'BUY_CONFIRMED_OPEN';
  }
  if (outcome.status === 'accepted') {
    return outcome.reasonCode === 'ok_exit_accepted'
      ? 'EXIT_ACCEPTED'
      : 'BUY_ACCEPTED';
  }
  if (outcome.status === 'submitted') {
    return outcome.reasonCode === 'ok_exit_submitted'
      ? 'EXIT_SUBMITTING'
      : 'BUY_SUBMITTING';
  }
  if (outcome.status === 'deferred') return 'DEFERRED';
  if (outcome.status === 'quarantined') return 'QUARANTINED';
  return 'BUY_SUBMITTING';
}

export function buildEventPayloadWithCt(params: {
  reasonCode: CopytradeReasonCode;
  lifecycleState: CopytradeLifecycleState;
  payload?: Record<string, unknown>;
}): Record<string, unknown> {
  const preferredIssueId = normalizeCtIssueId(params.payload?.ctIssueHintId);
  const trace = resolveCtIssueTrace({
    reasonCode: params.reasonCode,
    preferredFlow: 'data-flow',
    lifecycleState: params.lifecycleState,
    preferredIssueId,
  });
  return {
    ...(params.payload || {}),
    ctIssueIds: trace.primaryIds,
    ctRelatedIssueIds: trace.relatedIds,
    ctFlows: trace.flows,
  };
}

export function buildExecutionMetadataWithCt(params: {
  outcome: CopytradeExecutionOutcome;
  preferredIssueId?: `CT-${string}`;
}): Record<string, unknown> {
  const preferredIssueId = normalizeCtIssueId(
    params.preferredIssueId || params.outcome.metadata?.ctIssueHintId,
  );
  const trace = resolveCtIssueTrace({
    reasonCode: params.outcome.reasonCode,
    preferredFlow: 'data-flow',
    lifecycleState: inferLifecycleStateFromOutcome(params.outcome),
    preferredIssueId,
  });

  return {
    ...(params.outcome.metadata || {}),
    ctIssueIds: trace.primaryIds,
    ctRelatedIssueIds: trace.relatedIds,
    ctFlows: trace.flows,
  };
}

import { CopytradeOrderFlowOrchestrator } from '../order-flow/orchestrator.js';
import { DefaultCopytradeModeResolver } from '../policies/modePolicyResolver.js';
import { applyOrderLifecycleEvent } from '../order-flow/stateMachine.js';
import { mapSwapResultToOutcome, mapThrownErrorToOutcome } from '../trading-flow/outcomeMapper.js';
import { buildEventPayloadWithCt, buildExecutionMetadataWithCt } from './ct136Enrichment.js';
import { resolveCtIssueTrace } from './ct136Linker.js';
import { CT_ISSUES, getCtIssue } from './ct136Catalog.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import type {
  CopytradeEventStorePort,
  CopytradeExecutionPort,
  CopytradeObservabilityPort,
  CopytradeOrderRepositoryPort,
  CopytradeRetrySchedulerPort,
} from '../contracts/ports.js';
import type { CopytradeExecutionOutcome } from '../contracts/outcomes.js';
import type { CopytradeLifecycleState, CopytradeReasonCode } from '../contracts/lifecycle.js';
import type { CopytradeMode } from '../contracts/modePolicy.js';
import type { CtIssueDefinition, CtIssueId } from './ct136Types.js';

export interface CtReproductionResult {
  issueId: CtIssueId;
  flow: CtIssueDefinition['flow'];
  matched: boolean;
  strategy: string;
  observedReasonCode?: string;
  observedLifecycleState?: string;
  ctIssueIds: string[];
  detail: string;
}

class InMemoryOrderRepo implements CopytradeOrderRepositoryPort {
  private byKey = new Map<string, CopytradeOrderAggregate>();

  async claimOrLoad(signal: any, mode: CopytradeMode): Promise<{ order: CopytradeOrderAggregate; claimed: boolean }> {
    const key = `${signal.chainId}:${String(signal.swap.txHash).toLowerCase()}:${String(signal.targetWallet).toLowerCase()}`;
    const found = this.byKey.get(key);
    if (found) return { order: found, claimed: false };

    const now = new Date();
    const order: CopytradeOrderAggregate = {
      id: `order-${this.byKey.size + 1}`,
      chainId: signal.chainId,
      txHash: String(signal.swap.txHash || '').toLowerCase(),
      targetWallet: String(signal.targetWallet || '').toLowerCase(),
      tokenIn: String(signal.swap.tokenIn || '').toLowerCase(),
      tokenOut: String(signal.swap.tokenOut || '').toLowerCase(),
      mode,
      lifecycleState: 'DETECTED',
      lastReasonCode: 'ok_detected',
      retryCount: 0,
      direction: 'unknown',
      createdAt: now,
      updatedAt: now,
      metadata: {
        ctIssueHintId: signal.ctIssueHintId || null,
      },
    };

    this.byKey.set(key, order);
    return { order, claimed: true };
  }

  async updateState(params: any): Promise<CopytradeOrderAggregate> {
    const found = [...this.byKey.values()].find((order) => order.id === params.orderId);
    if (!found) throw new Error(`order not found ${params.orderId}`);

    const updated: CopytradeOrderAggregate = {
      ...found,
      lifecycleState: params.lifecycleState,
      lastReasonCode: params.reasonCode,
      retryCount: params.retryCount ?? found.retryCount,
      direction: params.direction ?? found.direction,
      lastExecutionAt: params.lastExecutionAt ?? found.lastExecutionAt,
      closedAt: params.closedAt ?? found.closedAt,
      metadata: params.metadata ?? found.metadata,
      updatedAt: new Date(),
    };

    const key = `${updated.chainId}:${updated.txHash}:${updated.targetWallet}`;
    this.byKey.set(key, updated);
    return updated;
  }

  async getById(orderId: string): Promise<CopytradeOrderAggregate | null> {
    return [...this.byKey.values()].find((order) => order.id === orderId) || null;
  }

  async list(): Promise<CopytradeOrderAggregate[]> {
    return [...this.byKey.values()];
  }
}

class InMemoryEventStore implements CopytradeEventStorePort {
  rows: Array<{ eventType: string; reasonCode: string; payload?: Record<string, unknown> }> = [];

  async append(params: any): Promise<void> {
    const payload = buildEventPayloadWithCt({
      reasonCode: params.reasonCode,
      lifecycleState: params.lifecycleState,
      payload: params.payload,
    });
    this.rows.push({
      eventType: params.eventType,
      reasonCode: params.reasonCode,
      payload,
    });
  }
}

class InMemoryExecutionRecorder {
  rows: Array<{ reasonCode: string; status: string; metadata?: Record<string, unknown> }> = [];

  async record(params: any): Promise<void> {
    this.rows.push({
      reasonCode: params.outcome.reasonCode,
      status: params.outcome.status,
      metadata: params.outcome.metadata,
    });
  }
}

class InMemoryScheduler implements CopytradeRetrySchedulerPort {
  rows: Array<{ orderId: string; attemptNo: number; reasonCode: string }> = [];

  async schedule(params: any): Promise<void> {
    this.rows.push({
      orderId: params.orderId,
      attemptNo: params.attemptNo,
      reasonCode: params.reasonCode,
    });
  }
}

class NoopObservability implements CopytradeObservabilityPort {
  emit(): void {}
}

const ORDER_DRIVABLE_REASONS: CopytradeReasonCode[] = [
  'ingress_deduped',
  'ingress_invalid_swap',
  'validation_low_confidence',
  'quarantine_direction_conflict',
  'deferred_retry_later',
  'deferred_confirmation_pending',
  'quarantined_policy',
  'trading_execution_failed',
  'failed_retryable',
  'failed_terminal',
  'failed_retry_budget_exhausted',
  'ok_exit_submitted',
  'ok_exit_accepted',
  'ok_exit_confirmed_closed',
  'ok_buy_accepted',
  'ok_buy_confirmed_open',
  'invalid_transition',
];

function pickReason(issue: CtIssueDefinition, priority: CopytradeReasonCode[]): CopytradeReasonCode {
  for (const reasonCode of priority) {
    if (issue.reasonCodes.includes(reasonCode)) return reasonCode;
  }
  return issue.reasonCodes[0]!;
}

function buildSignal(issue: CtIssueDefinition, reasonCode: CopytradeReasonCode, seq: number): any {
  const sellLike = issue.lifecycleStates.some((state) => state.startsWith('EXIT_'))
    || reasonCode.startsWith('ok_exit_');

  const tokenIn = sellLike
    ? `0xtoken${String(seq).padStart(4, '0')}`
    : '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const tokenOut = sellLike
    ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    : `0xtoken${String(seq).padStart(4, '0')}`;

  const lowConfidence = reasonCode === 'validation_low_confidence';
  const invalidSwap = reasonCode === 'ingress_invalid_swap';
  const conflict = reasonCode === 'quarantine_direction_conflict';

  return {
    targetWallet: '0xabc0000000000000000000000000000000000001',
    chainId: 8453,
    mode: lowConfidence ? 'safety' : 'normal',
    ctIssueHintId: issue.id,
    swap: {
      txHash: `0x${String(seq).padStart(64, '0')}`,
      tokenIn,
      tokenOut: invalidSwap ? '' : tokenOut,
      amountIn: lowConfidence ? '0' : '1000000000000000000',
      amountOut: lowConfidence ? '0' : '12345',
      router: '0xrouter',
      dexName: 'ct-repro',
      routeHopCount: lowConfidence ? 0 : 1,
      cashLegHint: conflict ? { inferredTxType: 'TARGET_SELL' } : undefined,
    },
  };
}

function buildOutcome(reasonCode: CopytradeReasonCode): CopytradeExecutionOutcome {
  switch (reasonCode) {
    case 'deferred_retry_later':
    case 'deferred_confirmation_pending':
      return {
        status: 'deferred',
        reasonCode,
        retryable: true,
        metadata: {},
      };
    case 'quarantined_policy':
    case 'quarantine_direction_conflict':
      return {
        status: 'quarantined',
        reasonCode,
        retryable: false,
        metadata: {},
      };
    case 'trading_execution_failed':
    case 'failed_retryable':
      return {
        status: 'failed_retryable',
        reasonCode: reasonCode === 'failed_retryable' ? 'failed_retryable' : 'trading_execution_failed',
        retryable: true,
        metadata: {},
      };
    case 'failed_terminal':
    case 'failed_retry_budget_exhausted':
      return {
        status: 'failed_terminal',
        reasonCode: reasonCode === 'failed_retry_budget_exhausted' ? 'failed_terminal' : reasonCode,
        retryable: false,
        metadata: {},
      };
    case 'ok_exit_submitted':
      return {
        status: 'submitted',
        reasonCode,
        retryable: false,
        txHash: '0xexit',
        metadata: {},
      };
    case 'ok_exit_accepted':
      return {
        status: 'accepted',
        reasonCode,
        retryable: false,
        txHash: '0xexit',
        metadata: {},
      };
    case 'ok_exit_confirmed_closed':
      return {
        status: 'confirmed',
        reasonCode,
        retryable: false,
        txHash: '0xexit',
        metadata: {},
      };
    case 'ok_buy_accepted':
      return {
        status: 'accepted',
        reasonCode,
        retryable: false,
        txHash: '0xbuy',
        metadata: {},
      };
    case 'ok_buy_confirmed_open':
    default:
      return {
        status: 'confirmed',
        reasonCode: 'ok_buy_confirmed_open',
        retryable: false,
        txHash: '0xbuy',
        metadata: {},
      };
  }
}

async function reproduceOrderIssue(issue: CtIssueDefinition, seq: number): Promise<CtReproductionResult> {
  const reasonCode = pickReason(issue, ORDER_DRIVABLE_REASONS);
  const signal = buildSignal(issue, reasonCode, seq);

  if (reasonCode === 'invalid_transition') {
    const decision = applyOrderLifecycleEvent({
      id: 'x',
      chainId: 1,
      txHash: '0x1',
      targetWallet: '0xw',
      tokenIn: '0xa',
      tokenOut: '0xb',
      mode: 'normal',
      lifecycleState: 'DETECTED',
      lastReasonCode: 'ok_detected',
      retryCount: 0,
      direction: 'unknown',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    }, 'EXIT_SUBMIT');

    const trace = resolveCtIssueTrace({
      reasonCode: decision.reasonCode,
      preferredFlow: 'order-flow',
      lifecycleState: 'DETECTED',
      preferredIssueId: issue.id,
    });

    return {
      issueId: issue.id,
      flow: issue.flow,
      matched: decision.reasonCode === 'invalid_transition' && trace.primaryIds.includes(issue.id),
      strategy: 'state-machine-illegal-transition',
      observedReasonCode: decision.reasonCode,
      observedLifecycleState: decision.next,
      ctIssueIds: trace.primaryIds,
      detail: 'illegal transition rejected',
    };
  }

  const repo = new InMemoryOrderRepo();
  const events = new InMemoryEventStore();
  const executions = new InMemoryExecutionRecorder();
  const scheduler = new InMemoryScheduler();

  const executionPort: CopytradeExecutionPort = {
    async execute() {
      return buildOutcome(reasonCode);
    },
  };

  const flow = new CopytradeOrderFlowOrchestrator({
    orderRepo: repo,
    eventStore: events,
    executionPort,
    executionRecorder: executions as any,
    modeResolver: new DefaultCopytradeModeResolver(),
    retryScheduler: scheduler,
    observability: new NoopObservability(),
  });

  let result;
  if (reasonCode === 'ingress_deduped') {
    await flow.processSignal(signal);
    result = await flow.processSignal(signal);
  } else {
    result = await flow.processSignal(signal);
  }

  const issueIds = Array.isArray(result.order.metadata?.ctIssueIds)
    ? (result.order.metadata?.ctIssueIds as string[])
    : [];

  const eventIssueIds = events.rows
    .flatMap((row) => Array.isArray(row.payload?.ctIssueIds) ? row.payload?.ctIssueIds as string[] : []);

  return {
    issueId: issue.id,
    flow: issue.flow,
    matched: issueIds.includes(issue.id) || eventIssueIds.includes(issue.id),
    strategy: 'order-flow-orchestrator',
    observedReasonCode: result.reasonCode,
    observedLifecycleState: result.order.lifecycleState,
    ctIssueIds: [...new Set([...issueIds, ...eventIssueIds])],
    detail: `reason=${reasonCode}`,
  };
}

function buildSyntheticSwapResult(reasonCode: CopytradeReasonCode): any {
  if (reasonCode === 'ok_buy_confirmed_open') {
    return {
      success: true,
      txHash: '0xconfirmed',
      metadata: { provider: 'ct-repro' },
      txLifecycle: { status: 'confirmed_success' },
    };
  }
  if (reasonCode === 'ok_buy_submitted' || reasonCode === 'ok_exit_submitted') {
    return {
      success: true,
      txHash: '0xsubmitted',
      metadata: { provider: 'ct-repro' },
      txLifecycle: { status: 'broadcasted_unseen' },
    };
  }
  return {
    success: true,
    txHash: '0xaccepted',
    metadata: { provider: 'ct-repro' },
    txLifecycle: { status: 'pending_broadcast' },
  };
}

async function reproduceTradingIssue(issue: CtIssueDefinition): Promise<CtReproductionResult> {
  const reasonCode = pickReason(issue, [
    'trading_execution_failed',
    'failed_terminal',
    'ok_buy_submitted',
    'ok_buy_confirmed_open',
    'ok_exit_submitted',
    'ok_exit_accepted',
    'trading_execution_uncertain',
  ]);

  const context = { preferredIssueId: issue.id };
  const mapperCapableReasons = new Set<CopytradeReasonCode>([
    'trading_execution_failed',
    'failed_terminal',
    'ok_buy_submitted',
    'ok_buy_confirmed_open',
    'ok_exit_submitted',
    'ok_exit_accepted',
  ]);

  if (!mapperCapableReasons.has(reasonCode)) {
    const trace = resolveCtIssueTrace({
      reasonCode,
      preferredFlow: 'trading-flow',
      lifecycleState: issue.lifecycleStates[0],
      preferredIssueId: issue.id,
    });
    return {
      issueId: issue.id,
      flow: issue.flow,
      matched: trace.primaryIds.includes(issue.id),
      strategy: 'trading-linker-direct',
      observedReasonCode: reasonCode,
      observedLifecycleState: issue.lifecycleStates[0],
      ctIssueIds: trace.primaryIds,
      detail: `reason=${reasonCode}`,
    };
  }

  let outcome: CopytradeExecutionOutcome;
  if (reasonCode === 'trading_execution_failed') {
    outcome = mapThrownErrorToOutcome(new Error('rpc timeout'), context);
  } else if (reasonCode === 'failed_terminal') {
    outcome = mapThrownErrorToOutcome(new Error('slippage revert'), context);
  } else {
    outcome = mapSwapResultToOutcome(buildSyntheticSwapResult(reasonCode), context);
    if (reasonCode === 'ok_exit_submitted') {
      outcome = { ...outcome, reasonCode: 'ok_exit_submitted' };
    }
    if (reasonCode === 'ok_exit_accepted') {
      outcome = { ...outcome, status: 'accepted', reasonCode: 'ok_exit_accepted' };
    }
  }

  const traceIds = Array.isArray(outcome.metadata?.ctIssueIds)
    ? (outcome.metadata?.ctIssueIds as string[])
    : [];

  return {
    issueId: issue.id,
    flow: issue.flow,
    matched: traceIds.includes(issue.id),
    strategy: 'trading-outcome-mapper',
    observedReasonCode: outcome.reasonCode,
    observedLifecycleState: issue.lifecycleStates[0],
    ctIssueIds: traceIds,
    detail: `reason=${reasonCode}`,
  };
}

function inferLifecycleStateForReason(reasonCode: CopytradeReasonCode): CopytradeLifecycleState {
  if (reasonCode === 'failed_terminal') return 'FAILED_TERMINAL';
  if (reasonCode === 'failed_retryable' || reasonCode === 'trading_execution_failed') return 'FAILED_RETRYABLE';
  if (reasonCode === 'ok_exit_confirmed_closed') return 'EXIT_CONFIRMED_CLOSED';
  if (reasonCode === 'ok_exit_accepted') return 'EXIT_ACCEPTED';
  if (reasonCode === 'ok_exit_submitted') return 'EXIT_SUBMITTING';
  if (reasonCode === 'ok_buy_confirmed_open') return 'BUY_CONFIRMED_OPEN';
  if (reasonCode === 'ok_buy_accepted') return 'BUY_ACCEPTED';
  if (reasonCode === 'quarantined_policy' || reasonCode === 'quarantine_direction_conflict') return 'QUARANTINED';
  if (reasonCode === 'deferred_retry_later' || reasonCode === 'deferred_confirmation_pending') return 'DEFERRED';
  return 'VALIDATED';
}

function inferOutcomeForReason(reasonCode: CopytradeReasonCode): CopytradeExecutionOutcome {
  if (reasonCode === 'failed_terminal') return { status: 'failed_terminal', reasonCode, retryable: false };
  if (reasonCode === 'failed_retryable' || reasonCode === 'trading_execution_failed') {
    return { status: 'failed_retryable', reasonCode, retryable: true };
  }
  if (reasonCode === 'ok_exit_confirmed_closed') {
    return { status: 'confirmed', reasonCode, retryable: false, txHash: '0x1' };
  }
  if (reasonCode === 'ok_exit_accepted') {
    return { status: 'accepted', reasonCode, retryable: false, txHash: '0x1' };
  }
  if (reasonCode === 'ok_exit_submitted') {
    return { status: 'submitted', reasonCode, retryable: false, txHash: '0x1' };
  }
  if (reasonCode === 'deferred_retry_later' || reasonCode === 'deferred_confirmation_pending') {
    return { status: 'deferred', reasonCode, retryable: true };
  }
  if (reasonCode === 'quarantined_policy' || reasonCode === 'quarantine_direction_conflict') {
    return { status: 'quarantined', reasonCode, retryable: false };
  }
  return { status: 'accepted', reasonCode: 'ok_buy_accepted', retryable: false, txHash: '0x1' };
}

async function reproduceDataIssue(issue: CtIssueDefinition): Promise<CtReproductionResult> {
  const reasonCode = issue.reasonCodes[0]!;
  const lifecycleState = inferLifecycleStateForReason(reasonCode);

  const eventPayload = buildEventPayloadWithCt({
    reasonCode,
    lifecycleState,
    payload: { ctIssueHintId: issue.id },
  });

  const metadata = buildExecutionMetadataWithCt({
    outcome: {
      ...inferOutcomeForReason(reasonCode),
      metadata: { ctIssueHintId: issue.id },
    },
    preferredIssueId: issue.id,
  });

  const issueIds = [
    ...(Array.isArray(eventPayload.ctIssueIds) ? eventPayload.ctIssueIds as string[] : []),
    ...(Array.isArray(metadata.ctIssueIds) ? metadata.ctIssueIds as string[] : []),
  ];

  return {
    issueId: issue.id,
    flow: issue.flow,
    matched: issueIds.includes(issue.id),
    strategy: 'data-payload-enrichment',
    observedReasonCode: reasonCode,
    observedLifecycleState: lifecycleState,
    ctIssueIds: [...new Set(issueIds)],
    detail: 'event+execution metadata linked',
  };
}

export async function reproduceCtIssue(issueId: CtIssueId, seq = 1): Promise<CtReproductionResult> {
  const issue = getCtIssue(issueId);
  if (!issue) {
    return {
      issueId,
      flow: 'order-flow',
      matched: false,
      strategy: 'not-found',
      ctIssueIds: [],
      detail: 'issue not found in catalog',
    };
  }

  if (issue.flow === 'order-flow') {
    return reproduceOrderIssue(issue, seq);
  }
  if (issue.flow === 'trading-flow') {
    return reproduceTradingIssue(issue);
  }
  return reproduceDataIssue(issue);
}

export async function reproduceAllCtIssues(): Promise<CtReproductionResult[]> {
  const results: CtReproductionResult[] = [];
  let seq = 1;
  for (const issue of CT_ISSUES) {
    results.push(await reproduceCtIssue(issue.id, seq));
    seq += 1;
  }
  return results;
}

import { determineCopyTradeDirection } from '../../copyTradeDirection.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import { CopytradeDomainError } from '../contracts/errors.js';
import {
  type CopytradeLifecycleEvent,
  type CopytradeReasonCode,
  isTerminalState,
} from '../contracts/lifecycle.js';
import type { CopytradeModePolicy, CopytradeModeResolver } from '../contracts/modePolicy.js';
import type { CopytradeExecutionOutcome, CopytradeTxFinalityEvent } from '../contracts/outcomes.js';
import {
  type CopytradeExecutionRecorderPort,
  type CopytradeEventStorePort,
  type CopytradeExecutionPort,
  type CopytradeIngressSignal,
  type CopytradeObservabilityPort,
  type CopytradeOrderRepositoryPort,
  type CopytradeRetrySchedulerPort,
} from '../contracts/ports.js';
import { resolveSignalMode } from '../policies/modePolicyResolver.js';
import { resolveCtIssueTrace } from '../governance/ct136Linker.js';
import { normalizeCtIssueId } from '../governance/ct136Types.js';
import { resolveRetryAt } from './scheduler.js';
import { applyOrderLifecycleEvent } from './stateMachine.js';
import { normalizeTxHash, normalizeWallet } from '../runtime/chainIdentityNormalizer.js';

export interface CopytradeOrderFlowResult {
  order: CopytradeOrderAggregate;
  mode: CopytradeModePolicy['mode'];
  skipped: boolean;
  reasonCode: CopytradeReasonCode;
  executionOutcome?: CopytradeExecutionOutcome;
}

export interface CopytradeTxFinalityApplyResult {
  order: CopytradeOrderAggregate | null;
  applied: boolean;
  reasonCode?: CopytradeReasonCode;
}

export interface CopytradeOrderFlowDeps {
  orderRepo: CopytradeOrderRepositoryPort;
  eventStore: CopytradeEventStorePort;
  executionPort: CopytradeExecutionPort;
  executionRecorder: CopytradeExecutionRecorderPort;
  modeResolver: CopytradeModeResolver;
  retryScheduler: CopytradeRetrySchedulerPort;
  observability: CopytradeObservabilityPort;
}

function inferSignalConfidence(signal: CopytradeIngressSignal): number {
  const amountIn = Number(signal.swap.amountIn || 0);
  const amountOut = Number(signal.swap.amountOut || 0);
  const routeHopCount = Number(signal.swap.routeHopCount ?? signal.swap.routeHops?.length ?? 1);

  let confidence = 0.5;
  if (signal.swap.txHash) confidence += 0.2;
  if (amountIn > 0 && amountOut > 0) confidence += 0.2;
  if (routeHopCount > 0 && routeHopCount <= 4) confidence += 0.1;
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}

function resolveRetryDelayOverride(outcome: CopytradeExecutionOutcome): number | undefined {
  const value = Number(outcome.metadata?.retryDelayMs);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

export class CopytradeOrderFlowOrchestrator {
  constructor(private readonly deps: CopytradeOrderFlowDeps) {}

  async processSignal(signal: CopytradeIngressSignal): Promise<CopytradeOrderFlowResult> {
    const normalizedWallet = normalizeWallet(signal.chainId, signal.targetWallet);
    const txHash = normalizeTxHash(signal.chainId, signal.swap?.txHash);

    if (!normalizedWallet || !txHash) {
      throw new CopytradeDomainError({
        code: 'COPYTRADE_INGRESS_MISSING_IDENTITY',
        message: 'targetWallet or swap.txHash missing',
        retryable: false,
        statusCode: 400,
      });
    }

    const mode = resolveSignalMode(signal.mode);
    const policy = this.deps.modeResolver.resolve(mode);
    const claim = await this.deps.orderRepo.claimOrLoad(
      {
        ...signal,
        targetWallet: normalizedWallet,
        swap: {
          ...signal.swap,
          txHash,
        },
      },
      policy.mode,
    );

    let order = claim.order;

    if (!claim.claimed) {
      await this.deps.eventStore.append({
        orderId: order.id,
        eventType: 'INGRESS_DEDUPED',
        lifecycleState: order.lifecycleState,
        reasonCode: 'ingress_deduped',
        payload: {
          chainId: signal.chainId,
          targetWallet: normalizedWallet,
          txHash,
          sourceTxFrom: signal.sourceTxFrom || null,
          ctIssueHintId: signal.ctIssueHintId || order.metadata?.ctIssueHintId || null,
        },
      });
      this.deps.observability.emit('copytrade_v2_ingress_deduped', {
        orderId: order.id,
        chainId: signal.chainId,
        mode: policy.mode,
      });
      return {
        order,
        mode: policy.mode,
        skipped: true,
        reasonCode: 'ingress_deduped',
      };
    }

    order = await this.transition(order, 'VALIDATE');

    if (!signal.swap?.tokenIn || !signal.swap?.tokenOut) {
      order = await this.transition(order, 'FAIL_TERMINAL', 'ingress_invalid_swap');
      return {
        order,
        mode: policy.mode,
        skipped: true,
        reasonCode: 'ingress_invalid_swap',
      };
    }

    const confidence = inferSignalConfidence(signal);
    if (confidence < policy.minSignalConfidence) {
      const event: CopytradeLifecycleEvent = policy.strictRiskChecks ? 'QUARANTINE' : 'DEFER';
      const reasonCode: CopytradeReasonCode = 'validation_low_confidence';
      order = await this.transition(order, event, reasonCode, {
        signalConfidence: confidence,
        requiredConfidence: policy.minSignalConfidence,
      });
      return {
        order,
        mode: policy.mode,
        skipped: true,
        reasonCode,
      };
    }

    const direction = determineCopyTradeDirection({
      chainId: signal.chainId,
      tokenIn: signal.swap.tokenIn,
      tokenOut: signal.swap.tokenOut,
      cashLegHint: signal.swap.cashLegHint,
    });

    const resolvedDirection: CopytradeOrderAggregate['direction'] = direction.isSell
      ? 'sell'
      : direction.isBuy
        ? 'buy'
        : direction.isTokenToToken
          ? 'token_swap'
          : 'unknown';

    order = await this.deps.orderRepo.updateState({
      orderId: order.id,
      lifecycleState: order.lifecycleState,
      reasonCode: order.lastReasonCode,
      direction: resolvedDirection,
      metadata: {
        ...(order.metadata || {}),
        directionSource: direction.source,
        inferredTxType: direction.inferredTxType || null,
        directionIsRoutable: direction.isRoutable,
        directionIsAmbiguous: direction.isAmbiguous,
        directionIsExplicitTokenSwap: direction.isExplicitTokenSwap,
        sourceTxFrom: signal.sourceTxFrom || order.metadata?.sourceTxFrom || null,
      },
    });

    if (direction.hintConflict && policy.strictRiskChecks) {
      order = await this.transition(order, 'QUARANTINE', 'quarantine_direction_conflict', {
        inferredTxType: direction.inferredTxType || null,
      });
      return {
        order,
        mode: policy.mode,
        skipped: true,
        reasonCode: 'quarantine_direction_conflict',
      };
    }

    if (direction.isExplicitTokenSwap) {
      return this.executeBuy(signal, order, policy);
    }

    if (!direction.isRoutable) {
      const event: CopytradeLifecycleEvent = policy.strictRiskChecks || direction.isAmbiguous
        ? 'QUARANTINE'
        : 'DEFER';
      const reasonCode: CopytradeReasonCode = 'validation_unroutable';
      order = await this.transition(order, event, reasonCode, {
        direction: resolvedDirection,
        inferredTxType: direction.inferredTxType || null,
        directionSource: direction.source,
        isAmbiguous: direction.isAmbiguous,
        isExplicitTokenSwap: direction.isExplicitTokenSwap,
      });
      return {
        order,
        mode: policy.mode,
        skipped: true,
        reasonCode,
      };
    }

    if (resolvedDirection === 'sell') {
      return this.executeExit(signal, order, policy);
    }
    return this.executeBuy(signal, order, policy);
  }

  private async executeBuy(
    signal: CopytradeIngressSignal,
    order: CopytradeOrderAggregate,
    policy: CopytradeModePolicy,
  ): Promise<CopytradeOrderFlowResult> {
    let current = await this.transition(order, 'BUY_SUBMIT');
    const outcome = await this.deps.executionPort.execute(signal, current);
    await this.deps.executionRecorder.record({
      orderId: current.id,
      attemptNo: current.retryCount + 1,
      mode: policy.mode,
      outcome,
    });

    if (outcome.status === 'confirmed') {
      current = await this.transition(current, 'BUY_ACCEPT', outcome.reasonCode, {
        execution: outcome,
      });
      current = await this.transition(current, 'BUY_CONFIRM_OPEN', outcome.reasonCode, {
        execution: outcome,
      });
      current = await this.transition(current, 'ARM_EXIT', 'ok_exit_armed', {
        execution: outcome,
      });
      return {
        order: current,
        mode: policy.mode,
        skipped: false,
        reasonCode: current.lastReasonCode,
        executionOutcome: outcome,
      };
    }

    if (outcome.status === 'accepted' || outcome.status === 'submitted') {
      current = await this.transition(current, 'BUY_ACCEPT', outcome.reasonCode, {
        execution: outcome,
      });
      return {
        order: current,
        mode: policy.mode,
        skipped: false,
        reasonCode: current.lastReasonCode,
        executionOutcome: outcome,
      };
    }

    return this.handleExecutionFailure(current, policy, outcome);
  }

  private async executeExit(
    signal: CopytradeIngressSignal,
    order: CopytradeOrderAggregate,
    policy: CopytradeModePolicy,
  ): Promise<CopytradeOrderFlowResult> {
    let current = await this.transition(order, 'ARM_EXIT');
    current = await this.transition(current, 'EXIT_SUBMIT');

    const outcome = await this.deps.executionPort.execute(signal, current);
    await this.deps.executionRecorder.record({
      orderId: current.id,
      attemptNo: current.retryCount + 1,
      mode: policy.mode,
      outcome,
    });

    if (outcome.status === 'confirmed') {
      current = await this.transition(current, 'EXIT_ACCEPT', outcome.reasonCode, {
        execution: outcome,
      });
      current = await this.transition(current, 'EXIT_CONFIRM_CLOSED', outcome.reasonCode, {
        execution: outcome,
      });
      return {
        order: current,
        mode: policy.mode,
        skipped: false,
        reasonCode: current.lastReasonCode,
        executionOutcome: outcome,
      };
    }

    if (outcome.status === 'accepted' || outcome.status === 'submitted') {
      current = await this.transition(current, 'EXIT_ACCEPT', outcome.reasonCode, {
        execution: outcome,
      });
      return {
        order: current,
        mode: policy.mode,
        skipped: false,
        reasonCode: current.lastReasonCode,
        executionOutcome: outcome,
      };
    }

    return this.handleExecutionFailure(current, policy, outcome);
  }

  private async handleExecutionFailure(
    order: CopytradeOrderAggregate,
    policy: CopytradeModePolicy,
    outcome: CopytradeExecutionOutcome,
  ): Promise<CopytradeOrderFlowResult> {
    if (outcome.status === 'deferred') {
      const deferred = await this.transition(order, 'DEFER', outcome.reasonCode, {
        execution: outcome,
      });
      if (outcome.retryable) {
        const attemptNo = Math.max(1, order.retryCount + 1);
        const retryAt = resolveRetryAt(
          policy,
          attemptNo,
          Date.now(),
          resolveRetryDelayOverride(outcome),
        );
        await this.deps.retryScheduler.schedule({
          orderId: deferred.id,
          retryAt,
          reasonCode: 'ok_retry_scheduled',
          attemptNo,
        });
        this.deps.observability.emit('copytrade_v2_deferred_retry_scheduled', {
          orderId: deferred.id,
          retryAt: retryAt.toISOString(),
          attemptNo,
          mode: policy.mode,
          reasonCode: outcome.reasonCode,
        });
      }
      return {
        order: deferred,
        mode: policy.mode,
        skipped: false,
        reasonCode: deferred.lastReasonCode,
        executionOutcome: outcome,
      };
    }

    if (outcome.status === 'quarantined') {
      const quarantined = await this.transition(order, 'QUARANTINE', outcome.reasonCode, {
        execution: outcome,
      });
      return {
        order: quarantined,
        mode: policy.mode,
        skipped: true,
        reasonCode: quarantined.lastReasonCode,
        executionOutcome: outcome,
      };
    }

    if (outcome.status === 'failed_terminal') {
      const terminal = await this.transition(order, 'FAIL_TERMINAL', outcome.reasonCode, {
        execution: outcome,
      });
      return {
        order: terminal,
        mode: policy.mode,
        skipped: false,
        reasonCode: terminal.lastReasonCode,
        executionOutcome: outcome,
      };
    }

    const nextRetryCount = order.retryCount + 1;
    if (nextRetryCount > policy.maxRetries) {
      const terminal = await this.transition(order, 'FAIL_TERMINAL', 'failed_retry_budget_exhausted', {
        execution: outcome,
        nextRetryCount,
        maxRetries: policy.maxRetries,
      });
      return {
        order: terminal,
        mode: policy.mode,
        skipped: false,
        reasonCode: terminal.lastReasonCode,
        executionOutcome: outcome,
      };
    }

    const retryable = await this.transition(order, 'FAIL_RETRYABLE', outcome.reasonCode, {
      execution: outcome,
      nextRetryCount,
    }, {
      retryCount: nextRetryCount,
      lastExecutionAt: new Date(),
    });

    const retryAt = resolveRetryAt(
      policy,
      nextRetryCount,
      Date.now(),
      resolveRetryDelayOverride(outcome),
    );
    await this.deps.retryScheduler.schedule({
      orderId: retryable.id,
      retryAt,
      reasonCode: 'ok_retry_scheduled',
      attemptNo: nextRetryCount,
    });

    this.deps.observability.emit('copytrade_v2_retry_scheduled', {
      orderId: retryable.id,
      retryAt: retryAt.toISOString(),
      attemptNo: nextRetryCount,
      mode: policy.mode,
      reasonCode: outcome.reasonCode,
    });

    return {
      order: retryable,
      mode: policy.mode,
      skipped: false,
      reasonCode: retryable.lastReasonCode,
      executionOutcome: outcome,
    };
  }

  async processTxFinalityEvent(event: CopytradeTxFinalityEvent): Promise<CopytradeTxFinalityApplyResult> {
    const order = await this.deps.orderRepo.getById(event.orderId);
    if (!order) {
      this.deps.observability.emit('copytrade_v2_finality_order_missing', {
        orderId: event.orderId,
        chainId: event.chainId,
        txHash: event.txHash,
        kind: event.kind,
      });
      return { order: null, applied: false };
    }

    await this.deps.eventStore.append({
      orderId: order.id,
      eventType: `TX_FINALITY_${event.kind.toUpperCase()}`,
      lifecycleState: order.lifecycleState,
      reasonCode: event.reasonCode,
      payload: {
        txHash: event.txHash,
        sourceTxHash: event.sourceTxHash,
        observedAt: event.observedAt.toISOString(),
        kind: event.kind,
      },
    });

    if (isTerminalState(order.lifecycleState)) {
      this.deps.observability.emit('copytrade_v2_finality_ignored_terminal', {
        orderId: order.id,
        lifecycleState: order.lifecycleState,
        kind: event.kind,
      });
      return {
        order,
        applied: false,
        reasonCode: order.lastReasonCode,
      };
    }

    let current = order;
    if (event.kind === 'confirmed_success') {
      if (current.lifecycleState === 'BUY_ACCEPTED' || current.lifecycleState === 'BUY_SUBMITTING') {
        current = await this.transition(current, 'BUY_CONFIRM_OPEN', 'ok_buy_confirmed_open', {
          txFinality: event,
        });
        current = await this.transition(current, 'ARM_EXIT', 'ok_exit_armed', {
          txFinality: event,
        });
        return { order: current, applied: true, reasonCode: current.lastReasonCode };
      }

      if (current.lifecycleState === 'EXIT_ACCEPTED' || current.lifecycleState === 'EXIT_SUBMITTING') {
        current = await this.transition(current, 'EXIT_CONFIRM_CLOSED', 'ok_exit_confirmed_closed', {
          txFinality: event,
        });
        return { order: current, applied: true, reasonCode: current.lastReasonCode };
      }

      return { order: current, applied: false, reasonCode: current.lastReasonCode };
    }

    if (event.kind === 'confirmed_failed') {
      current = await this.transition(current, 'FAIL_TERMINAL', 'failed_terminal', {
        txFinality: event,
      });
      return { order: current, applied: true, reasonCode: current.lastReasonCode };
    }

    if (
      current.lifecycleState === 'BUY_ACCEPTED'
      || current.lifecycleState === 'BUY_SUBMITTING'
      || current.lifecycleState === 'EXIT_ACCEPTED'
      || current.lifecycleState === 'EXIT_SUBMITTING'
    ) {
      current = await this.transition(current, 'DEFER', 'deferred_confirmation_pending', {
        txFinality: event,
      });
      return { order: current, applied: true, reasonCode: current.lastReasonCode };
    }

    return { order: current, applied: false, reasonCode: current.lastReasonCode };
  }

  async patchOrderMetadata(orderId: string, metadata: Record<string, unknown>): Promise<CopytradeOrderAggregate | null> {
    const order = await this.deps.orderRepo.getById(orderId);
    if (!order) return null;

    const next = await this.deps.orderRepo.updateState({
      orderId: order.id,
      lifecycleState: order.lifecycleState,
      reasonCode: order.lastReasonCode,
      retryCount: order.retryCount,
      direction: order.direction,
      lastExecutionAt: order.lastExecutionAt || undefined,
      closedAt: order.closedAt || undefined,
      metadata,
    });

    await this.deps.eventStore.append({
      orderId: next.id,
      eventType: 'METADATA_PATCH',
      lifecycleState: next.lifecycleState,
      reasonCode: next.lastReasonCode,
      payload: metadata,
    });

    return next;
  }

  private async transition(
    order: CopytradeOrderAggregate,
    event: CopytradeLifecycleEvent,
    reasonCode?: CopytradeReasonCode,
    payload?: Record<string, unknown>,
    patch?: {
      retryCount?: number;
      lastExecutionAt?: Date;
      closedAt?: Date | null;
    },
  ): Promise<CopytradeOrderAggregate> {
    const decision = applyOrderLifecycleEvent(order, event, reasonCode);
    const preferredIssueId = normalizeCtIssueId(
      payload?.ctIssueHintId || order.metadata?.ctIssueHintId,
    );
    const ctTrace = resolveCtIssueTrace({
      reasonCode: decision.reasonCode,
      preferredFlow: 'order-flow',
      lifecycleState: decision.accepted ? decision.next : order.lifecycleState,
      preferredIssueId,
    });
    const payloadWithCt: Record<string, unknown> = {
      ...(payload || {}),
      ctIssueIds: ctTrace.primaryIds,
      ctRelatedIssueIds: ctTrace.relatedIds,
      ctFlows: ctTrace.flows,
    };

    if (!decision.accepted) {
      await this.deps.eventStore.append({
        orderId: order.id,
        eventType: `REJECTED_${event}`,
        lifecycleState: order.lifecycleState,
        reasonCode: decision.reasonCode,
        payload: payloadWithCt,
      });
      this.deps.observability.emit('copytrade_v2_invalid_transition', {
        orderId: order.id,
        event,
        currentState: order.lifecycleState,
        reasonCode: decision.reasonCode,
        ctIssueIds: ctTrace.primaryIds,
        ctRelatedIssueIds: ctTrace.relatedIds,
      });
      return order;
    }

    const next = await this.deps.orderRepo.updateState({
      orderId: order.id,
      lifecycleState: decision.next,
      reasonCode: decision.reasonCode,
      retryCount: patch?.retryCount,
      lastExecutionAt: patch?.lastExecutionAt,
      closedAt: decision.next === 'EXIT_CONFIRMED_CLOSED'
        ? (patch?.closedAt || new Date())
        : patch?.closedAt,
      metadata: {
        ...(order.metadata || {}),
        ...payloadWithCt,
      },
    });

    await this.deps.eventStore.append({
      orderId: next.id,
      eventType: event,
      lifecycleState: next.lifecycleState,
      reasonCode: decision.reasonCode,
      payload: payloadWithCt,
    });

    return next;
  }
}
